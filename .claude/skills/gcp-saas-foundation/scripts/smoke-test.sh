#!/usr/bin/env bash
#
# smoke-test.sh — prove a deployment actually works, end to end.
#
# A green build proves almost nothing. This creates a real user, exchanges the
# ID token for a session, and calls an authenticated route against the DEPLOYED
# service. That is the only test that catches the failures that survive
# typecheck, unit tests and a production build (gotcha #2 in particular).
#
# By default it runs the test as a CLOUD BUILD STEP rather than locally, because
# agent sandboxes and locked-down CI commonly cannot reach *.run.app at all.
# Cloud Build executes from Google's network and can. Use --local when your own
# egress is fine.
#
# See references/gotchas.md §2, §17 (build wait, build logs, sandboxed egress).

set -euo pipefail

# --- gotcha #11 -------------------------------------------------------------
# A preset CLOUDSDK_AUTH_ACCESS_TOKEN silently overrides `gcloud auth login`
# and every call fails UNAUTHENTICATED / ACCESS_TOKEN_TYPE_UNSUPPORTED.
unset CLOUDSDK_AUTH_ACCESS_TOKEN || true

# --- gotcha #17 -------------------------------------------------------------
# UID is readonly in bash. The Firebase user id lives in LOCAL_ID here — never
# name it UID or the script dies with "UID: readonly variable".

# ---------------------------------------------------------------------------
# Config — env vars with defaults, overridable by flag or position.
# App-specific routes are all overridable: not every app uses these paths.
# ---------------------------------------------------------------------------
APP_URL="${APP_URL:-}"
API_KEY="${FIREBASE_API_KEY:-${API_KEY:-}}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-us-central1}"
RUN_LOCAL="${RUN_LOCAL:-0}"

HEALTH_PATH="${HEALTH_PATH:-/api/healthz}"
PROTECTED_PAGE_PATH="${PROTECTED_PAGE_PATH:-/dashboard}"
PROTECTED_API_PATH="${PROTECTED_API_PATH:-/api/me}"
SESSION_PATH="${SESSION_PATH:-/api/auth/session}"
ME_PATH="${ME_PATH:-/api/me}"
BUILD_TIMEOUT="${BUILD_TIMEOUT:-900}"      # seconds to wait for the build
KEEP_USER="${KEEP_USER:-0}"                # 1 = do not delete the throwaway user

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
  cat <<'HELP_EOF'
smoke-test.sh — end-to-end proof that a deployment works

SYNOPSIS
  smoke-test.sh --url https://HOST --api-key FIREBASE_WEB_API_KEY [options]
  smoke-test.sh [URL] [API_KEY] [options]
  smoke-test.sh --help

OPTIONS
  --url URL           deployed service base URL (no trailing slash)
  --api-key KEY       Firebase WEB api key (the public one; firebase-setup.sh prints it)
  --local             curl the service directly from here instead of via Cloud Build.
                      Only works if this machine can reach *.run.app — many agent
                      sandboxes cannot, which is why Cloud Build is the default.
  --project ID        GCP project (default: gcloud config's project)
  --region REGION     Cloud Build region (default: us-central1)
  --keep-user         do not delete the throwaway account afterwards
  --help              this text

WHAT IT CHECKS
  a  unauthenticated GET  $HEALTH_PATH            -> 200
  b  unauthenticated GET  $PROTECTED_PAGE_PATH    -> 3xx redirect to login
     unauthenticated GET  $PROTECTED_API_PATH     -> 401
  c  signUp a throwaway user via the Identity Toolkit REST API
  d  POST $SESSION_PATH with the idToken          -> 200 (sets a session cookie)
  e  authenticated GET $ME_PATH                   -> 200 and returns the account

ROUTE OVERRIDES (env vars — not every app uses these paths)
  HEALTH_PATH          default /api/healthz
  PROTECTED_PAGE_PATH  default /dashboard
  PROTECTED_API_PATH   default /api/me
  SESSION_PATH         default /api/auth/session
  ME_PATH              default /api/me

OTHER ENVIRONMENT
  APP_URL, FIREBASE_API_KEY, PROJECT_ID, REGION, BUILD_TIMEOUT (s, default 900),
  KEEP_USER=1, KEEP_WORKDIR=1 (keep the generated script + cloudbuild yaml), NO_COLOR

The throwaway account is deleted automatically when the project id is known.
HELP_EOF
}

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --url)      APP_URL="${2:-}";    shift 2 ;;
    --api-key)  API_KEY="${2:-}";    shift 2 ;;
    --project)  PROJECT_ID="${2:-}"; shift 2 ;;
    --region)   REGION="${2:-}";     shift 2 ;;
    --local)    RUN_LOCAL=1;         shift ;;
    --keep-user) KEEP_USER=1;        shift ;;
    -*) die "unknown flag: $1 (try --help)" ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
