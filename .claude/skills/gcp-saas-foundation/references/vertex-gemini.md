# Gemini on Vertex AI

Wiring the model: keyless client, streaming, usage metadata, finish reasons, and what was
actually verified to work. Everything here was exercised against a real project with
`@google/genai` v2.21.0 on Node.

Failures cited as "gotcha §N" live in `references/gotchas.md`.

**Contents**

- [1. The client: ADC, no API key](#1-the-client-adc-no-api-key)
- [2. Streaming](#2-streaming)
- [3. Usage metadata, and the billing judgement call](#3-usage-metadata-and-the-billing-judgement-call)
- [4. Finish reasons](#4-finish-reasons)
- [5. Verified model facts](#5-verified-model-facts)
- [6. SSE to the browser](#6-sse-to-the-browser)

---

## 1. The client: ADC, no API key

```ts
import "server-only";
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function vertex(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,                 // selects Vertex; without it the SDK wants an API key
      project: gcpProjectId(),        // NOT projectId
      location: process.env.VERTEX_REGION || "global",   // NOT region
      httpOptions: {
        timeout: 9 * 60 * 1000,       // stay inside the Cloud Run request timeout
        retryOptions: { attempts: 3 }, // attempts counts the original -> two retries
      },
    });
  }
  return client;
}
```

Verified against the installed typings (`GoogleGenAIOptions` in
`node_modules/@google/genai/dist/genai.d.ts`): the option names are **`project`** and
**`location`**, alongside `vertexai`, `apiKey`, `apiVersion` and `httpOptions`. `projectId` and
`region` are not options and are silently ignored — the client then falls back to whatever ADC
resolves, or fails with a confusing project error. In v2.21 an `enterprise` flag exists as the
recommended synonym for `vertexai`; setting both to *different* values throws.

**No API key, nothing to rotate.** With `vertexai: true` and no `apiKey`, the SDK authenticates
with Application Default Credentials. On Cloud Run that is the service account attached to the
revision, so as long as it holds `roles/aiplatform.user` there is no model credential anywhere
in the system: nothing in an env var, nothing in Secret Manager, nothing to leak in a
`git log`, and no rotation calendar. Model spend also lands on the same GCP bill as the rest of
the infrastructure. Locally the same code picks up `gcloud auth application-default login`.

Retries deserve a second look: `attempts` counts the original request, so `attempts: 3` means
two retries. The default is higher, and on a slow streaming call the retries can outlive the
`timeout` you set — set both together.

Keep the client module-level and lazy. Constructing it per request re-does auth discovery and
throws away the HTTP agent's connection pool.

---

## 2. Streaming

`generateContentStream` returns a **`Promise<AsyncGenerator<GenerateContentResponse>>`**, not an
async generator. It must be awaited before `for await`, and forgetting is a confusing failure:
`for await` over a Promise iterates nothing useful and you get an empty result with no error.

```ts
const responseStream = await vertex().models.generateContentStream({   // <-- await
  model: modelId(),                       // bare id, e.g. "gemini-2.5-pro"
  contents: buildUserPrompt(inputs),      // the task
  config: {
    systemInstruction: `${ROLE_PROMPT}\n\n${contextBlock}`,   // who is writing
    maxOutputTokens: 4000,
    abortSignal: request.signal,
  },
});

for await (const chunk of responseStream) {
  const delta = chunk.text;               // convenience accessor over candidates[0].parts
  if (delta) send({ type: "delta", text: delta });
}
```

**System instruction vs user content.** Put persona, tone, output-format rules and per-tenant
context (a brand kit, an account's style guide) in `systemInstruction`; put the actual task and
its inputs in `contents`. The split is not cosmetic — the system instruction is weighted across
the whole response, whereas instructions buried in a long user message drift as generation goes
on. It also keeps the task prompt short enough to log and debug.

**Max output tokens.** `config.maxOutputTokens` is the cap. Size it per action rather than
globally: it is your only hard ceiling on the cost of a single run, and it feeds the pre-flight
credit estimate shown in the UI. See §4 for what happens when the cap is hit.

**AbortSignal.** Pass the incoming request's signal into `config.abortSignal` so a client
disconnect stops your side of the work — the loop ends, the connection is released, and the run
is neither saved nor charged.

Be accurate about what this saves. The SDK typings state that AbortSignal is a client-side
operation: cancelling does **not** cancel the request in the service, and you may still be
billed for the generation Vertex has already started. So the abort reliably saves bandwidth,
connection slots and the wrong-state write; it does not reliably save spend. That is also why
aborting must not save or charge — you have no usage numbers at that point.

```ts
} catch (error) {
  const aborted = request.signal.aborted ||
                  (error instanceof Error && error.name === "AbortError");
  if (!aborted) { /* report */ }        // a closed tab is normal, not an error
}
```

---

## 3. Usage metadata, and the billing judgement call

Field names on `chunk.usageMetadata` (`GenerateContentResponseUsageMetadata`):

| Field | Meaning |
|---|---|
| `promptTokenCount` | All input, including implicitly cached input |
| `candidatesTokenCount` | Visible generated output |
| `thoughtsTokenCount` | The model's internal reasoning tokens |
| `cachedContentTokenCount` | Portion of the prompt served from cache |
| `totalTokenCount` | Sum of prompt + candidates + thoughts + tool-use prompt tokens |

**They arrive on trailing chunks.** Most chunks carry no `usageMetadata` at all, and the very
last chunk may carry none either. Keep the last non-empty value rather than reading the final
chunk:

```ts
let usage: GenerateContentResponseUsageMetadata | undefined;
let finishReason: FinishReason | undefined;

for await (const chunk of responseStream) {
  if (chunk.usageMetadata) usage = chunk.usageMetadata;          // keep the last non-empty
  if (chunk.candidates?.[0]?.finishReason) finishReason = chunk.candidates[0].finishReason;
  ...
}
```

**Thinking tokens bill at the output rate.** This is the judgement call that matters. Gemini 2.5
Pro always thinks, and those tokens are not in `candidatesTokenCount`. Charging on
`candidatesTokenCount` alone therefore undercharges *every single run* — silently, by a margin
that grows with how hard the task is, which is exactly when the run costs you most.

```ts
const inputTokens  = usage?.promptTokenCount ?? 0;
const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
const creditsUsed  = creditsForUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
```

Do not reconstruct the output count by subtracting from `totalTokenCount` — it also includes
tool-use prompt tokens, which are input-priced. Add the two output-priced fields explicitly.

Cache fields are worth carrying in the usage type for later, but the SDK folds implicitly cached
input into `promptTokenCount` rather than splitting it out, so in practice they stay zero today.
Weight them only if you turn on explicit context caching.

---

## 4. Finish reasons

Read `candidates[0].finishReason` and `promptFeedback.blockReason`. `STOP` is the normal case.

**`MAX_TOKENS`** — the model hit `maxOutputTokens`. The text so far is real and worth keeping;
it is just cut off mid-thought. Save it, charge for it, and tell the user, rather than silently
handing back a truncated document they will assume is complete:

```ts
if (finishReason === FinishReason.MAX_TOKENS) {
  const note = "\n\n> Note: output reached the length limit and may be truncated.";
  send({ type: "delta", text: note });
  text += note;                          // and persist the note with the artefact
}
```

**Blocks.** `SAFETY`, `RECITATION`, `PROHIBITED_CONTENT`, `BLOCKLIST` and `SPII` mean generation
stopped because of a content filter, not because it was done. When streaming, the content is
empty or truncated. `promptFeedback.blockReason` is the parallel signal for the *input* being
rejected before generation started — check both, since a prompt block may never produce a
candidate at all.

```ts
const BLOCKED: ReadonlySet<FinishReason> = new Set([
  FinishReason.SAFETY, FinishReason.RECITATION,
  FinishReason.PROHIBITED_CONTENT, FinishReason.BLOCKLIST, FinishReason.SPII,
]);

for await (const chunk of responseStream) {
  if (chunk.promptFeedback?.blockReason) blocked = true;
  ...
}

if (blocked || (finishReason && BLOCKED.has(finishReason))) {
  send({ type: "error", message: "The model declined this request. Try rephrasing the brief." });
  return;                                // do not save, do not charge
}
if (!text.trim()) {
  send({ type: "error", message: "The model returned no content. Please try again." });
  return;
}
```

The rule: a blocked or empty run produces a clean user-facing error and no artefact. Saving an
empty document is worse than failing — it looks like a bug in your product forever, and it
charges the user for nothing. The empty-text check is a separate guard because
`OTHER` and `LANGUAGE` finishes can also yield nothing.

---

## 5. Verified model facts

From a real project on a fresh GCP account:

| Model | `global` | `us-central1` |
|---|---|---|
| `gemini-2.5-pro` | 200 | 200 |
| `gemini-2.5-flash` | 200 | 200 |
| `gemini-3-pro-preview` | 404 | 404 |

- **Model IDs are bare.** `gemini-2.5-pro` — no `publishers/google/` prefix inside the SDK, and
  **no date suffix**. A suffixed or prefixed id is a 404.
- **`global` is the better default.** It routes across regions and has the best availability and
  quota headroom. Pin a specific region only for data-residency requirements, and re-probe the
  exact `(model, location)` pair when you do — availability differs by location.
- **No per-model enablement.** Gemini is first-party: enabling `aiplatform.googleapis.com` is
  all it takes. No Model Garden acceptance step, no Terraform resource.
- **Cross-reference gotcha §1 on quota.** A 429 on a brand-new project is not rate limiting from
  hammering — the per-base-model quota can default to **zero**, so the first request fails and
  the fix is a quota-increase request that takes days. Probe before building on a model, and
  read the status code as a diagnosis: 200 good, 404 wrong id or not served there, 403 missing
  `roles/aiplatform.user`, 429 zero quota.

Making the model an env var (`VERTEX_MODEL`, `VERTEX_REGION`) is worth it: switching to
`gemini-2.5-flash` for cost or latency then becomes a redeploy, not a code change. If you switch
model families, revisit `OUTPUT_WEIGHT` in the metering module — see `architecture.md` §5.

---

## 6. SSE to the browser

Frame shape — one JSON object per event, `data: ` prefix, blank line terminator:

```ts
const sse = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
```

A small tagged union carries the whole exchange:

| `type` | Payload | Meaning |
|---|---|---|
| `start` | — | Accepted; the model call has begun |
| `delta` | `{ text }` | Append to the buffer |
| `done` | `{ id, title, creditsUsed, creditsRemaining }` | Finished, persisted, charged |
| `error` | `{ message }` | User-facing failure; stop |

Answer everything that can fail *before* the stream opens with an ordinary JSON error and a
status code — unauthenticated (401), bad input (400), unknown action (404), out of credits (402).
Once the stream is open the status is already 200 and an `error` frame is all you have left.

On the client, buffer and split on `\n\n` rather than per read; a frame can be split across
network reads. Skip a frame that fails to parse instead of killing the stream.

Response headers, and **cross-reference gotcha §14** for why each is needed:

```ts
new Response(stream, { headers: {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",          // or the proxy in front of Cloud Run buffers the lot
}});
```

Cloud Run's request timeout must also exceed the longest generation (600s is a reasonable
ceiling), with the SDK's own `httpOptions.timeout` set *below* it so you get a clean error
rather than a severed connection.
