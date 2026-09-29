# Deploy runbook

An ordered, copy-pasteable path from an empty GCP account to a working, smoke-tested service.
Run the steps in order — several of them exist specifically to surface an expensive failure
while it is still cheap.

Failures cited as "gotcha §N" live in `references/gotchas.md`. Read that before your first
deploy, not after it breaks.

**Contents**

- [0. Prerequisites](#0-prerequisites)
- [1. Provision the project](#1-provision-the-project)
- [2. Set up Firebase](#2-set-up-firebase)
- [3. Configure the app](#3-configure-the-app)
- [4. Build and deploy](#4-build-and-deploy)
- [5. Capture the service URL](#5-capture-the-service-url)
- [6. Authorize both Cloud Run hostnames](#6-authorize-both-cloud-run-hostnames)
- [7. Set the public URL and redeploy](#7-set-the-public-url-and-redeploy)
- [8. Smoke test](#8-smoke-test)
- [Terraform or gcloud — pick one](#terraform-or-gcloud--pick-one)
- [Troubleshooting](#troubleshooting)

---

## 0. Prerequisites

```bash
gcloud version                     # Google Cloud CLI installed
gcloud auth login
gcloud auth application-default login
gcloud billing accounts list       # need one with OPEN = True
docker version                     # only if you build locally; Cloud Build does not need it
terraform version                  # >= 1.5, only on the Terraform path
```

Set the variables every later step reuses:

```bash
export PROJECT_ID="myapp-prod"     # must be globally unique
export REGION="us-central1"
export SERVICE="myapp"
export REPO="myapp"
export RUNTIME_SA="myapp-run"
```

If `gcloud` commands fail with `UNAUTHENTICATED ... ACCESS_TOKEN_TYPE_UNSUPPORTED` immediately
after a successful login, a preset `CLOUDSDK_AUTH_ACCESS_TOKEN` is overriding your credentials —
gotcha §11.

---

## 1. Provision the project

```bash
scripts/provision.sh "$PROJECT_ID" "$REGION"
```

Creates or reuses the project, links billing, enables the APIs (`run`, `aiplatform`,
`firestore`, `secretmanager`, `artifactregistry`, `cloudbuild`, `identitytoolkit`), creates the
Firestore Native database and the Artifact Registry repository, creates the runtime service
account, and grants it:

```
roles/aiplatform.user             # keyless Gemini via ADC
roles/datastore.user              # Firestore
roles/secretmanager.secretAccessor
roles/firebaseauth.admin          # session cookies — easy to miss, gotcha §2
```

Idempotent; safe to re-run. If billing linking fails with `FAILED_PRECONDITION: Cloud billing
quota exceeded`, the billing account has hit its project cap — try another open account
(gotcha §10).

**Then prove model access before you build anything on it** (gotcha §1):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/publishers/google/models/gemini-2.5-pro:generateContent" \
  -d '{"contents":[{"role":"user","parts":[{"text":"ping"}]}],"generationConfig":{"maxOutputTokens":16}}'
```

`200` good · `404` wrong id or not served there · `403` missing `roles/aiplatform.user` ·
`429` zero quota — pick another model or file for an increase and wait days. Probe the exact
`(model, location)` pair you intend to ship.

---

## 2. Set up Firebase

```bash
scripts/firebase-setup.sh "$PROJECT_ID"
```

Adds Firebase to the **existing** GCP project (never a new one — Auth, Firestore and Cloud Run
must share a project so ADC and the token audience line up), enables the Email/Password and
Google sign-in providers, registers a Web app, prints its `apiKey` and `authDomain`, and
publishes `firestore.rules`.

Rules are not applied just by existing in the repo — the script creates a ruleset and releases
it to `cloud.firestore` (gotcha §13). Verify rather than assume.

If a step 403s with *"requires a quota project, which is not set by default"*, send
`x-goog-user-project: $PROJECT_ID` alongside the bearer token (gotcha §9).

Anything the script cannot do is a console step: <https://console.firebase.google.com> →
Authentication → Sign-in method.

---

## 3. Configure the app

Set the non-secret values on the service, and the real secrets in Secret Manager.

| Variable | Value | Notes |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | `$PROJECT_ID` | **Must be set explicitly** — Cloud Run does not inject it (gotcha §3) |
| `VERTEX_REGION` | `global` | Best availability; pin a region only for data residency |
| `VERTEX_MODEL` | `gemini-2.5-pro` | Bare id, no date suffix |
| `FIREBASE_API_KEY` | from step 2 | Public by design |
| `FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` | Public by design |
| `APP_URL` | set in step 7 | Not known yet |
| `NODE_ENV` | `production` | |

Secrets go in Secret Manager and are referenced, never copied into the service definition:

```bash
printf %s 'sk_test_...'      | gcloud secrets create "${SERVICE}-stripe-secret-key" \
  --project "$PROJECT_ID" --replication-policy=automatic --data-file=-
printf %s 'whsec_placeholder' | gcloud secrets create "${SERVICE}-stripe-webhook-secret" \
  --project "$PROJECT_ID" --replication-policy=automatic --data-file=-
```

The webhook secret is genuinely circular — it cannot exist until the service URL does, and the
revision will not start referencing a secret that does not exist. Seed a placeholder now and
replace it once the endpoint is registered; the webhook simply rejects every signature until
then, which is the correct safe behaviour (gotchas §5, §6). Skipping billing entirely is fine:
create no secrets, attach no Stripe env vars, and the app reports "billing not configured".

Before writing any `terraform.tfvars`, confirm it is ignored — it will hold a live key
(gotcha §7):

```bash
git check-ignore -v infra/terraform.tfvars
```

And write `.gcloudignore` **explicitly and completely**: creating one disables the `.gitignore`
fallback, and the build context goes from ~500 KB to hundreds of megabytes (gotcha §4).

---

## 4. Build and deploy

Image → Artifact Registry → Cloud Run, in one Cloud Build submission:

```bash
gcloud builds submit . \
  --project "$PROJECT_ID" --region "$REGION" \
  --config cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_SERVICE="$SERVICE",_REPO="$REPO",_RUNTIME_SA="$RUNTIME_SA",_TAG=$(git rev-parse --short HEAD)
```

The deploy step inside it is an ordinary `gcloud run deploy`:

```bash
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" \
  --image "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:${TAG}" \
  --service-account "${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --port 8080 \
  --cpu 1 --memory 1Gi \
  --concurrency 80 \
  --timeout 600 \
  --min-instances 0 --max-instances 10 \
  --allow-unauthenticated \
  --update-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},VERTEX_REGION=global,VERTEX_MODEL=gemini-2.5-pro,NODE_ENV=production"
```

Why each flag:

| Flag | Reason |
|---|---|
| `--service-account` | Without it the revision runs as the Compute Engine default account, which lacks every role from step 1 |
| `--port 8080` | Must match what the container listens on; the image sets `PORT=8080 HOSTNAME=0.0.0.0` |
| `--concurrency 80` | Streaming requests are I/O-bound and idle most of their life; one instance handles many |
| `--timeout 600` | The default 300s severs long streams mid-generation (gotcha §14) |
| `--min-instances 0` | Scales to zero, so an idle service costs nothing. Raise to 1 later to remove cold starts |
| `--allow-unauthenticated` | The app enforces its own session auth; Cloud Run IAM would block real users |

Attach secrets only when they exist — a revision referencing a missing secret will not start:

```bash
if gcloud secrets describe "${SERVICE}-stripe-secret-key" --project "$PROJECT_ID" >/dev/null 2>&1; then
  SECRET_ARGS=(--update-secrets "STRIPE_SECRET_KEY=${SERVICE}-stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=${SERVICE}-stripe-webhook-secret:latest")
fi
```

Use `--update-env-vars`, not `--set-env-vars`: update touches only the keys it names and leaves
everything else on the service alone, which matters when Terraform owns some of them.

`gcloud builds submit` prints a summary only; step output is in Cloud Logging
(`gcloud builds log <ID> --region "$REGION"`). When polling for completion, test for a terminal
status — `QUEUED` comes before `WORKING`, so a loop waiting on "not WORKING" exits instantly
(gotcha §17).

---

## 5. Capture the service URL

```bash
SERVICE_URL="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo "$SERVICE_URL"
curl -sS -o /dev/null -w '%{http_code}\n' "$SERVICE_URL"     # expect 200
```

---

## 6. Authorize both Cloud Run hostnames

Firebase console → Authentication → Settings → Authorised domains → Add domain. **Hostname
only**: no scheme, no trailing slash, no path.

Cloud Run answers on **two** hostname formats and different commands report different ones:

```
SERVICE-HASH-REGIONCODE.a.run.app          e.g. myapp-abc123-uc.a.run.app
SERVICE-PROJECTNUMBER.REGION.run.app       e.g. myapp-482910473827.us-central1.run.app
```

Add **both**, plus any custom domain. Authorize only one and sign-in fails with
`auth/unauthorized-domain` depending on which URL a user happens to open (gotcha §12).

```bash
gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)'   # builds the second form
```

---

## 7. Set the public URL and redeploy

`APP_URL` could not be set before the URL existed. It is what billing redirects and any absolute
link are built from.

```bash
gcloud run services update "$SERVICE" \
  --project "$PROJECT_ID" --region "$REGION" \
  --update-env-vars "APP_URL=${SERVICE_URL}"
```

On the Terraform path, set `app_url` in `terraform.tfvars` and `terraform apply` again instead.
Same for the real webhook signing secret once the endpoint is registered: add a new secret
version, then roll a revision — Cloud Run resolves `latest` at revision start, so an existing
revision keeps the old value.

---

## 8. Smoke test

```bash
scripts/smoke-test.sh "$SERVICE_URL"
```

A green build proves almost nothing. The test must create a user, exchange an ID token for a
session cookie, perform the core action, and confirm both that data persisted and that usage was
charged — that is the exact path the missing `roles/firebaseauth.admin` breaks while every local
test passes (gotcha §2).

If your environment blocks egress to `*.run.app` — agent sandboxes commonly do — run the smoke
test as a Cloud Build step instead. It executes from Google's network and can reach the service
(gotcha §17).

---

## Terraform or gcloud — pick one

Both can own the Cloud Run service definition, and if you alternate, each reverts the other's
settings: a `gcloud run deploy` drops env vars Terraform set, and the next `terraform apply`
rolls back your image. Decide up front and stay on it.

| | Terraform (`infra/`) | `gcloud` / Cloud Build |
|---|---|---|
| Owns | APIs, registry, Firestore, service account + IAM, secrets, the service | The service revision only |
| Good for | Reproducible environments, more than one deployer, review before apply | A single environment, fast iteration, CI on push |
| Watch out | Needs the image pushed *before* the first apply — Cloud Run validates it can pull. Two-pass flow for `app_url` and the webhook secret | Provisioning stays manual; nothing records what the project looks like |

A workable hybrid: Terraform owns everything except the image tag, and CI only ever runs
`gcloud run deploy --image` — one field, and Terraform ignores drift on it.

---

## Troubleshooting

Keyed by the symptom you actually see.

| Symptom | Likely cause | Go to |
|---|---|---|
| `429 RESOURCE_EXHAUSTED` from Vertex on a brand-new project | Per-base-model quota defaults to zero — not rate limiting | gotcha §1 |
| `403 PERMISSION_DENIED` from Vertex | Revision running as the default SA, or missing `roles/aiplatform.user`; IAM takes a minute to propagate | gotcha §1, step 4 |
| `404` / "Publisher Model not found" | Wrong model id (date suffix or `publishers/` prefix), or not served in that location | gotcha §1, `vertex-gemini.md` §5 |
| Sign-up works, `POST /api/auth/session` returns 500 | Runtime SA lacks `roles/firebaseauth.admin`; log says "insufficient permission" | gotcha §2 |
| `auth/unauthorized-domain` in the browser | Cloud Run's other hostname is not authorized | gotcha §12, step 6 |
| Client library cannot determine the project at runtime | `GOOGLE_CLOUD_PROJECT` is not injected by Cloud Run | gotcha §3 |
| Revision fails to start: "failed to access secret version" | Secret missing, or SA lacks `roles/secretmanager.secretAccessor` | gotcha §5 |
| Revision fails to start: "container failed to start and listen on the port" | Not listening on `$PORT`/8080, or `--port` mismatch | step 4 |
| Revision fails to start: "Missing required environment variable X" | Env var not set on the service | step 3 |
| Terraform apply fails creating a secret version | Secret Manager rejects an empty payload | gotcha §6 |
| Build upload jumps from ~500 KB to hundreds of MB | A `.gcloudignore` exists and disabled the `.gitignore` fallback | gotcha §4 |
| `gcloud builds submit` shows no step output | `logging: CLOUD_LOGGING_ONLY` — read with `gcloud builds log <ID> --region <R>` | gotcha §17 |
| Build-status poll exits immediately | `QUEUED` precedes `WORKING`; test for a terminal status | gotcha §17 |
| Cloud Build: `iam.serviceAccounts.actAs` denied | Build SA needs `roles/run.admin` + `roles/iam.serviceAccountUser` on the runtime SA | step 4 |
| Stream arrives as one lump, or is cut off | Missing `X-Accel-Buffering: no` / `no-transform`, or timeout below the generation length | gotcha §14 |
| Webhook signature verification fails | Wrong-mode secret, body re-parsed instead of raw, or secret updated without rolling a revision | `architecture.md` §6 |
| Public config needs a rebuild per environment | `NEXT_PUBLIC_*` inlines at build time; serve it at runtime instead | gotcha §15 |
| Pricing page advertises the wrong number of actions | Token weighting changed; the copy did not | gotcha §16 |
