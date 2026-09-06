#!/usr/bin/env bash
#
# Copyloom -> Google Cloud Run, one command.
#
# Enables the required APIs, makes sure the Artifact Registry repository and
# the runtime service account exist with the right roles, then hands the build
# and deploy to Cloud Build (cloudbuild.yaml) and prints the service URL.
#
# Every step is idempotent: re-running only changes what has drifted.
#
# Usage:
#   scripts/deploy.sh <PROJECT_ID> [REGION]
#   PROJECT_ID=my-project REGION=us-central1 scripts/deploy.sh
#
# Optional environment overrides:
#   SERVICE, REPO, RUNTIME_SA, TAG, VERTEX_REGION, VERTEX_MODEL,
#   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, APP_URL
#
# Prerequisites this script cannot do for you:
#   * Claude enabled in Vertex AI Model Garden (manual console step)
#   * Firebase Authentication configured
#   * The two Stripe secrets present in Secret Manager
# See DEPLOY.md.

set -euo pipefail

# --- Arguments -------------------------------------------------------------

PROJECT_ID="${1:-${PROJECT_ID:-}}"
REGION="${2:-${REGION:-us-central1}}"

SERVICE="${SERVICE:-copyloom}"
REPO="${REPO:-copyloom}"
RUNTIME_SA="${RUNTIME_SA:-copyloom-run}"
VERTEX_REGION="${VERTEX_REGION:-global}"
VERTEX_MODEL="${VERTEX_MODEL:-claude-opus-5}"
FIREBASE_API_KEY="${FIREBASE_API_KEY:-}"
FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN:-}"
APP_URL="${APP_URL:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# --- Output helpers --------------------------------------------------------

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

step() { printf '\n%s==>%s %s%s%s\n' "$GREEN" "$RESET" "$BOLD" "$1" "$RESET"; }
info() { printf '    %s%s%s\n' "$DIM" "$1" "$RESET"; }
die()  { printf '\n%serror:%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }

# --- Preflight -------------------------------------------------------------

[ -n "$PROJECT_ID" ] || die "PROJECT_ID is required. Usage: scripts/deploy.sh <PROJECT_ID> [REGION]"
command -v gcloud >/dev/null 2>&1 || die "gcloud not found. Install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install"
[ -f "$REPO_ROOT/cloudbuild.yaml" ] || die "cloudbuild.yaml not found at $REPO_ROOT — run this script from inside the repository."

gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 \
  || die "cannot access project '$PROJECT_ID'. Check the ID and run 'gcloud auth login'."

# Tag the image with the current commit when we are in a git checkout, so a
# revision can always be traced back to source.
if TAG_FROM_GIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null)"; then
  TAG="${TAG:-$TAG_FROM_GIT}"
else
  TAG="${TAG:-latest}"
fi

RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

step "Deploying Copyloom"
info "project  : $PROJECT_ID"
info "region   : $REGION"
info "service  : $SERVICE"
info "image tag: $TAG"
info "model    : $VERTEX_MODEL (vertex region: $VERTEX_REGION)"

# --- 1. Enable APIs --------------------------------------------------------

step "Enabling required APIs (no-op if already enabled)"
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  identitytoolkit.googleapis.com \
  --project "$PROJECT_ID"

# --- 2. Artifact Registry --------------------------------------------------

step "Ensuring Artifact Registry repository '$REPO' exists in $REGION"
if gcloud artifacts repositories describe "$REPO" \
     --project "$PROJECT_ID" --location "$REGION" >/dev/null 2>&1; then
  info "already exists"
else
  gcloud artifacts repositories create "$REPO" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --repository-format docker \
    --description "Copyloom container images"
  info "created"
fi

# --- 3. Runtime service account -------------------------------------------
#
# This is the identity that makes keyless Vertex AI calls. roles/aiplatform.user
# is what allows it to invoke Claude; without it every generation returns 403.

step "Ensuring runtime service account '$RUNTIME_SA_EMAIL' exists"
if gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" \
     --project "$PROJECT_ID" >/dev/null 2>&1; then
  info "already exists"
else
  gcloud iam service-accounts create "$RUNTIME_SA" \
    --project "$PROJECT_ID" \
    --display-name "Copyloom Cloud Run runtime"
  info "created"
fi

step "Granting runtime roles"
for ROLE in roles/aiplatform.user roles/datastore.user roles/secretmanager.secretAccessor; do
  info "$ROLE"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
    --role "$ROLE" \
    --condition None \
    --quiet >/dev/null
done

# --- 4. Cloud Build permissions -------------------------------------------
#
# The build deploys the service and runs it as the runtime account, so its own
# identity needs run.admin and iam.serviceAccountUser. On projects created after
# mid-2024 builds run as the Compute Engine default service account unless a
# build service account is configured; grant both candidates and ignore the one
# that does not exist.