if [[ ${#POSITIONAL[@]} -ge 1 ]]; then APP_URL="${POSITIONAL[0]}"; fi
if [[ ${#POSITIONAL[@]} -ge 2 ]]; then API_KEY="${POSITIONAL[1]}"; fi

[[ -n "$APP_URL" ]] || die "no service URL. Pass --url https://HOST (or set APP_URL)."
APP_URL="${APP_URL%/}"   # a trailing slash produces //api/... and 404s
if [[ -z "$API_KEY" ]]; then
  warn "no --api-key: only the unauthenticated checks (a, b) will run.
    The Firebase web API key is printed by scripts/firebase-setup.sh. It is public
    by design, so passing it on a command line is fine."
fi
command -v curl >/dev/null 2>&1 || die "curl not found on PATH"
if [[ "$RUN_LOCAL" != "1" ]]; then
  command -v gcloud >/dev/null 2>&1 || die "gcloud not found on PATH (needed for the Cloud Build runner; or use --local)"
  [[ -n "$PROJECT_ID" ]] || die "no project id for the Cloud Build runner. Pass --project, or use --local."
fi

printf '%s%s%s\n' "$C_BOLD" "Smoke test — ${APP_URL}" "$C_RESET"
info "runner=$([[ "$RUN_LOCAL" == "1" ]] && echo local || echo "cloud build (${REGION})")  project=${PROJECT_ID:-<unset>}"

WORKDIR="$(mktemp -d)"
# KEEP_WORKDIR=1 leaves the generated test script and cloudbuild YAML on disk,
# which is how you debug the runner itself rather than the app.
if [[ "${KEEP_WORKDIR:-0}" == "1" ]]; then
  info "keeping generated files in ${WORKDIR}"
else
  trap 'rm -rf "$WORKDIR"' EXIT
fi
TEST_SCRIPT="${WORKDIR}/smoke.sh"
LOG_FILE="${WORKDIR}/smoke.log"

# ---------------------------------------------------------------------------
# Build the test script.
#
# The SAME script runs locally and inside Cloud Build, so the two runners cannot
# drift. Config is emitted as a prelude of shell assignments; the body below is
# static.
#
# The body deliberately avoids python3 and jq: gcr.io/cloud-builders/curl is a
# minimal image and neither is guaranteed to be present. Extracting two fields
# from a known-shape JSON response with grep is acceptable here — unlike in
# firebase-setup.sh, which builds JSON and must use a real serializer.
# ---------------------------------------------------------------------------
{
  printf 'URL=%s\n'                 "'${APP_URL}'"
  printf 'KEY=%s\n'                 "'${API_KEY}'"
  printf 'HEALTH_PATH=%s\n'         "'${HEALTH_PATH}'"
  printf 'PROTECTED_PAGE_PATH=%s\n' "'${PROTECTED_PAGE_PATH}'"
  printf 'PROTECTED_API_PATH=%s\n'  "'${PROTECTED_API_PATH}'"
  printf 'SESSION_PATH=%s\n'        "'${SESSION_PATH}'"
  printf 'ME_PATH=%s\n'             "'${ME_PATH}'"
} > "$TEST_SCRIPT"

cat >> "$TEST_SCRIPT" <<'TEST_BODY_EOF'
set -u
PASSES=0
FAILS=0
LOCAL_ID=""
JAR="/tmp/smoke-cookies.txt"
: > "$JAR"

pass() { PASSES=$((PASSES + 1)); echo "  PASS  $*"; }
fail() { FAILS=$((FAILS + 1));   echo "  FAIL  $*"; }
note() { echo "        $*"; }

# Pull one string field out of a JSON response. See the comment above about why
# this is grep and not a JSON parser.
extract() {
  grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -n1 | sed -e 's/.*:[[:space:]]*"//' -e 's/"$//'
}

echo "== smoke test against $URL"

# --- (a) health -------------------------------------------------------------
echo "-- (a) unauthenticated health check"
CODE=$(curl -s -o /tmp/a.out -w '%{http_code}' --max-time 45 "$URL$HEALTH_PATH" || echo 000)
if [ "$CODE" = "200" ]; then
  pass "GET $HEALTH_PATH -> 200"
else
  fail "GET $HEALTH_PATH -> $CODE (expected 200)"
  note "000 means the request never completed — service down, or this runner cannot reach it."
  note "$(head -c 300 /tmp/a.out 2>/dev/null)"
fi

# --- (b) unauthenticated access is refused ----------------------------------
echo "-- (b) unauthenticated access is refused"
# No -L: the redirect itself is the thing being asserted.
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 45 "$URL$PROTECTED_PAGE_PATH" || echo 000)
case "$CODE" in
  30*) pass "GET $PROTECTED_PAGE_PATH -> $CODE (redirects to login)" ;;
  401|403) pass "GET $PROTECTED_PAGE_PATH -> $CODE (refused)" ;;
  *) fail "GET $PROTECTED_PAGE_PATH -> $CODE (expected a 3xx redirect)"
     note "200 here means a protected page renders for anonymous visitors." ;;
esac

CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 45 "$URL$PROTECTED_API_PATH" || echo 000)
case "$CODE" in
  401) pass "GET $PROTECTED_API_PATH -> 401" ;;
  403) pass "GET $PROTECTED_API_PATH -> 403 (refused)" ;;
  *) fail "GET $PROTECTED_API_PATH -> $CODE (expected 401)" ;;
