#!/usr/bin/env bash
#
# firebase-setup.sh — turn a provisioned GCP project into a working Firebase
# project: add Firebase, create the web app, print its public config, enable
# email/password auth, and publish firestore.rules.
#
# Everything is done over REST with `curl` + `gcloud auth print-access-token`,
# because the Firebase CLI needs its own login/token flow that does not exist in
# most CI and agent environments, while gcloud credentials already do.
#
# Idempotent: each step checks first and skips or falls back rather than failing
# on "already exists".
#
# See references/gotchas.md §9 (quota-project header), §12 (authorized domains),
# §13 (rules are not deployed automatically).

set -euo pipefail

# --- gotcha #11 -------------------------------------------------------------
# A preset CLOUDSDK_AUTH_ACCESS_TOKEN silently overrides `gcloud auth login`,
# and every call then fails UNAUTHENTICATED / ACCESS_TOKEN_TYPE_UNSUPPORTED.
unset CLOUDSDK_AUTH_ACCESS_TOKEN || true

# --- gotcha #17 -------------------------------------------------------------
# UID is readonly in bash; never use it as a variable name. Firebase user ids
# are held in LOCAL_ID / ACCOUNT_ID below.

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
RULES_FILE="${RULES_FILE:-firestore.rules}"
WEB_APP_NAME="${WEB_APP_NAME:-web}"
POLL_TIMEOUT="${POLL_TIMEOUT:-180}"     # seconds to wait on async Firebase ops
AUTHORIZE_DOMAIN=""                     # set by --authorize-domain

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
firebase-setup.sh — add Firebase to a GCP project and configure auth + rules

SYNOPSIS
  firebase-setup.sh [PROJECT_ID] [RULES_FILE]
  firebase-setup.sh --authorize-domain HOST [PROJECT_ID]
  firebase-setup.sh --help

POSITIONAL
  PROJECT_ID   project to configure (default: gcloud config's project)
  RULES_FILE   Firestore rules to publish (default: firestore.rules; skipped if absent)

OPTIONS
  --authorize-domain HOST   append HOST to Firebase Auth authorizedDomains and exit.
                            Run this after deploying, once the service URL exists.
                            Cloud Run answers on TWO hostname formats:
                              SERVICE-HASH-REGIONCODE.a.run.app
                              SERVICE-PROJECTNUMBER.REGION.run.app
                            Different commands report different ones — add BOTH or
                            auth breaks depending on which URL the user opens.
  --web-app-name NAME       display name for the web app (default: web)
  --help                    this text

ENVIRONMENT
  PROJECT_ID, RULES_FILE, WEB_APP_NAME, POLL_TIMEOUT (seconds, default 180), NO_COLOR

STEPS
  1. projects:addFirebase          (skipped if already a Firebase project; async)
  2. create a web app              (skipped if one exists; async)
  3. print the web app config      (apiKey / authDomain, copy-pasteable)
  4. initializeAuth + enable email/password sign-in
  5. publish firestore.rules       (create ruleset, then release cloud.firestore)

Safe to re-run.
HELP_EOF
}

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --authorize-domain) AUTHORIZE_DOMAIN="${2:-}"; [[ -n "$AUTHORIZE_DOMAIN" ]] || die "--authorize-domain needs a HOST"; shift 2 ;;
    --web-app-name) WEB_APP_NAME="${2:-}"; shift 2 ;;
    -*) die "unknown flag: $1 (try --help)" ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