step "Granting Cloud Build permission to deploy"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
for BUILD_SA in \
  "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"; do

  if ! gcloud iam service-accounts describe "$BUILD_SA" --project "$PROJECT_ID" >/dev/null 2>&1; then
    info "skipping $BUILD_SA (does not exist)"
    continue
  fi

  info "$BUILD_SA"
  for ROLE in roles/run.admin roles/artifactregistry.writer roles/logging.logWriter; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member "serviceAccount:${BUILD_SA}" \
      --role "$ROLE" \
      --condition None \
      --quiet >/dev/null
  done

  # Needed to deploy a service that runs as the runtime account.
  gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
    --project "$PROJECT_ID" \
    --member "serviceAccount:${BUILD_SA}" \
    --role roles/iam.serviceAccountUser \
    --quiet >/dev/null
done

# --- 5. Stripe secrets sanity check ---------------------------------------
#
# Cloud Run refuses to start a revision whose referenced secret is missing, so
# fail early with a useful message instead of an opaque deploy error.

step "Checking Stripe secrets in Secret Manager"
MISSING_SECRETS=()
for SECRET in copyloom-stripe-secret-key copyloom-stripe-webhook-secret; do
  if gcloud secrets describe "$SECRET" --project "$PROJECT_ID" >/dev/null 2>&1; then
    info "$SECRET ok"
  else
    MISSING_SECRETS+=("$SECRET")
  fi
done

if [ "${#MISSING_SECRETS[@]}" -gt 0 ]; then
  # Not fatal: billing is optional. The deploy step attaches the Stripe secrets
  # only when they exist, so the app deploys with billing switched off and the
  # billing page renders a "not configured" notice instead of dead buttons.
  printf '\n%snote:%s Stripe secrets not found: %s\n' "$YELLOW" "$RESET" "${MISSING_SECRETS[*]}" >&2
  cat >&2 <<'HINT'

Deploying WITHOUT billing. Sign-up, the brand kit and every generator work;
only subscriptions are disabled. To enable billing later, create the secrets
and re-run this script:

  printf %s "sk_live_..."  | gcloud secrets create copyloom-stripe-secret-key     --data-file=- --replication-policy=automatic
  printf %s "whsec_..."    | gcloud secrets create copyloom-stripe-webhook-secret --data-file=- --replication-policy=automatic

The webhook secret is only known after the service exists, so a placeholder is
fine on the first run; update it with `gcloud secrets versions add` afterwards.
See DEPLOY.md step 7.
HINT
fi

# --- 6. Build and deploy ---------------------------------------------------

step "Submitting Cloud Build (build, push, deploy)"
SUBSTITUTIONS="_REGION=${REGION},_SERVICE=${SERVICE},_REPO=${REPO},_RUNTIME_SA=${RUNTIME_SA},_TAG=${TAG},_VERTEX_REGION=${VERTEX_REGION},_VERTEX_MODEL=${VERTEX_MODEL}"
# Written as if/fi rather than `test && assign`: under `set -e` a false test at
# the end of an && list would abort the script.
if [ -n "$FIREBASE_API_KEY" ]; then
  SUBSTITUTIONS="${SUBSTITUTIONS},_FIREBASE_API_KEY=${FIREBASE_API_KEY}"
fi
if [ -n "$FIREBASE_AUTH_DOMAIN" ]; then
  SUBSTITUTIONS="${SUBSTITUTIONS},_FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN}"
fi
if [ -n "$APP_URL" ]; then
  SUBSTITUTIONS="${SUBSTITUTIONS},_APP_URL=${APP_URL}"
fi

gcloud builds submit "$REPO_ROOT" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --config "$REPO_ROOT/cloudbuild.yaml" \
  --substitutions "$SUBSTITUTIONS"

# --- 7. Report -------------------------------------------------------------

SERVICE_URL="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format 'value(status.url)')"

step "Done"
printf '    %sService URL   :%s %s\n' "$BOLD" "$RESET" "$SERVICE_URL"
printf '    %sStripe webhook:%s %s/api/webhooks/stripe\n' "$BOLD" "$RESET" "$SERVICE_URL"

if [ -z "$APP_URL" ] || [ "$APP_URL" != "$SERVICE_URL" ]; then
  cat <<EOF

Next, if you have not already:
  1. Add $(printf '%s' "$SERVICE_URL" | sed -E 's#^https?://##') to
     Firebase console > Authentication > Settings > Authorised domains.
  2. Set APP_URL to $SERVICE_URL (terraform variable app_url, or
     APP_URL=$SERVICE_URL when re-running this script) so Stripe redirects work.
  3. Point the Stripe webhook at $SERVICE_URL/api/webhooks/stripe and store its
     signing secret in the copyloom-stripe-webhook-secret secret.
EOF
fi