esac

if [ -z "$KEY" ]; then
  # Still emit a verdict: a run with no verdict line is reported INCONCLUSIVE.
  echo "-- (c-e) skipped: no Firebase web API key supplied"
  echo "SMOKE_SUMMARY passes=$PASSES fails=$FAILS"
  if [ "$FAILS" -eq 0 ]; then echo "SMOKE_RESULT=PASS"; exit 0; fi
  echo "SMOKE_RESULT=FAIL"
  exit 1
fi

# --- (c) create a throwaway user -------------------------------------------
echo "-- (c) sign up a throwaway user"
STAMP=$(date +%s)
EMAIL="smoketest+$STAMP@example.com"
PASSWORD="Smoke-$STAMP-Aa1!"
SIGNUP=$(curl -s --max-time 45 \
  -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"returnSecureToken\":true}" || echo '')
ID_TOKEN=$(echo "$SIGNUP" | extract idToken)
LOCAL_ID=$(echo "$SIGNUP" | extract localId)

if [ -n "$ID_TOKEN" ]; then
  pass "signUp $EMAIL"
  # Marker line: the caller greps this out of the build log to delete the account.
  echo "SMOKE_LOCAL_ID=$LOCAL_ID"
else
  fail "signUp failed"
  note "$(echo "$SIGNUP" | head -c 400)"
  note "OPERATION_NOT_ALLOWED means email/password sign-in is off — run firebase-setup.sh."
  note "API key not valid means the wrong key: it is the *web* key from the app config."
  echo "SMOKE_SUMMARY passes=$PASSES fails=$FAILS"
  echo "SMOKE_RESULT=FAIL"
  exit 1
fi

# --- (d) exchange the ID token for a session cookie -------------------------
echo "-- (d) exchange the idToken for a session"
CODE=$(curl -s -o /tmp/d.out -c "$JAR" -w '%{http_code}' --max-time 45 \
  -X POST "$URL$SESSION_PATH" \
  -H 'Content-Type: application/json' \
  -d "{\"idToken\":\"$ID_TOKEN\"}" || echo 000)
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ] || [ "$CODE" = "204" ]; then
  pass "POST $SESSION_PATH -> $CODE"
else
  fail "POST $SESSION_PATH -> $CODE (expected 200)"
  note "$(head -c 300 /tmp/d.out 2>/dev/null)"
  if [ "$CODE" = "500" ]; then
    note "A 500 HERE IS ALMOST ALWAYS THE MISSING roles/firebaseauth.admin ON THE"
    note "CLOUD RUN RUNTIME SERVICE ACCOUNT (gotchas.md #2). createSessionCookie()"
    note "calls the Identity Toolkit *admin* API; verifyIdToken() does not, which is"
    note "why signup works and only login breaks. Fix:"
    note "  gcloud projects add-iam-policy-binding PROJECT \\"
    note "    --member=serviceAccount:app-run@PROJECT.iam.gserviceaccount.com \\"
    note "    --role=roles/firebaseauth.admin"
    note "then redeploy (or wait for IAM propagation) and re-run this test."
  fi
fi

# --- (e) authenticated request ---------------------------------------------
echo "-- (e) authenticated request with the session cookie"
CODE=$(curl -s -b "$JAR" -o /tmp/e.out -w '%{http_code}' --max-time 45 "$URL$ME_PATH" || echo 000)
if [ "$CODE" = "200" ]; then
  BODY=$(head -c 300 /tmp/e.out 2>/dev/null)
  case "$BODY" in
    *"$EMAIL"*) pass "GET $ME_PATH -> 200 and returns the signed-in account" ;;
    *) pass "GET $ME_PATH -> 200"
       note "body did not contain the test email; check it identifies the right user:"
       note "$BODY" ;;
  esac
