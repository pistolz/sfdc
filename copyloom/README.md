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
| Model | Claude on **Vertex AI** | Keyless via ADC, and model spend lands on the same GCP bill |
| Auth | Firebase Authentication | Google + email/password, no password storage of our own |
| Sessions | httpOnly Firebase session cookies | Not readable by browser JS; revocation checked per request |
| Database | Firestore (Native) | Serverless, per-user document tree, scales with the app |
| Payments | Stripe | Checkout + Billing Portal + webhooks |
| Secrets | Secret Manager | Injected into Cloud Run; nothing in the image |
| IaC | Terraform | The whole stack is reproducible from `infra/` |

### There is no model API key

`AnthropicVertex` authenticates with Application Default Credentials. On Cloud
Run that is the attached service account, which holds `roles/aiplatform.user`.
Nothing to store, nothing to rotate, nothing to leak.

### Request path

```
Browser ──▶ Firebase Auth (browser SDK) ──▶ ID token
        └─▶ POST /api/auth/session ─────────▶ httpOnly session cookie
              │
Browser ──▶ POST /api/generate (cookie) ──▶ verify session (revocation-checked)
                                          ├─▶ load brand kit  (users/{uid}/brands)
                                          ├─▶ Vertex AI (ADC, streaming)
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
weighted = input + 5 x output + 1.25 x cache_write + 0.1 x cache_read
credits  = ceil(weighted / 1000)
```

The 5x output weighting mirrors Claude's price ratio, so one credit maps to a
roughly constant cost whatever mix of generators people use. A typical run
(~2k in, ~1.5k out) costs 10 credits. Plan allowances in `src/lib/plans.ts` are
set for roughly a 70% gross margin — retune `credits` there if you change model
or pricing; nothing else needs to move.

The role prompt and brand kit are identical on every run for a given user, so
they sit behind a `cache_control` breakpoint and repeat generations get cheaper.

## Layout

```
src/lib/          domain core
  plans.ts          plan catalog, Stripe price binding, brand limits
  generators.ts     the 8 generators and their prompts  <- the product
  credits.ts        usage metering
  firestore.ts      all data access, tenant-scoped
  session.ts        session cookie mint/verify
  vertex.ts         Claude on Vertex AI via ADC
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

`VERTEX_MODEL` (default `claude-opus-5`). Claude models must be enabled
individually in your project's Vertex AI Model Garden — if Opus 5 is not enabled
on your project, set `VERTEX_MODEL=claude-sonnet-5` and everything else works
unchanged. `thinking` is deliberately not sent: Opus 5 and Sonnet 5 both run
adaptive thinking by default, so omitting it keeps the request valid across
whichever model you point at.
