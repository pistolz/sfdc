#!/usr/bin/env bash
#
# provision.sh — stand up a GCP project for the SaaS foundation.
#
# Creates (or reuses) a project, links billing, enables the APIs, creates the
# Firestore database, the Artifact Registry repo and the runtime service
# account, grants the IAM that this architecture actually needs, and finally
# probes model access so you learn about zero quota now rather than after
# building a product on top of it.
#
# Everything here is check-then-create: re-running is safe and is the expected
# way to repair a half-provisioned project.
#
# See references/gotchas.md — the section numbers referenced in comments below
# point at the real failure each defence exists for.

set -euo pipefail

# --- gotcha #11 -------------------------------------------------------------
# Some managed/CI/agent environments preset CLOUDSDK_AUTH_ACCESS_TOKEN. It wins
# over stored credentials on EVERY gcloud invocation, so `gcloud auth login`
# appears to succeed and then every command dies with
#   UNAUTHENTICATED ... ACCESS_TOKEN_TYPE_UNSUPPORTED
# Unsetting it here fixes the whole script in one place (shell state does not
# survive between tool calls in most agent harnesses, so it must be per-script).
unset CLOUDSDK_AUTH_ACCESS_TOKEN || true

# --- gotcha #17 -------------------------------------------------------------
# Never name a variable UID in bash: it is readonly and the assignment aborts
# the script under `set -e`. Use ACCOUNT_ID / LOCAL_ID / USER_ID instead.

# ---------------------------------------------------------------------------
# Config: env vars with defaults, overridable positionally.
# ---------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-saas-foundation-$(date +%Y%m%d%H%M)}"
PROJECT_NAME="${PROJECT_NAME:-SaaS Foundation}"
REGION="${REGION:-us-central1}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-nam5}"
AR_REPO="${AR_REPO:-app}"
RUNTIME_SA_ID="${RUNTIME_SA_ID:-app-run}"
MODEL="${MODEL:-gemini-2.5-pro}"
MODEL_LOCATION="${MODEL_LOCATION:-global}"
BILLING_ACCOUNT="${BILLING_ACCOUNT:-}"   # optional: try this one first
ORG_ID="${ORG_ID:-}"                     # optional parent for project create
FOLDER_ID="${FOLDER_ID:-}"               # optional parent for project create

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'
else
  C_RESET=''; C_BOLD=''; C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''
fi

