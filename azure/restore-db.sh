#!/usr/bin/env bash
#
# AnuRupa Matrimony — restore a pg_dump backup made by azure/backup-db.sh.
#
#   ./azure/restore-db.sh                              # list what is available
#   ./azure/restore-db.sh anurupa-2026-10-13T06-00-00Z.dump
#   ./azure/restore-db.sh <name> --into "postgresql://…"   # a different server
#
# By default this restores INTO THE PRODUCTION DATABASE in azure/.env.azure,
# replacing its contents with the backup's. It asks you to type the server
# name before it does. To rehearse a restore without touching production,
# pass --into with the URL of a scratch database.
#
# For "we deleted something an hour ago" the better tool is usually Azure's
# own point-in-time restore, which has every minute of the last 7 days:
#   az postgres flexible-server restore -g anurupa-rg --name anurupa-pg-restored \
#     --source-server anurupa-pg-8c72e8 --restore-time "2026-10-13T05:50:00Z"
# That makes a NEW server; point DATABASE_URL at it (or dump from it and
# restore here). This script is for the portable copy.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/azure/.env.azure"
CONTAINER="db-backups"

die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

need pg_restore "brew install libpq && brew link --force libpq"
need az "brew install azure-cli"
[ -f "$ENV_FILE" ] || die "No $ENV_FILE — run ./azure/infra.sh first."

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${AZURE_STORAGE_ACCOUNT:?}" "${AZURE_STORAGE_KEY:?}"

NAME="${1:-}"
TARGET="${DATABASE_URL:?DATABASE_URL missing from azure/.env.azure}"
if [ "${2:-}" = "--into" ]; then TARGET="${3:?--into needs a connection URL}"; fi

if [ -z "$NAME" ]; then
  printf 'Available backups:\n'
  az storage blob list \
    --account-name "$AZURE_STORAGE_ACCOUNT" --account-key "$AZURE_STORAGE_KEY" \
    --container-name "$CONTAINER" --query "[].{name:name, size:properties.contentLength}" \
    -o table --only-show-errors
  printf '\nRun again with a name to restore it.\n'
  exit 0
fi

HOST="$(echo "$TARGET" | sed 's|.*@||; s|:.*||')"
printf '\nThis will REPLACE every table in\n\n    %s\n\nwith the contents of %s.\n' "$HOST" "$NAME"
printf 'Type the host name to confirm: '
read -r confirm
[ "$confirm" = "$HOST" ] || die "Not confirmed; nothing was changed."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
printf '▸ Downloading %s\n' "$NAME"
az storage blob download \
  --account-name "$AZURE_STORAGE_ACCOUNT" --account-key "$AZURE_STORAGE_KEY" \
  --container-name "$CONTAINER" --name "$NAME" --file "$TMP/$NAME" --only-show-errors -o none

# --clean --if-exists drops each object before recreating it, so the result
# is the backup, not the backup layered over whatever was there. Done inside
# one transaction: either all of it lands or none of it does.
printf '▸ Restoring\n'
pg_restore --dbname "$TARGET" --clean --if-exists --no-owner --no-privileges \
  --single-transaction "$TMP/$NAME"

printf '▸ Checking\n'
psql "$TARGET" -tA -c "select 'profiles ' || count(*) from profiles union all select 'clients ' || count(*) from clients union all select 'photos ' || count(*) from profile_photos;" | sed 's/^/  /'
printf '\nRestored. Restart the app so its connection pool picks up fresh state:\n  az webapp restart -g anurupa-rg -n anurupa-8c72e8\n'