else
  fail "GET $ME_PATH -> $CODE (expected 200)"
  note "$(head -c 300 /tmp/e.out 2>/dev/null)"
  note "A 401 here with (d) green means the session cookie is not being set or read"
  note "(cookie name, Secure/SameSite attributes, or domain mismatch)."
fi

# --- (f) summary ------------------------------------------------------------
echo "-- summary"
echo "SMOKE_SUMMARY passes=$PASSES fails=$FAILS"
if [ "$FAILS" -eq 0 ]; then
  echo "SMOKE_RESULT=PASS"
  exit 0
fi
echo "SMOKE_RESULT=FAIL"
exit 1
TEST_BODY_EOF

# ---------------------------------------------------------------------------
# Run it
# ---------------------------------------------------------------------------
RUNNER_STATUS=""
if [[ "$RUN_LOCAL" == "1" ]]; then
  step "Running locally"
  # Do not let a failing assertion kill this script before the summary prints.
  set +e
  bash "$TEST_SCRIPT" > "$LOG_FILE" 2>&1
  RUNNER_RC=$?
  set -e
  RUNNER_STATUS="$([[ $RUNNER_RC -eq 0 ]] && echo SUCCESS || echo FAILURE)"
  cat "$LOG_FILE"
else
  step "Running as a Cloud Build step (from Google's network)"
  CFG="${WORKDIR}/smoke.cloudbuild.yaml"
  {
    echo "steps:"
    echo "  - name: 'gcr.io/cloud-builders/curl'"
    echo "    id: 'smoke'"
    # The image's entrypoint is curl itself, so override it to get a shell.
    echo "    entrypoint: 'bash'"
    echo "    args:"
    echo "      - '-c'"
    echo "      - |"
    # --- Cloud Build substitutions ---------------------------------------
    # Cloud Build expands $FOO and ${FOO} in the config as *substitutions*
    # before the step runs, so an unescaped shell variable becomes an empty
    # string or an "invalid key" error. A literal dollar is written $$.
    # Hence: escape every $ in the script body, then indent it into the block
    # scalar.
    sed -e 's/\$/$$/g' -e 's/^/        /' "$TEST_SCRIPT"
    echo "options:"
    # Builds without a bucket/service account for logs fail unless logging is
    # pinned to Cloud Logging. Requires roles/logging.logWriter on the build
    # identity — provision.sh grants it.
    echo "  logging: CLOUD_LOGGING_ONLY"
    echo "timeout: '${BUILD_TIMEOUT}s'"
  } > "$CFG"

  info "submitting build (--no-source: there is nothing to upload)"
  BUILD_ID="$(gcloud builds submit --no-source \
      --config="$CFG" \
      --project="$PROJECT_ID" \
      --region="$REGION" \
      --async \
      --format='value(id)' 2>/dev/null | tr -d '[:space:]' || true)"
  [[ -n "$BUILD_ID" ]] || die \
    "could not submit the build. Check that cloudbuild.googleapis.com is enabled and
    that the caller may run builds in ${REGION}. Re-run with --local if this machine
    can reach ${APP_URL} directly."
  info "build ${BUILD_ID}"

  # --- gotcha #17: waiting on a build ----------------------------------
  # Statuses go QUEUED -> WORKING -> terminal. A loop written as
  #   until [ "$s" != "WORKING" ]
  # exits immediately on the very first QUEUED reading and everything
  # downstream then reads a half-finished build. Test for a TERMINAL status.
  step "Waiting for the build"
  DEADLINE=$(( $(date +%s) + BUILD_TIMEOUT + 60 ))
  while :; do
    RUNNER_STATUS="$(gcloud builds describe "$BUILD_ID" \
      --region="$REGION" --project="$PROJECT_ID" \
      --format='value(status)' 2>/dev/null | tr -d '[:space:]' || true)"
    case "$RUNNER_STATUS" in
      SUCCESS|FAILURE|TIMEOUT|CANCELLED|INTERNAL_ERROR|EXPIRED) break ;;
    esac
    if [[ $(date +%s) -ge $DEADLINE ]]; then
      warn "build ${BUILD_ID} still ${RUNNER_STATUS:-unknown} after the timeout; fetching logs anyway"
      break
    fi
    printf '    status: %-10s\r' "${RUNNER_STATUS:-?}"
    sleep 5
  done
  printf '    status: %-10s\n' "${RUNNER_STATUS:-unknown}"

  # --- gotcha #17: build output is not in the submit output --------------
  # With logging: CLOUD_LOGGING_ONLY, `builds submit` prints a summary only.
  # The step's stdout has to be read back explicitly.
  step "Build log"
  gcloud builds log "$BUILD_ID" --region="$REGION" --project="$PROJECT_ID" \
    > "$LOG_FILE" 2>/dev/null || warn "could not fetch the build log"
  cat "$LOG_FILE"