step() { printf '\n%s==> %s%s\n' "$C_BLUE" "$*" "$C_RESET"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    %s[ok]%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%s[fatal]%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE_EOF'
provision.sh — provision a GCP project for the SaaS foundation (idempotent)

USAGE
  provision.sh [PROJECT_ID] [REGION] [FIRESTORE_LOCATION]
  provision.sh --help

POSITIONAL (each overrides the matching env var)
  PROJECT_ID           project to create or reuse
  REGION               region for Artifact Registry / Cloud Run  (default us-central1)
  FIRESTORE_LOCATION   Firestore location                        (default nam5)

ENVIRONMENT
  PROJECT_ID           default: saas-foundation-<timestamp>
  PROJECT_NAME         display name for a newly created project
  REGION               default: us-central1
  FIRESTORE_LOCATION   default: nam5
  AR_REPO              Artifact Registry docker repo id          (default app)
  RUNTIME_SA_ID        runtime service account id                (default app-run)
  MODEL                model to probe                            (default gemini-2.5-pro)
  MODEL_LOCATION       location to probe it in                   (default global)
  BILLING_ACCOUNT      billing account to try first; otherwise every open one
  ORG_ID / FOLDER_ID   optional parent for a newly created project
  NO_COLOR             set to disable coloured output

WHAT IT DOES
  1. checks gcloud + an active account
  2. creates the project if missing
  3. links billing, trying every open account (a single account can be at its
     project quota and return FAILED_PRECONDITION even while open)
  4. enables the APIs this stack needs
  5. creates Firestore (Native), the Artifact Registry repo, the runtime SA
  6. grants runtime + Cloud Build IAM
  7. probes model access and tells you what the status code means

Safe to re-run. Nothing is deleted or overwritten.
USAGE_EOF
}

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -*) die "unknown flag: $1 (try --help)" ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
# Note the `if` blocks rather than `[[ ... ]] && x` one-liners: under `set -e` a
# false one-liner returns 1 as the whole command and kills the script.
if [[ ${#POSITIONAL[@]} -ge 1 ]]; then PROJECT_ID="${POSITIONAL[0]}"; fi
if [[ ${#POSITIONAL[@]} -ge 2 ]]; then REGION="${POSITIONAL[1]}"; fi
if [[ ${#POSITIONAL[@]} -ge 3 ]]; then FIRESTORE_LOCATION="${POSITIONAL[2]}"; fi

RUNTIME_SA_EMAIL="${RUNTIME_SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

printf '%s%s%s\n' "$C_BOLD" "GCP SaaS foundation — provisioning ${PROJECT_ID}" "$C_RESET"
info "region=${REGION}  firestore=${FIRESTORE_LOCATION}  repo=${AR_REPO}  sa=${RUNTIME_SA_ID}"

# ---------------------------------------------------------------------------
# 1. Preflight: gcloud present and authenticated
# ---------------------------------------------------------------------------
step "1/8 Preflight"
command -v gcloud >/dev/null 2>&1 || die \
  "gcloud not found on PATH. Install the Cloud SDK. In sandboxes that block
    dl.google.com, fetch it from the mirror instead:
      https://storage.googleapis.com/cloud-sdk-release/google-cloud-cli-linux-x86_64.tar.gz"

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -n1 || true)"
[[ -n "$ACTIVE_ACCOUNT" ]] || die \
  "no active gcloud account. Run:  gcloud auth login
    If you *did* log in and still see UNAUTHENTICATED/ACCESS_TOKEN_TYPE_UNSUPPORTED,
    a preset CLOUDSDK_AUTH_ACCESS_TOKEN is overriding your credentials (gotcha #11)."
ok "authenticated as ${ACTIVE_ACCOUNT}"

# ---------------------------------------------------------------------------
# 2. Project
# ---------------------------------------------------------------------------
step "2/8 Project"
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  ok "project ${PROJECT_ID} already exists — reusing it"
else
  info "creating project ${PROJECT_ID}"
  CREATE_ARGS=("$PROJECT_ID" "--name=$PROJECT_NAME")
  if [[ -n "$ORG_ID" ]];    then CREATE_ARGS+=("--organization=$ORG_ID"); fi
  if [[ -n "$FOLDER_ID" ]]; then CREATE_ARGS+=("--folder=$FOLDER_ID"); fi
  gcloud projects create "${CREATE_ARGS[@]}" --quiet \
    || die "could not create project ${PROJECT_ID} (id taken globally, or no create permission on the parent)"
  ok "created ${PROJECT_ID}"
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
info "project number: ${PROJECT_NUMBER}"

# ---------------------------------------------------------------------------
# 3. Billing — gotcha #10
# ---------------------------------------------------------------------------
# A billing account caps how many projects it may pay for. When that cap is hit
# the link fails with FAILED_PRECONDITION "Cloud billing quota exceeded" even
# though the account is open and perfectly healthy. So do not trust a single
# account: try each open one and verify by *reading back* billingEnabled, which
# is the only statement that actually means "billing works".
step "3/8 Billing"
billing_enabled() {
  [[ "$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null || true)" == "True" ]]
}

if billing_enabled; then
  ok "billing already enabled on ${PROJECT_ID}"
else
  CANDIDATES=()
  if [[ -n "$BILLING_ACCOUNT" ]]; then CANDIDATES+=("$BILLING_ACCOUNT"); fi
  while read -r acct; do
    [[ -n "$acct" ]] || continue
    # skip a duplicate of the explicitly requested account
    if [[ "$acct" == "$BILLING_ACCOUNT" ]]; then continue; fi
    CANDIDATES+=("$acct")
  done < <(gcloud billing accounts list --filter='open=true' --format='value(name)' 2>/dev/null || true)

  [[ ${#CANDIDATES[@]} -gt 0 ]] || die \
    "no open billing accounts visible to ${ACTIVE_ACCOUNT}.
    Nothing in this stack works without billing: Cloud Run, Vertex AI, Firestore
    and Artifact Registry all require it. Create or gain access to one, then re-run."

  for acct in "${CANDIDATES[@]}"; do
    info "trying billing account ${acct}"
    # Failure here is expected and non-fatal — that is the entire point.
    if gcloud billing projects link "$PROJECT_ID" --billing-account="$acct" >/dev/null 2>&1; then
      if billing_enabled; then
        ok "billing linked via ${acct}"
        break
      fi
      warn "link reported success but billingEnabled is not True for ${acct}"
    else
      warn "could not link ${acct} (likely 'Cloud billing quota exceeded' — that account is at its project cap)"
    fi
  done

  billing_enabled || die \
    "billing could not be enabled on ${PROJECT_ID} with any open account.
    Every candidate is probably at its project quota (gotcha #10). Free up a
    project on one of them, raise the quota, or use a different billing account:
      BILLING_ACCOUNT=billingAccounts/XXXXXX-XXXXXX-XXXXXX $0 $PROJECT_ID"
fi

# ---------------------------------------------------------------------------
# 4. APIs
# ---------------------------------------------------------------------------
step "4/8 Enabling APIs"
SERVICES=(
  run.googleapis.com                  # the container host
  aiplatform.googleapis.com           # Vertex AI / Gemini, keyless via ADC
  firestore.googleapis.com            # data
  secretmanager.googleapis.com        # secrets injected into Cloud Run
  artifactregistry.googleapis.com     # image storage
  cloudbuild.googleapis.com           # builds, and smoke tests from Google's network
  identitytoolkit.googleapis.com      # Firebase Auth admin API (session cookies)
  cloudresourcemanager.googleapis.com # IAM policy edits
  firebase.googleapis.com             # addFirebase / web app config
  apikeys.googleapis.com              # the browser web API key
  firebaserules.googleapis.com        # publishing firestore.rules
)
info "this can take a couple of minutes on a fresh project"
# `services enable` is idempotent; enabling an already-enabled API is a no-op.
gcloud services enable "${SERVICES[@]}" --project="$PROJECT_ID" --quiet \
  || die "failed to enable APIs — check that billing really is active on ${PROJECT_ID}"
ok "enabled ${#SERVICES[@]} services"

# ---------------------------------------------------------------------------
# 5. Firestore, Artifact Registry, runtime service account
# ---------------------------------------------------------------------------
step "5/8 Firestore, Artifact Registry, service account"

if gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" >/dev/null 2>&1; then
  ok "Firestore (default) database already exists"
else
  info "creating Firestore Native database in ${FIRESTORE_LOCATION}"
  # Native mode (not Datastore mode) — the per-user document tree and the
  # Firebase Admin SDK both assume Native. The location is permanent.
  gcloud firestore databases create \
    --location="$FIRESTORE_LOCATION" \
    --type=firestore-native \
    --project="$PROJECT_ID" --quiet \
    || die "could not create Firestore database in ${FIRESTORE_LOCATION}"
  ok "Firestore created (${FIRESTORE_LOCATION}, Native mode)"
fi

if gcloud artifacts repositories describe "$AR_REPO" \
     --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  ok "Artifact Registry repo ${AR_REPO} already exists in ${REGION}"
else
  info "creating Artifact Registry docker repo ${AR_REPO} in ${REGION}"
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Container images for ${PROJECT_ID}" \
    --project="$PROJECT_ID" --quiet \
    || die "could not create Artifact Registry repo ${AR_REPO}"
  ok "repo created: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
fi

if gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  ok "runtime service account ${RUNTIME_SA_EMAIL} already exists"
else
  info "creating runtime service account ${RUNTIME_SA_ID}"
  gcloud iam service-accounts create "$RUNTIME_SA_ID" \
    --display-name="Cloud Run runtime for ${PROJECT_ID}" \
    --project="$PROJECT_ID" --quiet \
    || die "could not create service account ${RUNTIME_SA_ID}"
  ok "created ${RUNTIME_SA_EMAIL}"
fi

# ---------------------------------------------------------------------------
# 6. Runtime IAM
# ---------------------------------------------------------------------------
step "6/8 Runtime service account IAM"
grant() { # grant <member> <role>
  # add-iam-policy-binding is idempotent — re-adding an existing binding is a
  # no-op — so no check-then-create dance is needed here.
  # --condition=None keeps it non-interactive.
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$1" --role="$2" --condition=None --quiet >/dev/null
}

RUNTIME_ROLES=(
  roles/aiplatform.user                # Vertex AI with ADC — no model API key anywhere
  roles/datastore.user                 # Firestore read/write
  roles/secretmanager.secretAccessor   # read secrets injected into the service
  # --- gotcha #2 --------------------------------------------------------
  # roles/firebaseauth.admin is the one everybody forgets. Without it signup
  # SUCCEEDS (the browser talks to Firebase directly) and then every login
  # 500s forever, because createSessionCookie() calls the Identity Toolkit
  # *admin* API from the server. verifyIdToken() does NOT need it, so partial
  # auth flows look healthy. It passes typecheck, unit tests and a prod build.
  roles/firebaseauth.admin
)
for role in "${RUNTIME_ROLES[@]}"; do
  grant "serviceAccount:${RUNTIME_SA_EMAIL}" "$role"
  ok "${RUNTIME_SA_ID} -> ${role}"
done

# ---------------------------------------------------------------------------
# 7. Cloud Build identity IAM
# ---------------------------------------------------------------------------
# Which identity actually runs your builds depends on the project's age and its
# org policy: newer projects use the *compute* default SA, older ones the
# legacy cloudbuild SA. Probe for both and grant whichever exists; do not fail
# on the absent one.
step "7/8 Cloud Build identity IAM"
BUILD_ROLES=(
  roles/run.admin                 # deploy revisions
  roles/artifactregistry.writer   # push images
  roles/iam.serviceAccountUser    # act as the runtime SA on deploy
  roles/logging.logWriter         # required with logging: CLOUD_LOGGING_ONLY
)
BUILD_CANDIDATES=(
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
)
FOUND_BUILDER=0
for sa in "${BUILD_CANDIDATES[@]}"; do
  if gcloud iam service-accounts describe "$sa" --project="$PROJECT_ID" >/dev/null 2>&1; then
    FOUND_BUILDER=1
    for role in "${BUILD_ROLES[@]}"; do
      grant "serviceAccount:${sa}" "$role"
    done
    ok "${sa} -> ${BUILD_ROLES[*]}"
  else
    info "skipping ${sa} (does not exist in this project)"
  fi
done
[[ "$FOUND_BUILDER" -eq 1 ]] || warn \
  "neither Cloud Build identity exists yet. They are created lazily — run your
    first build (or 'gcloud builds submit'), then re-run this script to grant them."

# ---------------------------------------------------------------------------
# 8. Model access probe — gotcha #1
# ---------------------------------------------------------------------------
# The single most valuable early check in the whole build. On a brand-new
# project the per-base-model quota for some models is ZERO, so the very first
# request 429s and the only fix is a quota increase request that can take days.
# Finding that out after building a product on the model is the worst time.
# Availability also varies by (model, location) — probe the exact pair you ship.
#
# This never fails the script: everything provisioned above is still useful and
# you may simply need to choose a different model.
step "8/8 Model access probe — ${MODEL} @ ${MODEL_LOCATION}"
PROBE_STATUS=""
PROBE_BODY=""
if TOKEN="$(gcloud auth print-access-token 2>/dev/null)" && [[ -n "$TOKEN" ]]; then
  PROBE_URL="https://aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${MODEL_LOCATION}/publishers/google/models/${MODEL}:generateContent"
  PROBE_RAW="$(curl -sS -X POST "$PROBE_URL" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -H "x-goog-user-project: ${PROJECT_ID}" \
      -d '{"contents":[{"role":"user","parts":[{"text":"say ok"}]}]}' \
      -w $'\n%{http_code}' 2>/dev/null || true)"
  PROBE_STATUS="${PROBE_RAW##*$'\n'}"
  PROBE_BODY="${PROBE_RAW%$'\n'*}"
else
  warn "could not mint an access token; skipping the model probe"
fi

case "$PROBE_STATUS" in
  200)
    printf '    %s[MODEL OK]%s %s is reachable in %s with default quota.\n' \
      "$C_GREEN" "$C_RESET" "$MODEL" "$MODEL_LOCATION" ;;
  404)
    warn "[MODEL 404] '${MODEL}' is not served at location '${MODEL_LOCATION}', or the name is wrong.
    Model names on Vertex are bare — 'gemini-2.5-pro', no publishers/ prefix and no date suffix.
    Try MODEL_LOCATION=us-central1, or a different model." ;;
  403)
    warn "[MODEL 403] permission denied. The calling identity lacks roles/aiplatform.user
    (or the Vertex API is still propagating). Wait a minute and re-run." ;;
  429)
    warn "[MODEL 429] ZERO DEFAULT QUOTA for '${MODEL}' on this project.
    This is NOT rate limiting and NOT a permissions problem: the per-base-model
    quota defaults to 0 on new projects. Either pick another model — gemini-2.5-pro
    and gemini-2.5-flash worked with default quota in the reference build — or file
    a quota increase and wait (potentially days). Decide this BEFORE building on it." ;;
  "")
    warn "[MODEL ?] probe did not run." ;;
  *)
    warn "[MODEL ${PROBE_STATUS}] unexpected response:
$(printf '%s' "$PROBE_BODY" | head -c 600)" ;;
esac

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n%s%s%s\n' "$C_BOLD" "──────── provisioning summary ────────" "$C_RESET"
cat <<SUMMARY
  project id        ${PROJECT_ID}
  project number    ${PROJECT_NUMBER}
  region            ${REGION}
  firestore         (default) — Native, ${FIRESTORE_LOCATION}
  image repo        ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}
  runtime SA        ${RUNTIME_SA_EMAIL}
  runtime roles     ${RUNTIME_ROLES[*]}
  model probe       ${MODEL} @ ${MODEL_LOCATION} -> HTTP ${PROBE_STATUS:-skipped}

  Export these for the next steps:
    export PROJECT_ID=${PROJECT_ID}
    export REGION=${REGION}
    export RUNTIME_SA=${RUNTIME_SA_EMAIL}
    export IMAGE_REPO=${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}

  Next:
    ./scripts/firebase-setup.sh ${PROJECT_ID}     # Firebase, web app, auth, rules
    ./scripts/smoke-test.sh --url <service-url> --api-key <web api key>

  Reminder: Cloud Run does NOT inject GOOGLE_CLOUD_PROJECT (gotcha #3) — set it
  explicitly on the service in Terraform and in any 'gcloud run deploy'.
SUMMARY
printf '%s%s%s\n' "$C_BOLD" "──────────────────────────────────────" "$C_RESET"
