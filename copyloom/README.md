# Copyloom

An AI marketing content SaaS. Users brief the product once on their brand, then
generate newsletters, landing pages, ad copy, social packs, blog posts, outbound
sequences, launch kits and content calendars that sound like them.

Multi-tenant, subscription-billed, and deployed entirely on Google Cloud.

See **[DEPLOY.md](./DEPLOY.md)** for the step-by-step deployment runbook.

## Architecture

| Concern | Choice | Why |
| --- | --- | --- |
| Hosting | Cloud Run (one container) | Scales to zero, scales out under load, no cluster to run |
| Model | Gemini on **Vertex AI** | Keyless via ADC, and model spend lands on the same GCP bill |
| Auth | Firebase Authentication | Google + email/password, no password storage of our own |
| Sessions | httpOnly Firebase session cookies | Not readable by browser JS; revocation checked per request |
| Database | Firestore (Native) | Serverless, per-user document tree, scales with the app |
| Payments | Stripe | Checkout + Billing Portal + webhooks |
| Secrets | Secret Manager | Injected into Cloud Run; nothing in the image |
| IaC | Terraform | The whole stack is reproducible from `infra/` |

### There is no model API key

The Vertex AI client authenticates with Application Default Credentials. On
Cloud Run that is the attached service account, which holds
`roles/aiplatform.user`. Nothing to store, nothing to rotate, nothing to leak —
switching from Claude to Gemini changed the model, not the auth story.

### Request path

```
Browser ──▶ Firebase Auth (browser SDK) ──▶ ID token
        └─▶ POST /api/auth/session ─────────▶ httpOnly session cookie
              │
Browser ──▶ POST /api/generate (cookie) ──▶ verify session (revocation-checked)
                                          ├─▶ load brand kit  (users/{uid}/brands)
                                          ├─▶ Vertex AI · Gemini (ADC, streaming)
                                          ├─▶ SSE deltas back to the browser
                                          └─▶ save asset + debit credits on real usage
```

### Tenant isolation

Every Firestore path is rooted at `users/{uid}`, and the uid always comes from
the verified session cookie — never from request input. `firestore.rules` denies
all direct client access, so the only way to reach data is through an API route
that has already authenticated the caller. A leaked Firebase web API key (they
are public by design) exposes nothing.

## Credits

Credits are metered on **real token usage**, not a flat per-generation fee:

```
weighted = input + 8 x output + 1.25 x cache_write + 0.1 x cache_read
credits  = ceil(weighted / 1000)
```

The 8x output weighting mirrors Gemini 2.5 Pro's price ratio (~$1.25/M input,
~$10/M output), so one credit maps to a roughly constant cost whatever mix of
generators people use. A typical run (~2k in, ~1.5k out) costs 14 credits. Plan
allowances in `src/lib/plans.ts` are set for roughly a 70% gross margin — retune
`credits` there if you change model or pricing; nothing else needs to move.

The role prompt and brand kit are identical on every run for a given user, so
they are sent as the stable prefix of every request and cached tokens make
repeat generations cheaper.

## Layout

```
src/lib/          domain core
  plans.ts          plan catalog, Stripe price binding, brand limits
  generators.ts     the 8 generators and their prompts  <- the product
  credits.ts        usage metering
  firestore.ts      all data access, tenant-scoped
  session.ts        session cookie mint/verify
  vertex.ts         Gemini on Vertex AI via ADC
  stripe.ts         billing client
src/app/api/      route handlers (generate is SSE)
src/app/          pages
infra/            Terraform for the whole stack
```

## Local development

```bash
npm install
gcloud auth application-default login   # gives ADC for Vertex + Firestore
cp .env.example .env.local              # fill in Firebase + Stripe values
npm run dev
```

`npm test` runs the unit suite; `npm run typecheck` runs `tsc --noEmit`.

## Changing the model

`VERTEX_MODEL` (default `gemini-2.5-pro`), served from `VERTEX_REGION` (default
`global`). Gemini needs no Model Garden acceptance — the models are available as
soon as `aiplatform.googleapis.com` is enabled on the project. Set
`VERTEX_MODEL=gemini-2.5-flash` for a cheaper and faster alternative; both
`gemini-2.5-pro` and `gemini-2.5-flash` are verified working on `global` and on
`us-central1`, and everything else works unchanged.

`gemini-3-pro-preview` is **not** available and returns 404. A model ID that is
wrong, or that is not served in the location you pinned, fails the same way — see
the troubleshooting section of [DEPLOY.md](./DEPLOY.md).

If you point this at a Claude model instead, expect an HTTP 429
`RESOURCE_EXHAUSTED` on a fresh project: the per-base-model quota for Anthropic
models defaults to zero and has to be raised by request. DEPLOY.md covers it.