fi

# ---------------------------------------------------------------------------
# Clean up the throwaway account
# ---------------------------------------------------------------------------
LOCAL_ID="$(grep -o 'SMOKE_LOCAL_ID=[A-Za-z0-9_-]*' "$LOG_FILE" 2>/dev/null | head -n1 | cut -d= -f2 || true)"
CLEANUP_NOTE="no throwaway account was created"
if [[ -n "$LOCAL_ID" ]]; then
  CLEANUP_NOTE="account ${LOCAL_ID} NOT deleted"
  if [[ "$KEEP_USER" == "1" ]]; then
    warn "--keep-user: leaving ${LOCAL_ID} in place"
  elif [[ -z "$PROJECT_ID" ]]; then
    warn "project id unknown, so the throwaway account was left behind. Delete it with:
    curl -X POST -H \"Authorization: Bearer \$(gcloud auth print-access-token)\" \\
      -H 'Content-Type: application/json' -H 'x-goog-user-project: PROJECT_ID' \\
      https://identitytoolkit.googleapis.com/v1/projects/PROJECT_ID/accounts:delete \\
      -d '{\"localId\":\"${LOCAL_ID}\"}'"
  else
    step "Deleting the throwaway account"
    TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"
    if [[ -n "$TOKEN" ]]; then
      # x-goog-user-project is required with user credentials (gotcha #9).
      DEL_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
        -X POST "https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:delete" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d "$(printf '{"localId":"%s"}' "$LOCAL_ID")" 2>/dev/null || echo 000)"
      if [[ "$DEL_CODE" =~ ^2 ]]; then
        ok "deleted ${LOCAL_ID}"
        CLEANUP_NOTE="account ${LOCAL_ID} deleted"
      else
        warn "delete returned HTTP ${DEL_CODE} — remove ${LOCAL_ID} by hand in the Firebase console"
      fi
    else
      warn "no access token; delete ${LOCAL_ID} by hand in the Firebase console"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
SUMMARY_LINE="$(grep -o 'SMOKE_SUMMARY passes=[0-9]* fails=[0-9]*' "$LOG_FILE" 2>/dev/null | tail -n1 || true)"
RESULT="$(grep -o 'SMOKE_RESULT=[A-Z]*' "$LOG_FILE" 2>/dev/null | tail -n1 | cut -d= -f2 || true)"
if [[ -z "$RESULT" ]]; then
  # The step never reached its own summary (build infrastructure failure,
  # timeout, or unreachable service).
  RESULT="INCONCLUSIVE"
fi

printf '\n%s%s%s\n' "$C_BOLD" "──────── smoke test summary ────────" "$C_RESET"
cat <<SUMMARY_EOF
  target        ${APP_URL}
  runner        $([[ "$RUN_LOCAL" == "1" ]] && echo "local curl" || echo "cloud build ${BUILD_ID:-?} (${REGION})")
  runner status ${RUNNER_STATUS:-unknown}
  assertions    ${SUMMARY_LINE:-none recorded}
  cleanup       ${CLEANUP_NOTE}
SUMMARY_EOF
case "$RESULT" in
  PASS)
    if [[ -z "$API_KEY" ]]; then
      printf '  result        %sPASS%s — unauthenticated checks only (no --api-key, so the auth flow was NOT tested).\n' "$C_YELLOW" "$C_RESET"
    else
      printf '  result        %sPASS%s — signup, session exchange and an authenticated call all worked.\n' "$C_GREEN" "$C_RESET"
    fi ;;
  FAIL) printf '  result        %sFAIL%s — read the per-check notes above; they name the likely cause.\n' "$C_RED" "$C_RESET" ;;
  *)    printf '  result        %sINCONCLUSIVE%s — the test never produced a verdict. Check the log above.\n' "$C_YELLOW" "$C_RESET" ;;
esac
printf '%s%s%s\n' "$C_BOLD" "────────────────────────────────────" "$C_RESET"

[[ "$RESULT" == "PASS" ]] || exit 1
