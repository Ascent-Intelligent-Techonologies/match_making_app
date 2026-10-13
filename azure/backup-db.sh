#!/usr/bin/env bash
#
# AnuRupa Matrimony — take a logical backup of the database and keep it in
# Blob Storage.
#
#   ./azure/backup-db.sh                 # dump to db-backups/anurupa-<UTC time>.dump
#   ./azure/backup-db.sh --keep-local    # also leave the file in azure/backups/
#
# Azure already keeps 7 days of point-in-time backups of the server itself.
# This is the second kind of copy: a portable pg_dump that lives outside the
# server, can be restored into any PostgreSQL (a new Azure server, a laptop,
# a different cloud), and survives the server being deleted. Take one before
# anything you would not want to undo by hand — a bulk import, a migration,
# a cleanup — and on a schedule if nobody is doing that.
#
# Needs: pg_dump (brew install libpq), az (signed in), and azure/.env.azure.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/azure/.env.azure"
CONTAINER="db-backups"
KEEP_LOCAL=0
[ "${1:-}" = "--keep-local" ] && KEEP_LOCAL=1

die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

need pg_dump "brew install libpq && brew link --force libpq"
need az "brew install azure-cli"
[ -f "$ENV_FILE" ] || die "No $ENV_FILE — run ./azure/infra.sh first."

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${DATABASE_URL:?DATABASE_URL missing from azure/.env.azure}"
: "${AZURE_STORAGE_ACCOUNT:?}" "${AZURE_STORAGE_KEY:?}"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
NAME="anurupa-${STAMP}.dump"
OUT_DIR="$REPO_ROOT/azure/backups"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/$NAME"

# Custom format: compressed, and pg_restore can pick tables out of it or
# restore in parallel. --no-owner/--no-privileges because the target server's
# admin user will not be called anurupa_admin everywhere this might be
# restored.
printf '▸ Dumping %s\n' "$(echo "$DATABASE_URL" | sed 's|.*@||; s|?.*||')"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "$OUT"
printf '  %s (%s)\n' "$NAME" "$(du -h "$OUT" | cut -f1)"

printf '▸ Uploading to %s/%s\n' "$AZURE_STORAGE_ACCOUNT" "$CONTAINER"
az storage blob upload \
  --account-name "$AZURE_STORAGE_ACCOUNT" --account-key "$AZURE_STORAGE_KEY" \
  --container-name "$CONTAINER" --name "$NAME" --file "$OUT" \
  --content-type application/octet-stream --only-show-errors -o none
printf '  done\n'

if [ "$KEEP_LOCAL" -eq 1 ]; then
  printf '  local copy kept at azure/backups/%s\n' "$NAME"
else
  rm -f "$OUT"
fi

printf '\nBackups in storage:\n'
az storage blob list \
  --account-name "$AZURE_STORAGE_ACCOUNT" --account-key "$AZURE_STORAGE_KEY" \
  --container-name "$CONTAINER" --query "[].{name:name, size:properties.contentLength}" \
  -o table --only-show-errors | tail -n +1
