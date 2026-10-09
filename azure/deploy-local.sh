#!/usr/bin/env bash
#
# AnuRupa Matrimony — deploy from this machine to Azure App Service.
#
# Does exactly what the Azure Pipeline does (azure-pipelines.yml), but from
# your laptop and reading your local .env files, so you can ship a fix without
# waiting on a push to main.
#
#   1. reads .env.local  (app secrets) and azure/.env.azure (infra coordinates)
#   2. builds the Next.js standalone bundle
#   3. pushes the secrets to App Service as app settings
#   4. zip-deploys the bundle
#   5. waits for the site to answer, and fails loudly if it doesn't
#
# Usage:
#   ./azure/deploy-local.sh                  # build, push settings, deploy
#   ./azure/deploy-local.sh --settings-only  # just re-push the env vars
#   ./azure/deploy-local.sh --skip-settings  # deploy code, leave settings alone
#   ./azure/deploy-local.sh --no-build       # reuse the last build
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.local}"
AZURE_ENV_FILE="${AZURE_ENV_FILE:-$REPO_ROOT/azure/.env.azure}"

# The settings that travel from your .env to App Service. Anything not in this
# list stays on your machine — an accidental DEBUG flag or a personal token
# should never follow a deploy into production.
FORWARDED_SETTINGS=(
  NEXT_PUBLIC_SITE_URL
  ADMIN_PASSWORD_HASH
  SESSION_SECRET
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL
  AZURE_STORAGE_ACCOUNT
  AZURE_STORAGE_PHOTOS_CONTAINER
  AZURE_STORAGE_JOURNEY_CONTAINER
)

DO_BUILD=1
DO_SETTINGS=1
DO_DEPLOY=1
for arg in "$@"; do
  case "$arg" in
    --no-build)      DO_BUILD=0 ;;
    --skip-settings) DO_SETTINGS=0 ;;
    --settings-only) DO_BUILD=0; DO_DEPLOY=0 ;;
    -h|--help)       sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

# ---------------------------------------------------------------- preflight --

need az "Install it with:  brew install azure-cli"
need node "Install Node 22:  brew install node@22"
need npm  "It ships with Node."
need zip  "It ships with macOS."

az account show >/dev/null 2>&1 || die "Not signed in. Run:  az login"

[ -f "$ENV_FILE" ] || die "No $ENV_FILE. Copy .env.example and fill it in."

# Both files are plain KEY=value. Sourcing them is what Next.js effectively
# does too, including turning the \$ escapes in the bcrypt hash back into $.
step "Reading environment"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
info "$(basename "$ENV_FILE")"
if [ -f "$AZURE_ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$AZURE_ENV_FILE"
  info "azure/$(basename "$AZURE_ENV_FILE")"
fi
set +a

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-${RESOURCE_GROUP:-}}"
APP_NAME="${AZURE_APP_NAME:-${APP_NAME:-}}"

[ -n "$RESOURCE_GROUP" ] || die "AZURE_RESOURCE_GROUP is not set. Run ./azure/infra.sh first."
[ -n "$APP_NAME" ]       || die "AZURE_APP_NAME is not set. Run ./azure/infra.sh first."

az webapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" -o none 2>/dev/null \
  || die "No web app '$APP_NAME' in '$RESOURCE_GROUP'. Run ./azure/infra.sh first."

SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://${APP_NAME}.azurewebsites.net}"

# A bcrypt hash that still carries its backslashes was escaped for the .env
# parser and un-escaped wrongly somewhere; sending it would lock you out.
if [ -n "${ADMIN_PASSWORD_HASH:-}" ]; then
  case "$ADMIN_PASSWORD_HASH" in
    \$2[aby]\$*) : ;;
    *) die "ADMIN_PASSWORD_HASH does not look like a bcrypt hash (expected it to start with \$2b\$)." ;;
  esac
fi

info "app         $APP_NAME"
info "group       $RESOURCE_GROUP"
info "site        $SITE_URL"

# -------------------------------------------------------------------- build --

STAGE="$REPO_ROOT/.azure-deploy"
ZIP_PATH="$REPO_ROOT/.azure-deploy.zip"

if [ "$DO_BUILD" -eq 1 ]; then
  step "Building"
  # AZURE_BUILD switches next.config.ts to `output: "standalone"`, which traces
  # just the files the server actually needs — about 50 MB instead of the
  # ~500 MB a full node_modules upload would be. On a B1 instance that is the
  # difference between a one-minute deploy and a five-minute one.
  info "npm ci"
  npm ci --no-audit --no-fund

  info "next build (standalone)"
  AZURE_BUILD=1 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SITE_URL="$SITE_URL" npm run build

  [ -f .next/standalone/server.js ] \
    || die "next build did not produce .next/standalone/server.js — is output:'standalone' wired up in next.config.ts?"

  step "Assembling the bundle"
  rm -rf "$STAGE" "$ZIP_PATH"
  mkdir -p "$STAGE/.next"
  cp -R .next/standalone/. "$STAGE/"
  # Standalone deliberately leaves these two out; they are served, not traced.
  cp -R .next/static "$STAGE/.next/static"
  if [ -d public ]; then cp -R public "$STAGE/public"; fi

  ( cd "$STAGE" && zip -r -q "$ZIP_PATH" . )
  info "$(du -h "$ZIP_PATH" | cut -f1) → $(basename "$ZIP_PATH")"
elif [ "$DO_DEPLOY" -eq 1 ]; then
  [ -f "$ZIP_PATH" ] || die "No $ZIP_PATH to deploy. Drop --no-build."
  info "reusing $(basename "$ZIP_PATH")"
fi

# ----------------------------------------------------------- app settings --

if [ "$DO_SETTINGS" -eq 1 ]; then
  step "Pushing app settings"
  export NEXT_PUBLIC_SITE_URL="$SITE_URL"
  settings_file="$(mktemp -t anurupa-settings)"
  chmod 600 "$settings_file"
  trap 'rm -f "$settings_file"' EXIT

  # Written to a file rather than passed as arguments: command lines are
  # visible to every process on the machine, and these are secrets.
  python3 - "$settings_file" "${FORWARDED_SETTINGS[@]}" <<'PY'
import json, os, sys
out, keys = sys.argv[1], sys.argv[2:]
entries = [
    {"name": k, "value": os.environ[k], "slotSetting": False}
    for k in keys
    if os.environ.get(k, "") != ""
]
with open(out, "w") as fh:
    json.dump(entries, fh)
print("\n".join(f"  {e['name']}" for e in entries))
PY

  az webapp config appsettings set \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --settings "@$settings_file" \
    -o none
  rm -f "$settings_file"
  info "written (values are not echoed)"
fi

# ------------------------------------------------------------------ deploy --

if [ "$DO_DEPLOY" -eq 1 ]; then
  step "Deploying"
  az webapp deploy \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --src-path "$ZIP_PATH" \
    --type zip \
    --async false \
    -o none
  info "uploaded and restarting"

  step "Waiting for the site"
  code=000
  for attempt in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_URL" || echo 000)"
    case "$code" in
      200|302|307) info "HTTP $code after ${attempt}0s"; break ;;
      *) printf '  .'; sleep 10 ;;
    esac
  done
  echo
  case "$code" in
    200|302|307) ;;
    *) die "The site answered HTTP $code. Check:  az webapp log tail -g $RESOURCE_GROUP -n $APP_NAME" ;;
  esac
fi

cat <<DONE

$(bold "Deployed.")

  $SITE_URL

  Logs    az webapp log tail -g $RESOURCE_GROUP -n $APP_NAME

DONE