if [[ ${#POSITIONAL[@]} -ge 1 ]]; then PROJECT_ID="${POSITIONAL[0]}"; fi
if [[ ${#POSITIONAL[@]} -ge 2 ]]; then RULES_FILE="${POSITIONAL[1]}"; fi

[[ -n "$PROJECT_ID" ]] || die "no project id. Pass one, or set PROJECT_ID, or 'gcloud config set project'."
command -v gcloud  >/dev/null 2>&1 || die "gcloud not found on PATH"
command -v curl    >/dev/null 2>&1 || die "curl not found on PATH"
command -v python3 >/dev/null 2>&1 || die "python3 not found on PATH (used for JSON, since sed cannot escape JSON safely)"

FIREBASE_API="https://firebase.googleapis.com/v1beta1"
IDP_API="https://identitytoolkit.googleapis.com"
RULES_API="https://firebaserules.googleapis.com/v1"

# ---------------------------------------------------------------------------
# REST plumbing
# ---------------------------------------------------------------------------
ACCESS_TOKEN=""
refresh_token() {
  ACCESS_TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"
  [[ -n "$ACCESS_TOKEN" ]] || die \
    "could not mint an access token. Run 'gcloud auth login'.
    If login looks fine but calls fail with ACCESS_TOKEN_TYPE_UNSUPPORTED, a preset
    CLOUDSDK_AUTH_ACCESS_TOKEN is shadowing your credentials (gotcha #11)."
}

# rest METHOD URL [JSON_BODY]
# Leaves the response body in RESP_BODY and the status code in RESP_CODE.
RESP_BODY=""; RESP_CODE=""
rest() {
  local method="$1" url="$2" body="${3:-}"
  local args=(-sS -X "$method" "$url"
    -H "Authorization: Bearer ${ACCESS_TOKEN}"
    -H "Content-Type: application/json"
    # --- gotcha #9 ------------------------------------------------------
    # With *user* credentials (which is what gcloud gives you, not a service
    # account), firebase / identitytoolkit / firebaserules all 403 with
    # "requires a quota project, which is not set by default" unless this
    # header names the project to bill the call against.
    -H "x-goog-user-project: ${PROJECT_ID}"
    -w $'\n%{http_code}')
  if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  local raw
  raw="$(curl "${args[@]}" 2>/dev/null || true)"
  RESP_CODE="${raw##*$'\n'}"
  RESP_BODY="${raw%$'\n'*}"
}

ok_code() { [[ "$RESP_CODE" =~ ^2[0-9][0-9]$ ]]; }

# json_get <dotted.path> — reads JSON on stdin, prints the value or nothing.
# Supports numeric indices for arrays, e.g. 'apps.0.appId'.
#
# python3, not sed: JSON is not a regular language and rules files contain
# quotes, braces and newlines that would break any sed-based extraction.
#
# The program lives in a variable and is passed with `python3 -c`, NOT as
# `python3 - <<HEREDOC`: with `-` python reads the *program* from stdin, which
# would swallow the JSON we are piping in and silently return nothing every time.
PY_JSON_GET='
import json, sys
path = sys.argv[1].split(".")
try:
    node = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for part in path:
    if isinstance(node, list):
        try:
            node = node[int(part)]
        except (ValueError, IndexError):
            sys.exit(0)
    elif isinstance(node, dict) and part in node:
        node = node[part]
    else:
        sys.exit(0)
if node is None:
    sys.exit(0)
if isinstance(node, (dict, list)):
    print(json.dumps(node))
elif isinstance(node, bool):
    print("true" if node else "false")
else:
    print(node)
'
json_get() { python3 -c "$PY_JSON_GET" "$1"; }

# PY_APPEND_DOMAIN — stdin: the current authorizedDomains array; argv[1]: the
# host to append. Prints either {"already":true} or the full PATCH payload.
PY_APPEND_DOMAIN='
import json, sys
host = sys.argv[1]
domains = json.load(sys.stdin)
if host in domains:
    print(json.dumps({"already": True}))
else:
    domains.append(host)
    print(json.dumps({"authorizedDomains": domains}))
'

err_snippet() { printf '%s' "$RESP_BODY" | tr -d '\n' | head -c 400; }

# ---------------------------------------------------------------------------
# --authorize-domain mode — gotcha #12
# ---------------------------------------------------------------------------
authorize_domain() {
  step "Authorizing domain ${AUTHORIZE_DOMAIN} for ${PROJECT_ID}"
  refresh_token
  rest GET "${IDP_API}/admin/v2/projects/${PROJECT_ID}/config"
  ok_code || die "could not read the Identity Platform config (HTTP ${RESP_CODE}): $(err_snippet)"

  local current
  current="$(printf '%s' "$RESP_BODY" | json_get authorizedDomains)"
  [[ -n "$current" ]] || current='[]'

  # Read-modify-write. PATCH with updateMask=authorizedDomains REPLACES the
  # whole list, so overwriting instead of appending would silently drop
  # localhost and the default <project>.firebaseapp.com domain and break auth.
  local payload
  payload="$(printf '%s' "$current" | python3 -c "$PY_APPEND_DOMAIN" "$AUTHORIZE_DOMAIN")"

  if [[ "$(printf '%s' "$payload" | json_get already)" == "true" ]]; then
    ok "${AUTHORIZE_DOMAIN} is already authorized — nothing to do"
    return 0
  fi

  rest PATCH "${IDP_API}/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains" "$payload"
  ok_code || die "failed to add ${AUTHORIZE_DOMAIN} (HTTP ${RESP_CODE}): $(err_snippet)"
  ok "authorized ${AUTHORIZE_DOMAIN}"
  info "current list: $(printf '%s' "$RESP_BODY" | json_get authorizedDomains)"
  cat <<'REMINDER_EOF'

    Reminder: Cloud Run serves the same service on TWO hostnames —
      SERVICE-HASH-REGIONCODE.a.run.app     (shown by some commands)
      SERVICE-PROJECTNUMBER.REGION.run.app  (shown by others)
    Authorize BOTH, or you get auth/unauthorized-domain depending on which URL
    the user happens to open. Re-run this with the other host.
REMINDER_EOF
}

if [[ -n "$AUTHORIZE_DOMAIN" ]]; then
  authorize_domain
  exit 0
fi

# ---------------------------------------------------------------------------
printf '%s%s%s\n' "$C_BOLD" "Firebase setup for ${PROJECT_ID}" "$C_RESET"
refresh_token

# ---------------------------------------------------------------------------
# 1. addFirebase
# ---------------------------------------------------------------------------
step "1/5 Firebase on the project"
rest GET "${FIREBASE_API}/projects/${PROJECT_ID}"
if ok_code; then
  ok "already a Firebase project"
else
  if [[ "$RESP_CODE" == "403" ]]; then
    warn "GET projects/${PROJECT_ID} returned 403 — if this repeats, the quota-project
    header or the firebase.googleapis.com API may be the problem: $(err_snippet)"
  fi
  info "calling projects:addFirebase"
  rest POST "${FIREBASE_API}/projects/${PROJECT_ID}:addFirebase" '{}'
  if ok_code; then
    # addFirebase returns a long-running operation; the project is not usable
    # until it reports done, so poll rather than racing ahead to webApps.
    OP_NAME="$(printf '%s' "$RESP_BODY" | json_get name)"
    if [[ -n "$OP_NAME" && "$OP_NAME" == operations/* ]]; then
      info "waiting on ${OP_NAME}"
      deadline=$(( $(date +%s) + POLL_TIMEOUT ))
      while :; do
        rest GET "${FIREBASE_API}/${OP_NAME}"
        if [[ "$(printf '%s' "$RESP_BODY" | json_get done)" == "true" ]]; then break; fi
        if [[ $(date +%s) -ge $deadline ]]; then
          warn "addFirebase operation still running after ${POLL_TIMEOUT}s; continuing anyway"
          break
        fi
        sleep 5
      done
    fi
    ok "Firebase added"
  elif printf '%s' "$RESP_BODY" | grep -qi 'already'; then
    ok "Firebase was already enabled"
  else
    die "addFirebase failed (HTTP ${RESP_CODE}): $(err_snippet)"
  fi
fi

# ---------------------------------------------------------------------------
# 2. Web app
# ---------------------------------------------------------------------------
step "2/5 Web app"
APP_ID=""
rest GET "${FIREBASE_API}/projects/${PROJECT_ID}/webApps"
if ok_code; then
  APP_ID="$(printf '%s' "$RESP_BODY" | json_get apps.0.appId)"
fi

if [[ -n "$APP_ID" ]]; then
  ok "web app already exists: ${APP_ID}"
else
  info "creating web app '${WEB_APP_NAME}'"
  rest POST "${FIREBASE_API}/projects/${PROJECT_ID}/webApps" \
    "$(printf '{"displayName":"%s"}' "$WEB_APP_NAME")"
  ok_code || die "could not create the web app (HTTP ${RESP_CODE}): $(err_snippet)"
  # Also asynchronous: the create returns an operation and the appId does not
  # exist yet. Poll the list until one appears rather than trusting the reply.
  info "waiting for the appId to appear"
  deadline=$(( $(date +%s) + POLL_TIMEOUT ))
  while :; do
    rest GET "${FIREBASE_API}/projects/${PROJECT_ID}/webApps"
    APP_ID="$(printf '%s' "$RESP_BODY" | json_get apps.0.appId)"
    if [[ -n "$APP_ID" ]]; then break; fi
    if [[ $(date +%s) -ge $deadline ]]; then
      die "web app was created but no appId appeared within ${POLL_TIMEOUT}s. Re-run this script."
    fi
    sleep 5
  done
  ok "created web app ${APP_ID}"
fi

# ---------------------------------------------------------------------------
# 3. Web app config
# ---------------------------------------------------------------------------
step "3/5 Web app config"
rest GET "${FIREBASE_API}/projects/${PROJECT_ID}/webApps/${APP_ID}/config"
ok_code || die "could not read the web app config (HTTP ${RESP_CODE}): $(err_snippet)"
API_KEY="$(printf '%s' "$RESP_BODY"      | json_get apiKey)"
AUTH_DOMAIN="$(printf '%s' "$RESP_BODY"  | json_get authDomain)"
SENDER_ID="$(printf '%s' "$RESP_BODY"    | json_get messagingSenderId)"
STORAGE_BUCKET="$(printf '%s' "$RESP_BODY" | json_get storageBucket)"

# The web API key is PUBLIC by design: it identifies the project to Firebase's
# client SDKs and ships inside every browser bundle. It is not a secret and does
# not need Secret Manager. That is precisely why deny-all Firestore rules matter
# (step 5): the key alone must grant an attacker nothing, because the browser
# never talks to Firestore directly — all access goes through the Admin SDK on
# the server, which bypasses rules by design.
printf '    %sPublic client config (safe to ship to browsers):%s\n' "$C_BOLD" "$C_RESET"
cat <<CONFIG_EOF

  FIREBASE_API_KEY=${API_KEY}
  FIREBASE_AUTH_DOMAIN=${AUTH_DOMAIN}
  FIREBASE_PROJECT_ID=${PROJECT_ID}
  FIREBASE_APP_ID=${APP_ID}
  FIREBASE_MESSAGING_SENDER_ID=${SENDER_ID}
  FIREBASE_STORAGE_BUCKET=${STORAGE_BUCKET}

CONFIG_EOF
# Serve these to the browser at RUNTIME (read on the server, passed to the client
# component as a prop) rather than inlining NEXT_PUBLIC_* at build time — that is
# what lets one image promote across dev/staging/prod (gotcha #15).

# ---------------------------------------------------------------------------
# 4. Auth: initialize, then enable email/password
# ---------------------------------------------------------------------------
step "4/5 Identity Platform / email+password sign-in"
rest POST "${IDP_API}/v2/projects/${PROJECT_ID}/identityPlatform:initializeAuth" '{}'
if ok_code; then
  ok "Identity Platform initialised"
elif printf '%s' "$RESP_BODY" | grep -qiE 'already|ALREADY_EXISTS|CONFIGURATION_EXISTS'; then
  # Re-initialising is a normal outcome on re-run, not a failure.
  ok "Identity Platform was already initialised"
else
  warn "initializeAuth returned HTTP ${RESP_CODE}: $(err_snippet)"
  warn "continuing — the PATCH below is the step that actually matters"
fi

rest PATCH "${IDP_API}/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email" \
  '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}'
ok_code || die "could not enable email/password sign-in (HTTP ${RESP_CODE}): $(err_snippet)"
ok "email/password sign-in enabled"

# ---------------------------------------------------------------------------
# 5. Firestore rules — gotcha #13
# ---------------------------------------------------------------------------
# A firestore.rules file in the repo has NO effect on the running database until
# it is published. Nothing warns you; the app keeps working and the default is
# permissive enough to matter. Publishing is two calls: create an immutable
# ruleset, then point the cloud.firestore release at it.
step "5/5 Firestore rules"
RULES_STATUS="skipped"
if [[ ! -f "$RULES_FILE" ]]; then
  warn "no rules file at '${RULES_FILE}' — skipping.
    Your database keeps whatever rules it already has. For this architecture the
    rules should deny everything: the browser never talks to Firestore directly."
else
  info "publishing ${RULES_FILE}"
  # python3 does the JSON escaping: rules files contain quotes, braces, slashes
  # and newlines, none of which survive a sed-based approach intact.
  RULESET_PAYLOAD="$(python3 - "$RULES_FILE" <<'PY_EOF'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    content = fh.read()
print(json.dumps({"source": {"files": [{"name": "firestore.rules", "content": content}]}}))
PY_EOF
)"
  rest POST "${RULES_API}/projects/${PROJECT_ID}/rulesets" "$RULESET_PAYLOAD"
  ok_code || die "could not create the ruleset (HTTP ${RESP_CODE}): $(err_snippet)"
  RULESET_NAME="$(printf '%s' "$RESP_BODY" | json_get name)"
  [[ -n "$RULESET_NAME" ]] || die "ruleset created but no name returned: $(err_snippet)"
  ok "ruleset ${RULESET_NAME}"

  RELEASE_PAYLOAD="$(printf '{"name":"projects/%s/releases/cloud.firestore","rulesetName":"%s"}' \
    "$PROJECT_ID" "$RULESET_NAME")"
  rest POST "${RULES_API}/projects/${PROJECT_ID}/releases" "$RELEASE_PAYLOAD"
  if ok_code; then
    ok "released cloud.firestore -> ${RULESET_NAME}"
    RULES_STATUS="published (created release)"
  else
    # On every run after the first the release already exists and POST fails
    # with ALREADY_EXISTS. Updating an existing release is a PATCH.
    info "release exists (HTTP ${RESP_CODE}) — updating it instead"
    rest PATCH "${RULES_API}/projects/${PROJECT_ID}/releases/cloud.firestore" \
      "$(printf '{"release":%s}' "$RELEASE_PAYLOAD")"
    if ok_code; then
      ok "released cloud.firestore -> ${RULESET_NAME}"
      RULES_STATUS="published (updated release)"
    else
      die "could not release the ruleset (HTTP ${RESP_CODE}): $(err_snippet)"
    fi
  fi

  # Verify rather than assume — gotcha #13 is invisible when it fails.
  rest GET "${RULES_API}/projects/${PROJECT_ID}/releases/cloud.firestore"
  if ok_code; then
    info "live ruleset: $(printf '%s' "$RESP_BODY" | json_get rulesetName)"
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n%s%s%s\n' "$C_BOLD" "──────── firebase setup summary ────────" "$C_RESET"
cat <<SUMMARY_EOF
  project           ${PROJECT_ID}
  web app id        ${APP_ID}
  api key           ${API_KEY}      (public by design — ships in the browser bundle)
  auth domain       ${AUTH_DOMAIN}
  sign-in           email/password enabled
  firestore rules   ${RULES_STATUS}

  Next:
    1. Deploy the service.
    2. Authorize BOTH Cloud Run hostnames (gotcha #12):
         $0 --authorize-domain SERVICE-HASH-REGIONCODE.a.run.app ${PROJECT_ID}
         $0 --authorize-domain SERVICE-PROJECTNUMBER.REGION.run.app ${PROJECT_ID}
    3. Prove it end to end:
         ./scripts/smoke-test.sh --url https://<host> --api-key ${API_KEY}

  If login 500s while signup works, it is roles/firebaseauth.admin on the Cloud
  Run runtime service account (gotcha #2), not your code. provision.sh grants it.
SUMMARY_EOF
printf '%s%s%s\n' "$C_BOLD" "────────────────────────────────────────" "$C_RESET"
