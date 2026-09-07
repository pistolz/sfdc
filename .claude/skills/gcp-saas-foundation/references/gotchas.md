# Failure catalogue

Every entry here is a real failure from a real build, with the symptom you will actually see
and the fix. They are ordered roughly by how much time they cost.

Several of these fail *silently* or point at the wrong cause, which is what makes them
expensive. A green build proves none of them are absent.

**Contents**

- [1. Vertex model quota is zero on new projects](#1)
- [2. Login 500s after signup succeeds — missing firebaseauth.admin](#2)
- [3. Cloud Run does not inject GOOGLE_CLOUD_PROJECT](#3)
- [4. Creating .gcloudignore disables the .gitignore fallback](#4)
- [5. Cloud Run will not start a revision referencing a missing secret](#5)
- [6. Secret Manager rejects an empty payload](#6)
- [7. terraform.tfvars is not gitignored and holds live secrets](#7)
- [8. `in` matches prototype keys](#8)
- [9. Firebase REST with user credentials needs a quota-project header](#9)
- [10. Billing account project quota](#10)
- [11. A preset CLOUDSDK_AUTH_ACCESS_TOKEN silently overrides gcloud login](#11)
- [12. Firebase authorized domains, and Cloud Run's two URLs](#12)
- [13. Firestore rules are not deployed automatically](#13)
- [14. SSE streaming through Cloud Run](#14)
- [15. Build-time vs runtime public config](#15)
- [16. Changing token weighting silently falsifies pricing copy](#16)
- [17. Assorted smaller traps](#17)

---

<a id="1"></a>
## 1. Vertex model quota is zero on new projects

**Symptom.** `HTTP 429 RESOURCE_EXHAUSTED`, "Quota exceeded for
aiplatform.googleapis.com/global_online_prediction_requests_per_base_model with base model:
X. Please submit a quota increase request."

**Why it matters.** This is *not* a permissions problem, an enablement problem, or a
rate-limit-from-hammering problem. On a brand-new project the per-base-model quota for some
models defaults to **zero**, so the very first request fails. Fixing it means filing a quota
increase and waiting — potentially days.

**What was observed.** Claude models returned 429 on the global endpoint and 404 on every
regional endpoint. Gemini (`gemini-2.5-pro`, `gemini-2.5-flash`) returned 200 on both `global`
and `us-central1` with default quota.

**Fix.** Probe the model *before* building anything on it:

```bash
TOKEN=$(gcloud auth print-access-token)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "https://aiplatform.googleapis.com/v1/projects/$PROJECT/locations/global/publishers/google/models/gemini-2.5-pro:generateContent" \
  -d '{"contents":[{"role":"user","parts":[{"text":"say ok"}]}]}' -w "\n[%{http_code}]\n"
```

Read the status code as a diagnosis: **200** good · **404** wrong model name or not served in
that location · **403** the caller lacks `roles/aiplatform.user` · **429** zero quota, pick a
different model or file for an increase.

Also: availability differs by location. Test the exact `(model, location)` pair you intend to
ship, not just the model. And model names are bare on Vertex — `gemini-2.5-pro`, no
`publishers/google/` prefix inside the SDK and no date suffix.

---

<a id="2"></a>
## 2. Login 500s after signup succeeds — missing `firebaseauth.admin`

**Symptom.** Browser-side sign-up works and the account appears in Firebase. Exchanging the ID
token for a session cookie then returns 500. The server log says: *"Credential implementation
provided to initializeApp() via the 'credential' property has insufficient permission to
access the requested resource."*

**Why it matters.** This is the worst-shaped failure in the whole stack: the user account is
**created**, then login fails forever. It looks like a code bug, it survives every local test
(local dev uses your own credentials, which have permission), and it passes typecheck, unit
tests and a production build.

**Cause.** The Admin SDK's `createSessionCookie()` calls the Identity Toolkit *admin* API. The
runtime service account needs `roles/firebaseauth.admin`. `verifyIdToken()` does not need it —
it validates against public keys — so partial auth flows can mislead you into thinking
permissions are fine.

**Fix.** Grant it to the runtime service account, and put it in your IaC so a fresh deploy does
not reproduce it:

```
roles/aiplatform.user            # Vertex, keyless
roles/datastore.user             # Firestore
roles/secretmanager.secretAccessor
roles/firebaseauth.admin         # session cookies  <-- easy to miss
```

---

<a id="3"></a>
## 3. Cloud Run does not inject `GOOGLE_CLOUD_PROJECT`

**Symptom.** Client libraries fail to determine the project at runtime, or your own env
validation throws, only in the deployed service.

**Cause.** Automatic `GOOGLE_CLOUD_PROJECT` injection is an **App Engine and Cloud Functions**
behaviour. Cloud Run injects only `PORT`, `K_SERVICE`, `K_REVISION`, `K_CONFIGURATION`. This is
widely misremembered, including in a lot of published advice.

**Fix.** Set it explicitly on the service in Terraform and in any `gcloud run deploy`.

---

<a id="4"></a>
## 4. Creating `.gcloudignore` disables the `.gitignore` fallback

**Symptom.** A `gcloud builds submit` that used to upload ~500 KB suddenly uploads hundreds of
megabytes and takes minutes, or the build fails on context size.

**Cause.** With no `.gcloudignore`, gcloud falls back to `.gitignore`. The moment a
`.gcloudignore` exists — for any reason — that fallback is **off** and only the new file's
rules apply. In the reference build the difference was **945 MB vs 491 KB**, because
`node_modules` stopped being excluded.

**Fix.** Write `.gcloudignore` explicitly and completely. Include dependencies (the Dockerfile
reinstalls them), build output, and anything holding local state or secrets:

```
.git/
node_modules/
.next/
.env
.env.local
infra/.terraform/
infra/terraform.tfvars
infra/*.tfstate
```

---

<a id="5"></a>
## 5. Cloud Run will not start a revision referencing a missing secret

**Symptom.** Deploy fails, or the revision never becomes ready, when a secret env var points at
a Secret Manager secret that does not exist.

**Why it matters.** This is what makes "ship now, add billing later" fail. If Stripe env vars
are wired unconditionally, a user who has not set up Stripe cannot deploy at all.

**Fix.** Make optional integrations genuinely conditional. In Terraform, gate the secret
resources and the container's secret env vars on whether a key was supplied
(`billing_enabled = var.stripe_secret_key != ""`, with `for_each` over a map that is empty when
false). In deploy scripts, check whether the secret exists and only then add `--update-secrets`,
warning rather than exiting. The app should degrade to "billing not configured" rather than
showing buttons that cannot work.

---

<a id="6"></a>
## 6. Secret Manager rejects an empty payload

**Symptom.** Terraform apply fails creating a secret version when the value is `""`.

**Where it bites.** A Stripe webhook signing secret is genuinely circular — it cannot be known
until the service URL exists, and the service needs the secret to start.

**Fix.** Seed a placeholder value on first apply and document a two-pass flow: apply → create
the webhook against the real URL → set the real secret → apply again. The webhook simply
rejects signatures until the real value lands, which is the correct safe behaviour.

---

<a id="7"></a>
## 7. `terraform.tfvars` is not gitignored and holds live secrets

**Symptom.** None — that is the problem. A routine `git add -A` commits a live API key.

**Fix.** Add these before writing any tfvars file:

```
infra/terraform.tfvars
infra/*.auto.tfvars
infra/*.tfstate          # state can contain secrets too
```

Verify with `git check-ignore -v infra/terraform.tfvars` rather than assuming.

---

<a id="8"></a>
## 8. `in` matches prototype keys

**Symptom.** A validation guard passes for junk input like `"constructor"`, `"toString"`, or
`"__proto__"`, and a lookup returns a function or `undefined` where a domain object was
expected.

```js
const PLANS = { free: {...}, pro: {...} };
"constructor" in PLANS          // true  <-- via the prototype chain
```

**Fix.** `Object.prototype.hasOwnProperty.call(PLANS, value)`. This applies to any
"is this a valid id?" guard backed by an object literal — plan ids, generator ids, route keys.

---

<a id="9"></a>
## 9. Firebase REST with user credentials needs a quota-project header

**Symptom.** `HTTP 403`: *"Your application is authenticating by using local Application
Default Credentials. The firebase.googleapis.com API requires a quota project, which is not set
by default."*

**Fix.** Send `x-goog-user-project: $PROJECT_ID` alongside the bearer token on every call to
`firebase.googleapis.com`, `identitytoolkit.googleapis.com` and `firebaserules.googleapis.com`.

---

<a id="10"></a>
## 10. Billing account project quota

**Symptom.** `FAILED_PRECONDITION: Cloud billing quota exceeded` when linking billing, even
though the account is open and healthy.

**Cause.** A billing account caps how many projects it can pay for.

**Fix.** Try another open billing account before assuming something is broken. List with
`gcloud billing accounts list` and check the `OPEN` column; loop over the open ones and verify
with `gcloud billing projects describe $P --format='value(billingEnabled)'`.

---

<a id="11"></a>
## 11. A preset `CLOUDSDK_AUTH_ACCESS_TOKEN` silently overrides `gcloud auth login`

**Symptom.** You log in successfully, `gcloud auth list` shows the right account, and then
every command fails with `UNAUTHENTICATED ... ACCESS_TOKEN_TYPE_UNSUPPORTED`. The error text
mentions the env var, but easy to miss.

**Cause.** Some managed and CI environments preset `CLOUDSDK_AUTH_ACCESS_TOKEN`. It takes
precedence over stored credentials on every invocation.

**Fix.** Unset it. Because shell state does not persist between tool calls in many agent
harnesses, the robust move is a tiny wrapper used everywhere:

```bash
#!/bin/bash
unset CLOUDSDK_AUTH_ACCESS_TOKEN
exec /path/to/gcloud "$@"
```

---

<a id="12"></a>
## 12. Firebase authorized domains, and Cloud Run's two URLs

**Symptom.** `auth/unauthorized-domain` in the browser on an otherwise working deployment.

**Fix.** Add the deployed host to Firebase's authorized domains after the service exists.

**The subtlety:** Cloud Run answers on **two** hostname formats —
`SERVICE-HASH-REGIONCODE.a.run.app` and `SERVICE-PROJECTNUMBER.REGION.run.app`. Different
commands report different ones. Authorize **both**, or auth breaks depending on which URL the
user happens to open.

---

<a id="13"></a>
## 13. Firestore rules are not deployed automatically

**Symptom.** None visible — the app works. A `firestore.rules` file in your repo has no effect
on the running database until it is published, and the default is permissive enough to matter.

**Fix.** Publish via the Firebase Rules API: create a ruleset, then release it to
`cloud.firestore`. `scripts/firebase-setup.sh` does both. Verify afterwards rather than
assuming.

For this architecture the rules should deny everything, because the browser never talks to
Firestore directly and the Admin SDK bypasses rules by design.

---

<a id="14"></a>
## 14. SSE streaming through Cloud Run

Streaming responses need three things or they arrive as one lump at the end, or get cut off:

- `X-Accel-Buffering: no` on the response, or the proxy in front buffers the whole stream.
- `Cache-Control: no-cache, no-transform`.
- A Cloud Run request `timeout` well above the default 300s (600s is a reasonable ceiling for
  long generations). Set the client-side SDK timeout *below* that so you get a clean error
  rather than a truncated connection.

Also propagate the request's `AbortSignal` upstream to the model call, so a user closing the
tab stops the spend. On abort, do not save and do not charge — you have no usage numbers.

---

<a id="15"></a>
## 15. Build-time vs runtime public config

**Symptom.** You need a separate container image per environment, or a rebuild to change a
public API key.

**Cause.** Framework conventions like `NEXT_PUBLIC_*` inline values at **build** time. Cloud
Run supplies env vars at **run** time. The two do not meet.

**Fix.** Read public client config on the server at request time and pass it into the client
component as a prop. One image then promotes across environments by changing env vars only.
Verify by grepping the built static chunks for the value: it should appear in the rendered HTML
but not in any bundled JS file.

---

<a id="16"></a>
## 16. Changing token weighting silently falsifies pricing copy

**Symptom.** The pricing page advertises "~20 generations" when the real number is now ~14.

**Cause.** Credit cost per action is derived from a token weighting constant. Change the model
(or its price ratio) and every human-written "~N generations" string in the plan catalog
becomes a false claim, with nothing failing.

**Fix.** Derive the advertised number from the same function that charges, or add a test that
does. A test that parses the marketing string and compares it to `creditsForUsage(...)` catches
the drift the moment it happens.

---

<a id="17"></a>
## 17. Assorted smaller traps

**`UID` is readonly in bash.** `while read -r UID EMAIL` fails with *"UID: readonly variable"*.
Use any other name.

**Waiting on a Cloud Build.** Statuses include `QUEUED` before `WORKING`. A loop of
`until [ status != WORKING ]` exits immediately. Test for a terminal status instead:
`SUCCESS|FAILURE|TIMEOUT|CANCELLED|INTERNAL_ERROR|EXPIRED`.

**Build output is not in the submit output.** With `logging: CLOUD_LOGGING_ONLY`, `gcloud
builds submit` prints a summary only. Read step output with
`gcloud builds log <ID> --region <R>`.

**Sandboxed egress.** Agent sandboxes commonly block `*.run.app` and `dl.google.com`. Two
workarounds that worked: fetch the Cloud SDK from the `storage.googleapis.com/cloud-sdk-release`
mirror instead of `dl.google.com`, and run smoke tests as a **Cloud Build step**, which executes
from Google's network and can reach your service.

**`server-only` is a real package.** The import used to keep server modules out of client
bundles must be installed explicitly; it is not always present transitively.

**JSX in a standalone test runner.** A `tsconfig.json` with `"jsx": "preserve"` (required by
some frameworks) makes a standalone runner emit classic `React.createElement` calls, and tests
fail with *"React is not defined"* — including from inside the component under test. Add a
`tests/tsconfig.json` that extends the root with `"jsx": "react-jsx"` and point the runner at it.

**Next.js standalone Docker layout.** `.next/standalone` contains `server.js` at its **root**,
so copy it to the image root — not to `/app/.next/standalone`. Static assets are **not** in
standalone output; copy `.next/static` separately, plus `public/`. Create `public/.gitkeep` so
the `COPY` does not fail on an empty directory.
