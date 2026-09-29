---
name: gcp-saas-foundation
description: >-
  Build and ship a real multi-tenant, subscription-billed SaaS entirely on Google Cloud —
  Cloud Run + Firestore + Firebase Auth + Vertex AI (Gemini) + Stripe, provisioned with
  Terraform and deployed via Cloud Build. Carries a proven architecture, idempotent
  provisioning scripts, and a catalogue of the specific failures that break a first deploy
  (Cloud Run not injecting GOOGLE_CLOUD_PROJECT, a missing IAM role silently breaking every
  login, Vertex quota being zero for some models, .gcloudignore disabling the .gitignore
  fallback). Use whenever the user wants to build, scaffold, or deploy a SaaS, web app with
  user accounts, AI product, or anything needing login plus payments on GCP, Cloud Run,
  Firebase, or Vertex AI — and when they are only partway there, e.g. "add auth to my app",
  "deploy this to Cloud Run", "why does my Firebase login 500", "call Gemini without an API
  key", or "set up Stripe subscriptions" — even if they never say "SaaS" or name these
  services.
---

# GCP SaaS Foundation

A working, deployed reference architecture for SaaS on Google Cloud. Everything here has
been run against a real project end to end: account creation, session cookies, a streamed
Gemini generation, per-user data in Firestore, and usage-based metering.

The point of this skill is that **the foundation is the same for every idea**. Only the
domain logic and UI change. Reuse the architecture, the provisioning scripts, and above all
the failure catalogue — most of the time lost on a build like this goes to five or six
specific, non-obvious traps.

## Start here

1. Read `references/gotchas.md` **before writing any code or running any deploy.** It is the
   highest-value file in this skill. Each entry is a real failure with its symptom and fix.
   Several of them fail *silently* or fail in a way that points at the wrong cause.
2. Skim `references/architecture.md` for the layout, data model, auth flow and metering.
3. Use `scripts/provision.sh` and `scripts/firebase-setup.sh` to stand up a project. They are
   idempotent — safe to re-run.
4. Use `references/vertex-gemini.md` when wiring the model.
5. Use `scripts/smoke-test.sh` to prove the deployment actually works, not just that it built.

## The stack, and why each piece

| Concern | Choice | Why this one |
|---|---|---|
| Hosting | Cloud Run, one container | Scales to zero, scales out under load, no cluster |
| Model | Gemini on **Vertex AI** | Keyless via ADC; model spend lands on the same GCP bill |
| Auth | Firebase Authentication | Google + email/password; no password storage of your own |
| Sessions | httpOnly Firebase session cookies | Unreadable by browser JS; revocation checked per request |
| Database | Firestore Native | Serverless, natural per-user document tree |
| Payments | Stripe | GCP has no product for billing *your* users |
| Secrets | Secret Manager | Injected into Cloud Run; nothing baked into the image |
| IaC | Terraform | Whole stack reproducible from `infra/` |

**Stripe is the one non-GCP piece and that is unavoidable.** Cloud Billing bills *you* for
infrastructure; it does not bill your customers. If the user insists on "only GCP", say this
plainly rather than inventing a substitute. Offer Paddle or Lemon Squeezy as alternatives if
they want a merchant of record that handles EU VAT and US sales tax, which Stripe does not.

## Non-negotiables

These are the decisions that make the difference between a demo and something you can put a
customer on. Explain the reasoning rather than just asserting them.

**Keyless model access.** Construct the Vertex client with ADC and give the Cloud Run service
account `roles/aiplatform.user`. There is then no model API key to store, rotate, or leak, and
usage appears on the same bill as everything else. This is strictly better than an API key and
costs nothing to set up.

**The uid always comes from the verified session, never from request input.** Root every
Firestore path at `users/{uid}`. There should be no code path where a uid supplied by a client
selects whose data is read. This single rule is what makes the app multi-tenant safe.

**Deny-all Firestore rules, and deploy them.** The browser never talks to Firestore directly;
all access goes through API routes using the Admin SDK, which bypasses rules by design. Rules
denying everything mean a leaked web API key — and web API keys are public by nature, they ship
in the JS bundle — exposes nothing. Rules are not applied automatically; deploy them
(`scripts/firebase-setup.sh` does).

**Serve public client config at runtime, not build time.** Read Firebase's web config on the
server and pass it into a client component as a prop instead of inlining `NEXT_PUBLIC_*` at
build. One container image then promotes across dev/staging/prod by changing only env vars.

**Meter on real token usage, not per-action.** Charge credits derived from the token counts the
API returns. A flat per-generation fee either loses money on long outputs or overcharges short
ones. See `references/architecture.md` for the weighting formula and how to retune it when the
model changes.

**Read env lazily.** Access every environment variable inside a function at request time, never
at module load. `next build` then succeeds in CI without production secrets present.

## Build order that works

Doing it in this order surfaces the expensive problems early, while they are still cheap.

1. **Prove model access first.** Before writing a line of app code, curl the model endpoint in
   the target project. Quota and availability vary by model *and* location, and finding out
   after you have built everything is the worst time. `references/gotchas.md` §1 covers this.
2. Domain core: plan catalog, the prompts/logic that make the product, metering, types.
3. Data layer and session auth. This is the trust boundary; write it carefully and by hand.
4. API routes, then UI.
5. Infra, then deploy, then a real end-to-end test against the deployment.

Parallelise steps 2–5 across subagents when available: billing, UI, and infra have clean
boundaries. Give each agent an explicit file-ownership list and the exact interfaces it
consumes, or they will collide.

## Verifying, honestly

A green build proves almost nothing. The bug that broke login in the reference build
(`gotchas.md` §2) passed typecheck, tests, and a production build, and only appeared when a
real user signed up.

Run all of these before telling the user it works:

- `tsc --noEmit`, the unit suite, and a production build.
- The service running locally with dummy env: unauthenticated requests must 401, protected
  pages must redirect, webhook endpoints must reject forged signatures.
- **A real end-to-end run against the deployment**: create a user, exchange the token for a
  session, perform the core action, confirm data persisted and usage was charged.
  `scripts/smoke-test.sh` does exactly this.

If your environment's egress blocks `*.run.app` (sandboxes often do), run the end-to-end test
as a Cloud Build step instead — it executes from Google's network and can reach the service.
`scripts/smoke-test.sh` is written for that.

## Reference files

| File | Read it when |
|---|---|
| `references/gotchas.md` | **Always, first.** Every real failure, its symptom, and its fix |
| `references/architecture.md` | Laying out the app, data model, auth flow, metering |
| `references/vertex-gemini.md` | Wiring the model, streaming, usage metadata |
| `references/deploy-runbook.md` | Deploying, or debugging a deploy |
| `scripts/provision.sh` | Standing up project, APIs, Firestore, registry, IAM |
| `scripts/firebase-setup.sh` | Enabling auth, creating the web app, deploying rules |
| `scripts/smoke-test.sh` | Proving a deployment actually works |

## Adapting this to a new idea

What stays: auth, sessions, tenant isolation, billing, metering, infra, deploy, and the whole
gotcha list. What changes: the domain logic, the prompts, and the UI.

Concretely, for a new product you rewrite the equivalent of `plans.ts` (pricing), the domain
module that defines what the product actually does, and the pages. Everything else transfers
essentially unchanged. Budget your effort accordingly — and resist rebuilding the foundation,
because the parts that look boring are the parts that took the longest to get right.
