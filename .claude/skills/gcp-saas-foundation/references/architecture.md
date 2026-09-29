# Architecture

The reusable shape: where code lives, how tenants stay isolated, how a request is
authenticated, and how usage becomes money. The worked example is a marketing-copy generator;
nothing below depends on that.

Failures cited as "gotcha §N" live in `references/gotchas.md`. Read that first.

**Contents**

- [1. Directory layout](#1-directory-layout)
- [2. Firestore data model](#2-firestore-data-model)
- [3. Auth flow, end to end](#3-auth-flow-end-to-end)
- [4. Transactional patterns](#4-transactional-patterns)
- [5. Usage metering](#5-usage-metering)
- [6. Subscription billing](#6-subscription-billing)
- [7. Request validation](#7-request-validation)
- [8. What to change for a new product](#8-what-to-change-for-a-new-product)

---

## 1. Directory layout

```
src/
  lib/                    domain core. Plain TypeScript; no HTTP, no JSX.
    env.ts                lazy env access (gotcha §3, §15)
    types.ts              record shapes shared by server and browser
    plans.ts              plan catalog — single source of truth for pricing
    credits.ts            metering: token usage -> credits (pure, unit-tested)
    <domain>.ts           what the product actually does
    firebase-admin.ts     Admin SDK singleton, ADC
    firebase-client.ts    browser SDK init, from config handed down at runtime
    session.ts            mint / verify / destroy the session cookie
    firestore.ts          every read and write, all rooted at users/{uid}
    api.ts                route wrapper: auth + uniform error mapping
    validate.ts           untrusted input -> typed input
    vertex.ts, stripe.ts  provider clients and pure mapping helpers
  app/
    api/**/route.ts       thin handlers: parse, authorise, delegate, respond
    **/layout.tsx         auth guard: no session -> redirect
    **/page.tsx           server components — fetch initial data, render
  components/             client components — interactivity only
```

- **Only `lib/firestore.ts` touches the database** — one file to audit for tenant isolation.
- **Route handlers hold no domain logic** — logic is unit-tested without HTTP, and handlers
  become correct by inspection. **`lib/` imports no framework routing**, so the core stays
  testable in a plain runner.
- **Server components fetch, client components interact.** Initial data ships in the HTML: no
  first-paint spinner, no extra round trip.
- **Server modules open with `import "server-only"`**, so a stray client import fails the build
  instead of pulling Admin SDK into the bundle. It is a real package (gotcha §17).

```ts
export default async function DashboardPage() {
  const user = await getSessionUser();            // the layout already guarded
  if (!user) return null;
  const [record, items] = await Promise.all([
    ensureUserRecord(user), listItems(user.uid, { limit: 6 }),
  ]);
  return <Dashboard account={toAccountView(record)} items={items} />;
}
```

`toAccountView` narrows the stored record to what the browser may see — provider customer IDs
stay server-side. Handlers are wrapped, not repeated:
`export const GET = withAuth(async ({ user, account }) => …)`. `withAuth` resolves the session,
ensures the user record exists, and maps `UnauthorizedError` to 401 and everything else to a
generic 500, so no handler sees an unauthenticated request or a uid from the body.

---

## 2. Firestore data model

Everything a user owns hangs off one document.

| Path | Kind | Contents |
|---|---|---|
| `users/{uid}` | document | plan, `credits`, `creditsGranted`, `periodEnd`, provider customer/subscription IDs, status, denormalised profile, timestamps |
| `users/{uid}/<entity>/{id}` | subcollection | per-user entities, one subcollection per type |
| `users/{uid}/usage/{auto}` | subcollection | one record per metered action: cost, tokens, what produced it |
| `<provider>Events/{eventId}` | top-level | webhook idempotency claims (§6) |

Paths are built in exactly one place:

```ts
const userDoc  = (uid: string) => db().collection("users").doc(uid);
const itemsCol = (uid: string) => userDoc(uid).collection("items");
```

**The uid always comes from the verified session, never from request input.** Every exported
function takes `uid` first; every caller passes `user.uid` from `requireUser()`. No code path
lets a client-supplied identifier choose whose data is read.

That is what makes it multi-tenant safe, and it beats the filter-based alternative: a
`where("ownerUid","==",uid)` clause is a check you can forget on one query out of forty, whereas
rooting paths at `users/{uid}` turns an omission into a broken query rather than a leak. It also
makes the authorisation bug inexpressible — a foreign ID is not a denied read, it is a miss:

```ts
const item = await getItem(user.uid, requestedId);   // wrong subtree -> null
if (!item) return jsonError("Not found.", 404);
```

The webhook-event collection is the deliberate exception: the event arrives before you know
which account it belongs to, and the provider's event ID is globally unique.

Two supporting decisions: **deny-all security rules, actually deployed** — the browser never
talks to Firestore and the Admin SDK bypasses rules by design, so a leaked web API key (public
by nature) exposes nothing (gotcha §13); and **`ignoreUndefinedProperties: true`** on the
Firestore instance, so an optional field left `undefined` on a partial update is absent rather
than fatal.

---

## 3. Auth flow, end to end

```
browser SDK sign-in -> ID token -> POST /api/auth/session -> httpOnly cookie
                                          |
                                 verifyIdToken(token, true)
                                 createSessionCookie(token)
                                          |
   every later request -> verifySessionCookie(cookie, checkRevoked = true) -> uid
```

The browser signs in with the Firebase web SDK, using public config read on the server per
request and passed into the client component as a prop — never inlined at build time, so one
image promotes across environments (gotcha §15). It posts the resulting ID token once: the token
is never the ongoing credential, only something to exchange. The server verifies, then mints:

```ts
const auth = adminAuth();
await auth.verifyIdToken(idToken, true);              // a forged token can't become a session
const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
(await cookies()).set(SESSION_COOKIE, cookie, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_MS / 1000,
});
```

`createSessionCookie()` calls the Identity Toolkit *admin* API, so the runtime service account
needs `roles/firebaseauth.admin`. Without it sign-up succeeds and login 500s forever — the most
expensive failure in this stack (gotcha §2). Every later request then calls
`adminAuth().verifySessionCookie(cookie, true)`.

| Choice | Why |
|---|---|
| Session cookie, not the ID token | ID tokens last an hour and need client JS to refresh; a session cookie lasts days and is sent automatically |
| `httpOnly` | The JS bundle cannot read it, so an XSS bug cannot exfiltrate the session |
| `secure` + `sameSite: "lax"` | Never sent in plaintext; not sent on cross-site POSTs, blunting CSRF while normal navigation still works |
| `verifySessionCookie(..., true)` | The `true` is revocation checking: sign-out, a password change or a disabled account takes effect on the **next request** rather than at token expiry. One lookup per request; correctness is worth it |
| A bad cookie returns `null`, never throws | Expired, revoked and tampered-with all mean one thing to the app: signed out |

Page enforcement lives in a single layout (`getSessionUser()` then `redirect("/login")`), so a
new authenticated page inherits the guard. API enforcement lives in `withAuth`.

---

## 4. Transactional patterns

**Create the user record on first sight without double-granting.** Two requests can arrive
concurrently for a brand-new user — a page load and an XHR from the same sign-in. A
read-then-write lets both see "no document" and both grant a starting balance.

```ts
export async function ensureUserRecord(user: SessionUser): Promise<UserRecord> {
  const ref = userDoc(user.uid);
  const now = Date.now();
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const record = { uid: user.uid, plan: "free", credits: PLANS.free.credits,
                       creditsGranted: PLANS.free.credits, periodEnd: now + FREE_PERIOD_MS,
                       createdAt: now, updatedAt: now /* ... */ };
      tx.set(ref, record);
      return record;
    }
    const record = snap.data() as UserRecord;
    // Free tier refills on a rolling window; paid periods come from the billing
    // webhook, so this branch is only a safety net for them.
    if (record.plan === "free" && now > record.periodEnd) { /* grant, update, return */ }
    if (record.email !== user.email) { /* resync profile, return */ }
    return record;
  });
}
```

Firestore aborts and retries a transaction whose read set changed, so exactly one concurrent call
creates the document. Call it from the auth wrapper rather than a "create account" endpoint:
there is then no window where a signed-in user has no record, and no provisioning step to fail.

**Debit atomically, floored at zero.**

```ts
export async function debitCredits(uid: string, amount: number): Promise<number> {
  if (amount <= 0) return (await getUserRecord(uid))?.credits ?? 0;
  const ref = userDoc(uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 0;
    const next = Math.max(0, ((snap.data() as UserRecord).credits ?? 0) - amount);
    tx.update(ref, { credits: next, updatedAt: Date.now() });
    return next;
  });
}
```

*Why not `FieldValue.increment(-n)`.* Increment is atomic and cheaper but cannot enforce a floor
or return the resulting balance — and the UI shows that balance immediately after the action.

*Why the floor is the right call.* The pre-flight check is "any credits left?", not "enough for
this run": the true cost is unknown until the model finishes, so one action can legitimately cost
more than the balance. The alternatives are refusing the action after the work is done and paid
for, or carrying a negative balance — a debt you will never collect and a number nobody
understands. Absorbing an overshoot bounded by one action's cost, i.e. cents, beats both.

Everything derived from a run happens *after* it completes with real numbers: save the artefact,
debit, then record usage best-effort (`void recordUsage(...).catch(() => {})`) — history is
useful but must never fail the request the user paid for.

---

## 5. Usage metering

Charge on real token usage, not per action. A flat fee either loses money on long outputs or
overcharges short ones, and it stops you offering a cheap fast action alongside an expensive one
on the same allowance.

```ts
export const TOKENS_PER_CREDIT = 1000;
const OUTPUT_WEIGHT = 8;                     // mirrors the model's output:input price ratio

export function weightedTokens(u: TokenUsage): number {
  return (u.input_tokens ?? 0) + (u.output_tokens ?? 0) * OUTPUT_WEIGHT;
}

/** Always at least 1, so nothing is free. */
export function creditsForUsage(u: TokenUsage): number {
  return Math.max(1, Math.ceil(weightedTokens(u) / TOKENS_PER_CREDIT));
}
```

**Why the multiplier mirrors the price ratio.** Gemini 2.5 Pro on Vertex is roughly $1.25 per 1M
input against ~$10 per 1M output — an 8:1 ratio. Weighting output by that ratio makes one credit
map to a roughly constant *real cost*, whether an action is prompt-heavy (long context, short
answer) or output-heavy (short brief, long answer). Any other multiplier makes one class of
action subsidise the other, and users will find whichever is profitable for them.

**Retuning for a new model.** Set `OUTPUT_WEIGHT = round(output_price / input_price)` from the
new model's published per-million prices, and choose `TOKENS_PER_CREDIT` separately — it fixes
what one credit is worth, so pick it to keep the numbers legible (1,000 weighted tokens is on the
order of a tenth of a cent at the rates above). Swapping models without revisiting the weight
breaks nothing visibly; it quietly moves your margin.

**Cross-reference: gotcha §16.** The plan catalog carries hand-written strings like "200 credits
per month (~14 generations)". Those numbers are a function of `OUTPUT_WEIGHT` and typical action
size, and nothing recomputes them — change the weighting and each becomes a false claim with no
test failing. Derive the advertised number from `creditsForUsage()`, or add a test that parses
the marketing string and compares.

Keep the UI's pre-flight estimate a separate, deliberately rough function — assume an action
lands near half its output ceiling — so nobody is ever tempted to bill from an estimate.

---

## 6. Subscription billing

**The plan catalog is the single source of truth.** One `PLANS` record holds id, name, price,
allowance, entity limits, marketing copy, and the *name of the env var* holding the provider
price ID — not the price ID itself, so the same catalog serves test and live mode.

```ts
const stripePriceId = (id: PlanId) =>
  PLANS[id].priceEnvVar ? process.env[PLANS[id].priceEnvVar!] || null : null;

/** Reverse lookup, used by the webhook to map a price back to a plan. */
export function planIdForStripePrice(priceId: string): PlanId | null {
  for (const id of PLAN_ORDER) if (stripePriceId(id) === priceId) return id;
  return null;
}
```

**Never trust a plan sent by the client.** A checkout endpoint may take a plan id to decide which
price to *offer*, but entitlement always resolves the other way: the webhook reads the price ID
off the subscription or invoice and maps it back to a plan, and an unknown price falls back to
free rather than granting an arbitrary allowance. A client posting `{"plan":"agency"}` gets an
agency checkout session, not an agency plan. Validate plan ids with
`Object.prototype.hasOwnProperty.call(PLANS, value)`, never `in` (gotcha §8).

**Webhook idempotency via a claim-once record.** Providers retry until they see a 2xx and can
deliver the same event twice. Claim the event *before* any side effect, with a create-only write
so two concurrent deliveries cannot both proceed:

```ts
export async function claimStripeEvent(eventId: string): Promise<boolean> {
  try {
    // create() throws if the document already exists — that is the whole guard.
    await db().collection("stripeEvents").doc(eventId).create({ processedAt: Date.now() });
    return true;
  } catch { return false; }
}
```

That is what stops a retry of a payment event granting a second period of credits. The
trade-off: an event whose handler then crashes stays claimed — so verify the signature *before*
claiming, and return 500 on genuine failures so the provider retries.

**Refill the allowance exactly once per period.** Subscription-updated events arrive constantly:
payment-method changes, trial transitions, prorations, plan switches. Reset credits on each and
a user refills their allowance by opening the billing portal. So the state-applying function
takes an explicit flag:

| Event | Plan / status | `resetCredits` |
|---|---|---|
| `checkout.session.completed` | updated | **true** — a new paid period just began |
| `invoice.paid` | updated | **true** — the one place a renewal refills |
| `customer.subscription.created` / `.updated` | updated | false |
| `customer.subscription.deleted` | back to free | false |
| `invoice.payment_failed` | status only, plan kept | false |

`past_due` deliberately keeps the paid plan: the subscription is live and the provider is still
retrying. Cancellation, if it comes, arrives as its own event.

Read period boundaries and price IDs defensively — provider APIs move fields between versions (in
the 2025 Stripe versions, period fields moved from the subscription root onto the subscription
*item*, and invoice line prices under `pricing.price_details.price`). Keep those lookups in small
pure helpers with fallbacks, unit-tested against captured payloads: they are the likeliest thing
to break on an API version bump.

**Billing is optional infrastructure.** Gate the secrets and the container's secret env vars on
whether a key was supplied, and let the app report "billing not configured" instead of showing
buttons that cannot work — Cloud Run will not start a revision referencing a missing secret
(gotcha §5), and Secret Manager rejects an empty payload (gotcha §6).

---

## 7. Request validation

Coerce untrusted input against a known field list. Never spread a request body into a stored
document.

```ts
export function parseItemInput(raw: unknown):
  { ok: true; value: ItemInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Expected an object." };
  const source = raw as Record<string, unknown>;
  const value = { ...EMPTY_ITEM };                    // the known field list, with defaults

  for (const key of Object.keys(EMPTY_ITEM) as (keyof ItemInput)[]) {
    const incoming = source[key];
    if (incoming === undefined || incoming === null) continue;
    if (typeof incoming !== "string") return { ok: false, error: `"${key}" must be text.` };
    if (incoming.length > limitFor(key)) return { ok: false, error: `"${key}" is too long.` };
    value[key] = incoming.trim();
  }
  return value.name ? { ok: true, value } : { ok: false, error: "A name is required." };
}
```

The loop iterates over **your** field list, not the caller's keys. Unknown keys are dropped
rather than merged, so a client cannot smuggle `plan: "agency"` or `credits: 99999` into a
document later read back as trusted state. Caps apply before any value reaches a prompt or a
stored record, and the result is a discriminated union rather than an exception, so the route
maps it straight to a 400 the user can act on. An off-the-shelf schema validator does the same
job; what matters is the allow-list direction, and that the parsed value — never the raw body —
is what gets stored.

---

## 8. What to change for a new product

| File | New product |
|---|---|
| `lib/plans.ts` | **Rewrite** — names, prices, allowances, limits, copy |
| `lib/<domain>.ts` | **Rewrite** — this is the product |
| `lib/types.ts` | **Extend** — keep `UserRecord`, replace the entity types |
| `lib/validate.ts` | **Adapt** — same pattern, your fields |
| `lib/credits.ts` | **Retune** `OUTPUT_WEIGHT` if the model changed; else unchanged |
| `lib/firestore.ts` | **Split** — user/billing half verbatim, entity subcollections swapped |
| `app/**/page.tsx`, `components/` | **Rewrite** — the UI is the product's face |
| `lib/session.ts`, `lib/api.ts`, `lib/firebase-*.ts`, `lib/env.ts` | **Unchanged** |
| `lib/vertex.ts`, `lib/stripe.ts` | **Unchanged** — model id and price env var names are config |
| `app/api/auth/session`, `app/api/webhooks/*`, `app/api/me` | **Unchanged** |
| `Dockerfile`, `cloudbuild.yaml`, `infra/`, `firestore.rules` | **Rename only** — service, repo, secret ids |

The trust boundary, the money and the plumbing transfer; the product does not. Budget
accordingly, and resist rebuilding the foundation — the boring parts took the longest to get
right.
