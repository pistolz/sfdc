import type Anthropic from "@anthropic-ai/sdk";
import { handleRouteError, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  createAsset,
  debitCredits,
  ensureUserRecord,
  getBrand,
  recordUsage,
} from "@/lib/firestore";
import {
  ROLE_PROMPT,
  brandBlock,
  deriveTitle,
  getGenerator,
  validateInputs,
} from "@/lib/generators";
import { creditsForUsage } from "@/lib/credits";
import { modelId, vertex } from "@/lib/vertex";
import type { BrandKit } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Long-form generations stream for minutes; keep inside the Cloud Run timeout. */
export const maxDuration = 600;

const encoder = new TextEncoder();

function sse(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Models sometimes wrap a whole-file HTML answer in a markdown fence despite
 * being told not to. Unwrap it so the saved asset is directly usable.
 */
function unwrapFence(text: string, format: "markdown" | "html"): string {
  if (format !== "html") return text;
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:html)?\s*\n([\s\S]*?)\n?```$/);
  return match ? match[1].trim() : trimmed;
}

export async function POST(request: Request) {
  let user;
  let generator;
  let inputs: Record<string, string>;
  let brand: BrandKit | null = null;

  // Everything that can fail before the stream opens is answered with a normal
  // JSON error, so the client gets a status code rather than an error event.
  try {
    user = await requireUser();
    const account = await ensureUserRecord(user);

    const body = await readJson(request);
    if (typeof body !== "object" || body === null) {
      return jsonError("Expected a JSON body.", 400);
    }
    const { generatorId, brandId, inputs: rawInputs } = body as {
      generatorId?: unknown;
      brandId?: unknown;
      inputs?: unknown;
    };

    if (typeof generatorId !== "string") {
      return jsonError("A generator is required.", 400);
    }
    generator = getGenerator(generatorId);
    if (!generator) return jsonError("Unknown generator.", 404);

    const validated = validateInputs(generator, rawInputs);
    if (!validated.ok) return jsonError(validated.error, 400);
    inputs = validated.inputs;

    if (account.credits <= 0) {
      return jsonError(
        "You are out of credits. Upgrade your plan or wait for your next refill.",
        402,
      );
    }

    if (typeof brandId === "string" && brandId) {
      // Scoped to this user, so an id belonging to another account resolves to null.
      brand = await getBrand(user.uid, brandId);
    }
  } catch (error) {
    return handleRouteError(error);
  }

  const uid = user.uid;
  const activeGenerator = generator;
  const activeInputs = inputs;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (!closed) controller.enqueue(sse(payload));
      };

      try {
        send({ type: "start" });

        const system: Anthropic.TextBlockParam[] = [
          { type: "text", text: ROLE_PROMPT },
          {
            type: "text",
            text: brandBlock(brand),
            // The role prompt and brand kit are identical across every run for
            // this user, so caching the prefix cuts cost on repeat generations.
            cache_control: { type: "ephemeral" },
          },
        ];

        const messageStream = vertex().messages.stream(
          {
            model: modelId(),
            max_tokens: activeGenerator.maxTokens,
            // `thinking` is deliberately omitted: Claude Opus 5 and Sonnet 5
            // both run adaptive thinking by default, and omitting it keeps this
            // request valid across every model VERTEX_MODEL might be set to.
            system,
            messages: [
              { role: "user", content: activeGenerator.instruction(activeInputs) },
            ],
          },
          // Propagates browser disconnects upstream so we stop paying for a
          // generation nobody is watching.
          { signal: request.signal },
        );

        let text = "";
        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            text += event.delta.text;
            send({ type: "delta", text: event.delta.text });
          }
        }

        const final = await messageStream.finalMessage();

        if (final.stop_reason === "refusal") {
          send({
            type: "error",
            message:
              "The model declined this request. Try rephrasing the brief.",
          });
          return;
        }
        if (!text.trim()) {
          send({ type: "error", message: "The model returned no content. Please try again." });
          return;
        }
        if (final.stop_reason === "max_tokens") {
          send({
            type: "delta",
            text: "\n\n> Note: output reached the length limit and may be truncated.",
          });
          text += "\n\n> Note: output reached the length limit and may be truncated.";
        }

        // Charged on real usage, so a short post costs far less than a landing page.
        const creditsUsed = creditsForUsage(final.usage);
        const content = unwrapFence(text, activeGenerator.format);
        const title = deriveTitle(activeGenerator, activeInputs);

        const assetId = await createAsset(uid, {
          generatorId: activeGenerator.id,
          title,
          content,
          format: activeGenerator.format,
          brandId: brand?.id ?? null,
          inputs: activeInputs,
          creditsUsed,
          createdAt: Date.now(),
        });

        const creditsRemaining = await debitCredits(uid, creditsUsed);

        // Usage history is useful but must never fail the request.
        void recordUsage(uid, {
          generatorId: activeGenerator.id,
          creditsUsed,
          inputTokens: final.usage.input_tokens ?? 0,
          outputTokens: final.usage.output_tokens ?? 0,
          assetId,
        }).catch(() => {});

        send({ type: "done", assetId, title, creditsUsed, creditsRemaining });
      } catch (error) {
        // A client disconnect is normal, not an error worth reporting.
        const aborted =
          request.signal.aborted ||
          (error instanceof Error && error.name === "AbortError");
        if (!aborted) {
          console.error("[generate]", error);
          const message =
            error instanceof Error && /permission|denied|403/i.test(error.message)
              ? "The server is not authorised to call Vertex AI. Check that the service account has roles/aiplatform.user and that the model is enabled in Model Garden."
              : "Generation failed. Please try again.";
          send({ type: "error", message });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by a client disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Cloud Run sits behind a proxy that will otherwise buffer the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
