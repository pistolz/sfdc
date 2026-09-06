# Deploying Copyloom

Copyloom is a Next.js 15 app that runs on **Cloud Run**, stores data in
**Firestore (Native mode)**, authenticates users with **Firebase
Authentication**, bills through **Stripe**, and generates content with **Claude
on Vertex AI**.

The single most important design point: **there is no Anthropic API key and no
service-account JSON anywhere.** Claude is called through Vertex AI using
Application Default Credentials — the Cloud Run runtime service account holds
`roles/aiplatform.user`, and the Anthropic Vertex SDK picks that identity up
automatically. The same identity reaches Firestore and Secret Manager. The only
real secrets in the system are the two Stripe values, and they live in Secret
Manager.

Follow the steps in order. Steps 2 and 3 are **manual console steps that cannot
be automated**, and skipping step 2 is by far the most common cause of a failed
first deploy.

---

## Prerequisites

* [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`), authenticated:
  `gcloud auth login && gcloud auth application-default login`
* A billing account you can attach to a project
* A Stripe account
* Terraform >= 1.5 (only if you take the Terraform path in step 5)

---

## 1. Create the GCP project

```bash
export PROJECT_ID="copyloom-prod"        # must be globally unique
export REGION="us-central1"

gcloud projects create "$PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Billing is required — Vertex AI, Cloud Run and Firestore all refuse to work
# on an unbilled project.
gcloud billing accounts list
gcloud billing projects link "$PROJECT_ID" --billing-account "XXXXXX-XXXXXX-XXXXXX"
```

Then enable the APIs (Terraform and `scripts/deploy.sh` both do this too, so
this is only needed if you want to browse the consoles first):

```bash
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Enable Claude in Vertex AI Model Garden — MANUAL, DO NOT SKIP

**This is the step that breaks first deploys.** Enabling
`aiplatform.googleapis.com` does *not* give you Claude. Anthropic models are
third-party publisher models and each one has to be individually enabled for
your project, which means accepting Anthropic's terms in the console. There is
no `gcloud` command and no Terraform resource for it.

1. Open <https://console.cloud.google.com/vertex-ai/model-garden> with
   `$PROJECT_ID` selected.
2. Search for **Claude**.
3. Open **Claude Opus 5** and click **Enable** (some accounts show
   "Enable" behind a **Manage / Request access** button on the model card).
4. Accept the Anthropic terms when prompted.
5. Repeat for **Claude Sonnet 5** — it costs nothing to enable and gives you a
   working fallback.

Verify before you go further:

```bash
# Should return HTTP 200 and a JSON message body.
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/anthropic/models/claude-opus-5:rawPredict" \
  -d '{"anthropic_version":"vertex-2023-10-16","max_tokens":16,"messages":[{"role":"user","content":"ping"}]}'
```

* `200` — you are good.
* `404` — the model is not enabled for this project (or not in this location).
  Go back to Model Garden. If Opus 5 is genuinely unavailable to you, set
  `VERTEX_MODEL=claude-sonnet-5` (Terraform: `vertex_model`) and use Sonnet 5.
* `403` — the API is not enabled or your account lacks `roles/aiplatform.user`.

**Region note.** Copyloom defaults to `VERTEX_REGION=global`, which routes
across regions and has the best availability and quota. If you pin a specific
region for data residency (e.g. `us-east5`, `europe-west1`), the model must be
enabled and available *in that region*, and `global` is the safer default
otherwise.

---

## 3. Set up Firebase Authentication — MANUAL

1. Go to <https://console.firebase.google.com>, click **Add project**, and
   choose the **existing** GCP project `$PROJECT_ID` (do not create a new one —
   Firebase Auth, Firestore and Cloud Run must share one project so that ADC and
   the token audience line up).
2. **Build > Authentication > Get started.**
3. Under **Sign-in method**, enable:
   * **Email/Password** — enable the top toggle (leave "Email link" off).
   * **Google** — enable it, pick a project support email, and save.
4. Register a **Web app**: gear icon > **Project settings** > **General** >
   *Your apps* > **</>**. Give it a nickname, skip Firebase Hosting.
5. From the SDK snippet, copy `apiKey` and `authDomain`. These are
   `FIREBASE_API_KEY` and `FIREBASE_AUTH_DOMAIN`. They are public values — the
   API key only identifies the project; access control comes from Firestore
   rules and from server-side ID-token verification.
6. **Authorised domains** (Authentication > Settings > Authorised domains):
   `localhost` and `<project>.firebaseapp.com` are there by default. You must
   **add the Cloud Run hostname** once you have it after step 5 — hostname only,
   no scheme and no path, e.g. `copyloom-abc123-uc.a.run.app`. Add your custom
   domain too if you use one. Google sign-in fails with
   `auth/unauthorized-domain` until you do this.

Firestore itself is created by Terraform (`google_firestore_database`, type
`FIRESTORE_NATIVE`, location `nam5` by default). If you create it from the
console instead, choose **Native mode** — Datastore mode is not compatible and
the choice is permanent.

---

## 4. Create the Stripe products and prices

> **Skipping billing for now?** This whole step is optional. Leave
> `stripe_secret_key` empty in `terraform.tfvars` (or just do not create the
> Secret Manager secrets if you are using `scripts/deploy.sh`) and deploy as
> normal. Terraform then creates no Stripe secrets and Cloud Run gets no Stripe
> env vars; `scripts/deploy.sh` prints a note and carries on rather than failing.
>
> Everything except subscriptions works: sign-up, sign-in, brand kits, all eight
> generators, streaming, the asset library and free-tier credits. The billing
> page renders a "billing is not configured" notice instead of buttons that
> cannot work. Come back and run this step, then re-apply or re-run the script,
> whenever you are ready to charge — nothing else has to change.

In the Stripe dashboard (start in **test mode**), under **Product catalogue**,
create three products, each with one **recurring monthly** price in USD. These
match `src/lib/plans.ts`:

| Product | Monthly price | Env var |
| --- | --- | --- |
| Copyloom Starter | $29 | `STRIPE_PRICE_STARTER` |
| Copyloom Pro | $99 | `STRIPE_PRICE_PRO` |
| Copyloom Agency | $299 | `STRIPE_PRICE_AGENCY` |

Copy each price's **API ID** — it starts with `price_`, not `prod_`. The
product ID will not work.

Also copy your **secret key** from **Developers > API keys** (`sk_test_...`
now, `sk_live_...` when you go live).

Store the secrets in Secret Manager. The webhook signing secret does not exist
yet — that endpoint needs the service URL — so seed it with a placeholder and
replace it in step 7:

```bash
printf %s 'sk_test_your_key_here' | \
  gcloud secrets create copyloom-stripe-secret-key \
    --project "$PROJECT_ID" --replication-policy=automatic --data-file=-

printf %s 'whsec_placeholder' | \
  gcloud secrets create copyloom-stripe-webhook-secret \
    --project "$PROJECT_ID" --replication-policy=automatic --data-file=-
```

(If you take the Terraform path in step 5, Terraform creates and owns these
secrets from your `terraform.tfvars` instead — skip the two commands above.)

---

## 5. Deploy

Pick **one** of the two paths and stay on it. Terraform and `gcloud run deploy`
both own the Cloud Run service definition, so alternating between them will
have each one revert the other's settings.

### Path A — Terraform (recommended; provisions everything)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Fill in project_id, image, firebase_*, stripe_* in terraform.tfvars.
```

> **Before you fill it in:** `terraform.tfvars` will contain a live Stripe
> secret key and the repo's `.gitignore` does not yet cover it. Add
> `infra/terraform.tfvars` to `.gitignore`, and use a remote GCS backend for
> `terraform.tfstate` (which also stores the secrets in plaintext) as soon as
> more than one person deploys.

```bash
```

Terraform will not create the container image, and Cloud Run refuses a service
whose image it cannot pull. Build and push once first:

```bash
gcloud artifacts repositories create copyloom \
  --project "$PROJECT_ID" --location "$REGION" --repository-format docker \
  --description "Copyloom container images" || true

gcloud builds submit .. \
  --project "$PROJECT_ID" --region "$REGION" \
  --tag "${REGION}-docker.pkg.dev/${PROJECT_ID}/copyloom/copyloom:latest"
```

Set `image` in `terraform.tfvars` to that tag, then:

```bash
terraform init
terraform plan
terraform apply
```

Terraform enables the APIs, creates the Artifact Registry repo, the Firestore
database, the runtime service account with `roles/aiplatform.user`,
`roles/datastore.user` and `roles/secretmanager.secretAccessor`, the two Stripe
secrets, and the public Cloud Run service (min 0 / max 10 instances,
concurrency 80, 1 vCPU, 1 GiB, 600 s request timeout for long streaming
generations).

Read the outputs:

```bash
terraform output service_url          # https://copyloom-....run.app
terraform output stripe_webhook_url
terraform output service_account_email
terraform output artifact_registry_repository
```

**Second apply.** `app_url` was empty on the first pass because the URL did not
exist yet. Set `app_url` in `terraform.tfvars` to the `service_url` output (or
your custom domain), and `terraform apply` again. Stripe checkout redirects
depend on it.

### Path B — the script (build + deploy on top of an existing project)

```bash
scripts/deploy.sh "$PROJECT_ID" "$REGION"
```

It enables the APIs, creates the Artifact Registry repo and runtime service
account if missing, grants the runtime roles and the Cloud Build deploy
permissions, checks the two Stripe secrets exist, submits `cloudbuild.yaml`
(build > push > `gcloud run deploy`), and prints the service URL. It is
idempotent — re-run it for every deploy.

Firebase values and `APP_URL` are passed through as environment variables when
this is your only deploy path:

```bash
FIREBASE_API_KEY="AIza..." \
FIREBASE_AUTH_DOMAIN="${PROJECT_ID}.firebaseapp.com" \
APP_URL="https://copyloom-abc123-uc.a.run.app" \
  scripts/deploy.sh "$PROJECT_ID" "$REGION"
```

Firestore is not created by this path — create it once from the console (Native
mode) or run `terraform apply` for it.

### After either path

Go back to **step 3.6** and add the Cloud Run hostname to the Firebase
authorised domains. Nothing about Google sign-in works until you do.

---

## 6. Verify

```bash
SERVICE_URL="$(gcloud run services describe copyloom \
  --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"

curl -sS -o /dev/null -w '%{http_code}\n' "$SERVICE_URL"   # expect 200
```

Then in a browser: sign up with email/password, sign in with Google, and run one
generation. If the generation fails, the answer is almost always in step 2 —
check the logs:

```bash
gcloud run services logs read copyloom \
  --project "$PROJECT_ID" --region "$REGION" --limit 50
```

---

## 7. Wire up the Stripe webhook

1. Stripe dashboard > **Developers > Webhooks > Add endpoint**.
2. Endpoint URL: **`https://<service-url>/api/webhooks/stripe`** — for example
   `https://copyloom-abc123-uc.a.run.app/api/webhooks/stripe`. Use the exact
   host you serve on; if you later move to a custom domain, add a second
   endpoint or update this one.
3. Select events:
   * `checkout.session.completed`
   * `customer.subscription.created`
   * `customer.subscription.updated`
   * `customer.subscription.deleted`
   * `invoice.paid`
   * `invoice.payment_failed`
4. Save, then reveal the **Signing secret** (`whsec_...`).
5. Record it:

   * **Terraform path** — set `stripe_webhook_secret` in `terraform.tfvars` and
     `terraform apply`. Terraform adds a new secret version and rolls a new
     revision.
   * **Script path** —
     ```bash
     printf %s 'whsec_your_real_secret' | \
       gcloud secrets versions add copyloom-stripe-webhook-secret \
         --project "$PROJECT_ID" --data-file=-
     ```
     Cloud Run resolves `latest` at revision start, so redeploy to pick it up:
     `scripts/deploy.sh "$PROJECT_ID" "$REGION"`.

6. Send a test event from the Stripe dashboard and confirm a `200` in the
   endpoint's delivery log.

Also set the Stripe price IDs from step 4 (`stripe_price_starter`,
`stripe_price_pro`, `stripe_price_agency` in `terraform.tfvars`) and apply, or
the paid plans stay hidden.

Locally, use the Stripe CLI instead of a real endpoint:

```bash
stripe listen --forward-to localhost:8080/api/webhooks/stripe
```

It prints its own `whsec_...` — that one is only valid for that session.

---

## 8. Going live

1. Swap the Stripe test key and price IDs for live-mode ones and add a live-mode
   webhook endpoint (its signing secret is different from the test one).
2. Map a custom domain (Cloud Run > **Manage custom domains**, or a global
   external Application Load Balancer).
3. Add the custom domain to the Firebase authorised domains, and set `app_url`
   to it.
4. Consider raising `max_instance_count` and setting `min_instance_count = 1` to
   remove cold starts.

---

## Troubleshooting

### `403 PERMISSION_DENIED` from Vertex AI

The generation route returns 403, or logs show
`Permission 'aiplatform.endpoints.predict' denied`.

* Confirm the service is actually running as the runtime account, not the
  Compute Engine default:
  ```bash
  gcloud run services describe copyloom --project "$PROJECT_ID" \
    --region "$REGION" --format='value(spec.template.spec.serviceAccountName)'
  ```
* Confirm that account has `roles/aiplatform.user`:
  ```bash
  gcloud projects get-iam-policy "$PROJECT_ID" \
    --flatten='bindings[].members' \
    --filter="bindings.members:copyloom-run@${PROJECT_ID}.iam.gserviceaccount.com" \
    --format='value(bindings.role)'
  ```
* Confirm `aiplatform.googleapis.com` is enabled:
  `gcloud services list --enabled --project "$PROJECT_ID" | grep aiplatform`
* IAM changes take up to a minute or two to propagate. If you just granted the
  role, deploy a new revision and retry.
* Locally (not on Cloud Run), 403 usually means stale ADC — re-run
  `gcloud auth application-default login` and check
  `gcloud config get-value project`.

### `404 NOT_FOUND` / "model not found" / "Publisher Model ... not found"

This is step 2, essentially always. The model is not enabled in Vertex AI Model
Garden for this project, or not available in the location you pinned.

* Re-open Model Garden and confirm **Claude Opus 5** shows as enabled.
* Try the `curl` probe in step 2 — it isolates the problem from the app.
* If Opus 5 is not offered to your account, set `VERTEX_MODEL=claude-sonnet-5`
  (Terraform `vertex_model`, or `--update-env-vars VERTEX_MODEL=claude-sonnet-5`)
  and redeploy.
* Check for a typo in the model ID. Vertex uses the **bare** ID —
  `claude-opus-5`, not `anthropic.claude-opus-5`, and with no date suffix.
* If you set `VERTEX_REGION` to a specific region, switch back to `global`; a
  model enabled in Model Garden is not necessarily served in every region.

### `auth/unauthorized-domain` in the browser

Firebase rejects the sign-in popup because the domain serving the page is not on
the allow-list.

* Firebase console > **Authentication > Settings > Authorised domains** > **Add
  domain**, and add the **hostname only**: `copyloom-abc123-uc.a.run.app`. No
  `https://`, no trailing slash, no path.
* Add every host you serve from, including any custom domain and preview URLs.
* Cloud Run revision-specific URLs (`copyloom---rev-xyz-...run.app`) are
  different hostnames and are not covered by the base one.
* Changes can take a minute; hard-reload the page afterwards.

### Stripe webhook signature verification fails

`Webhook Error: No signatures found matching the expected signature for payload`.

* You are using the wrong secret. Test mode and live mode have different signing
  secrets, and each endpoint has its own — copy it from the specific endpoint's
  page, not from the API keys page. The `stripe listen` secret only works with
  the CLI.
* You updated the secret but did not roll a revision. Cloud Run resolves
  `latest` when a revision starts, so an existing revision keeps the old value.
  Redeploy after `gcloud secrets versions add`.
* The route must verify against the **raw** request body. Any JSON parse or
  re-serialise before `stripe.webhooks.constructEvent` invalidates the
  signature. (`src/app/api/webhooks/stripe` should read `await req.text()`.)
* Confirm the value actually reached the container:
  ```bash
  gcloud run services describe copyloom --project "$PROJECT_ID" --region "$REGION" \
    --format='value(spec.template.spec.containers[0].env)' | tr ',' '\n' | grep -i stripe
  ```
* A `400` in Stripe's delivery log is a signature problem; a `500` is your
  handler; a `404` means the URL path is wrong — it must end in
  `/api/webhooks/stripe`.

### Cloud Run revision fails to start

* `The user-provided container failed to start and listen on the port` — the
  container must listen on `$PORT` (8080). The Dockerfile sets
  `PORT=8080 HOSTNAME=0.0.0.0`; do not override them.
* `Revision ... is not ready ... failed to access secret version` — the secret
  does not exist, or the runtime service account is missing
  `roles/secretmanager.secretAccessor`.
* `Missing required environment variable FIREBASE_API_KEY` in the logs — the
  variable is not set on the service. Set it via Terraform (`firebase_api_key`)
  or `--update-env-vars`.

### Cloud Build permission errors

`PERMISSION_DENIED: ... iam.serviceAccounts.actAs` or
`Permission 'run.services.update' denied` — the Cloud Build service account
needs `roles/run.admin` plus `roles/iam.serviceAccountUser` on the runtime
account. `scripts/deploy.sh` grants both; run it once, or grant them manually.

### Removing the deployment

The Firestore database is created with delete protection on, so
`terraform destroy` stops there on purpose. To remove it deliberately:

```bash
gcloud firestore databases update --database='(default)' \
  --project "$PROJECT_ID" --no-delete-protection
terraform destroy
```
