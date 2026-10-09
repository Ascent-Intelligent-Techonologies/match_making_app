#!/usr/bin/env bash
#
# AnuRupa Matrimony — Azure infrastructure.
#
# Creates everything the platform runs on, in Azure Central India, at the
# cheapest tier that is still a production tier (see docs/cloud-cost-comparison.pdf):
#
#   • Resource group
#   • App Service plan            Basic B1, Linux          ~₹1,261 / month
#   • Web App                     Node 22 LTS              (in the plan above)
#   • PostgreSQL Flexible Server  Burstable B1ms, 32 GB    ~₹2,119 / month
#                                 (free for 12 months on a new account)
#   • Storage account             Standard LRS, hot        ~₹90 / month at 25 GB
#                                 two private containers
#
# Everything here is idempotent: run it as often as you like. It creates what
# is missing, updates what has drifted, and leaves the rest alone. It never
# deletes anything.
#
# Usage:
#   ./azure/infra.sh                 # show the plan, ask before creating
#   ./azure/infra.sh --yes           # no prompt (for CI)
#   ./azure/infra.sh --skip-schema   # provision only, don't load the SQL schema
#
# Everything is overridable from the environment, e.g.
#   LOCATION=southindia APP_NAME=anurupa-prod ./azure/infra.sh
#
set -euo pipefail

# ---------------------------------------------------------------- settings --

LOCATION="${LOCATION:-centralindia}"
RESOURCE_GROUP="${RESOURCE_GROUP:-anurupa-rg}"

PLAN_NAME="${PLAN_NAME:-anurupa-plan}"
PLAN_SKU="${PLAN_SKU:-B1}"

# App Service and storage account names are part of a public DNS name, so they
# have to be unique across all of Azure. A short hash of the subscription keeps
# them unique without making them unreadable, and keeps this script idempotent:
# the same subscription always derives the same names.
APP_BASENAME="${APP_BASENAME:-anurupa}"

PG_VERSION="${PG_VERSION:-17}"
PG_SKU="${PG_SKU:-Standard_B1ms}"     # 1 vCore, 2 GB — the Burstable entry tier
PG_TIER="${PG_TIER:-Burstable}"
PG_STORAGE_GB="${PG_STORAGE_GB:-32}"
PG_BACKUP_DAYS="${PG_BACKUP_DAYS:-7}"
PG_DATABASE="${PG_DATABASE:-anurupa}"
PG_ADMIN_USER="${PG_ADMIN_USER:-anurupa_admin}"

NODE_RUNTIME="${NODE_RUNTIME:-NODE|22-lts}"
PHOTOS_CONTAINER="${PHOTOS_CONTAINER:-profile-photos}"
JOURNEY_CONTAINER="${JOURNEY_CONTAINER:-journey-media}"

TAGS=(project=anurupa-matrimony managed-by=infra.sh)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_SOURCE="$REPO_ROOT/supabase/setup.sql"
OUTPUT_ENV="$REPO_ROOT/azure/.env.azure"   # git-ignored; read by deploy-local.sh

ASSUME_YES=0
SKIP_SCHEMA=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y)      ASSUME_YES=1 ;;
    --skip-schema) SKIP_SCHEMA=1 ;;
    -h|--help)     sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# ----------------------------------------------------------------- helpers --

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
info()  { printf '  %s\n' "$*"; }
die()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed. $2"; }

# ---------------------------------------------------------------- preflight --

need az "Install it with:  brew install azure-cli"
need openssl "It ships with macOS; check your PATH."

az account show >/dev/null 2>&1 || die "Not signed in. Run:  az login"

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
SUBSCRIPTION_NAME="$(az account show --query name -o tsv)"

# Deterministic 6-character suffix, so names are stable across runs.
SUFFIX="$(printf '%s' "$SUBSCRIPTION_ID$APP_BASENAME" | shasum -a 256 | cut -c1-6)"
APP_NAME="${APP_NAME:-${APP_BASENAME}-${SUFFIX}}"
PG_SERVER="${PG_SERVER:-${APP_BASENAME}-pg-${SUFFIX}}"
# Storage account names: 3–24 chars, lowercase letters and digits only.
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-${APP_BASENAME}st${SUFFIX}}"

MY_IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
[ -n "$MY_IP" ] || info "Could not detect your public IP; skipping the admin firewall rule."

cat <<PLAN

$(bold "AnuRupa Matrimony — Azure infrastructure")

  Subscription     $SUBSCRIPTION_NAME
                   $SUBSCRIPTION_ID
  Region           $LOCATION
  Resource group   $RESOURCE_GROUP

  App Service      $APP_NAME            ($PLAN_SKU Linux, $NODE_RUNTIME)
  PostgreSQL       $PG_SERVER           ($PG_TIER $PG_SKU, ${PG_STORAGE_GB} GB, v$PG_VERSION)
  Storage          $STORAGE_ACCOUNT     (Standard_LRS, 2 private containers)

  Estimated cost   about ₹3,470 / month at the volumes in docs/cloud-cost-comparison.pdf

PLAN

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Create or update these resources? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "Nothing was changed."; exit 0; }
fi

# ------------------------------------------------------- resource providers --

step "Registering resource providers"
for provider in Microsoft.Web Microsoft.DBforPostgreSQL Microsoft.Storage; do
  state="$(az provider show --namespace "$provider" --query registrationState -o tsv 2>/dev/null || echo NotRegistered)"
  if [ "$state" != "Registered" ]; then
    info "$provider → registering (this can take a minute)"
    az provider register --namespace "$provider" --wait -o none
  else
    info "$provider → already registered"
  fi
done

# ----------------------------------------------------------- resource group --

step "Resource group"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags "${TAGS[@]}" \
  -o none
info "$RESOURCE_GROUP in $LOCATION"

# ------------------------------------------------------------------ storage --

step "Storage account"
if az storage account show -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" -o none 2>/dev/null; then
  info "$STORAGE_ACCOUNT already exists"
else
  az storage account create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$STORAGE_ACCOUNT" \
    --location "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --access-tier Hot \
    --min-tls-version TLS1_2 \
    --https-only true \
    --allow-blob-public-access false \
    --tags "${TAGS[@]}" \
    -o none
  info "created $STORAGE_ACCOUNT"
fi

# Containers are private: nothing in them is reachable without a signed URL,
# which is the same posture the Supabase buckets have today.
STORAGE_KEY="$(az storage account keys list -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" --query '[0].value' -o tsv)"
for container in "$PHOTOS_CONTAINER" "$JOURNEY_CONTAINER"; do
  az storage container create \
    --account-name "$STORAGE_ACCOUNT" \
    --account-key "$STORAGE_KEY" \
    --name "$container" \
    --public-access off \
    -o none
  info "container $container (private)"
done

# ---------------------------------------------------------------- postgres --

step "PostgreSQL flexible server"
PG_CREATED=0

# A previous run may already have created the server and saved its password.
# Re-reading it here is what makes this script resumable: without it a second
# run would have a server it cannot log in to.
PG_ADMIN_PASSWORD=""
if [ -f "$OUTPUT_ENV" ]; then
  saved="$(sed -n 's|^DATABASE_URL=postgresql://[^:]*:\([^@]*\)@.*|\1|p' "$OUTPUT_ENV" | head -n 1 || true)"
  saved_host="$(sed -n 's|^AZURE_PG_HOST=\(.*\)|\1|p' "$OUTPUT_ENV" | head -n 1 || true)"
  if [ -n "$saved" ] && [ "$saved_host" = "${PG_SERVER}.postgres.database.azure.com" ]; then
    PG_ADMIN_PASSWORD="$saved"
    info "reusing the admin password recorded in azure/.env.azure"
  fi
fi

if az postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_SERVER" -o none 2>/dev/null; then
  info "$PG_SERVER already exists"
  if [ -z "$PG_ADMIN_PASSWORD" ]; then
    # The server exists but nothing recorded its password — an earlier run
    # failed before writing it out. Rotating is the only way forward, and is
    # safe: the new value is written to app settings and azure/.env.azure in
    # the same run.
    PG_RANDOM="$(openssl rand -base64 48 | tr -d '/+=\n')"
    PG_ADMIN_PASSWORD="Az9${PG_RANDOM:0:29}"
    info "no saved password — resetting the admin password"
    az postgres flexible-server update \
      --resource-group "$RESOURCE_GROUP" \
      --name "$PG_SERVER" \
      --admin-password "$PG_ADMIN_PASSWORD" \
      -o none
    PG_CREATED=1
  fi
else
  # Alphanumeric only: this password ends up inside a URL, and encoding rules
  # around '@', ':' and '/' are a classic source of silent connection failures.
  # The "Az9" prefix guarantees the upper/lower/digit mix Azure insists on, and
  # the trimming is parameter expansion rather than `| head`, which would send
  # SIGPIPE upstream and — under `set -o pipefail` — abort the whole script.
  PG_RANDOM="$(openssl rand -base64 48 | tr -d '/+=\n')"
  PG_ADMIN_PASSWORD="Az9${PG_RANDOM:0:29}"
  info "creating $PG_SERVER — this takes 3–5 minutes"
  az postgres flexible-server create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PG_SERVER" \
    --location "$LOCATION" \
    --admin-user "$PG_ADMIN_USER" \
    --admin-password "$PG_ADMIN_PASSWORD" \
    --tier "$PG_TIER" \
    --sku-name "$PG_SKU" \
    --storage-size "$PG_STORAGE_GB" \
    --storage-auto-grow Disabled \
    --version "$PG_VERSION" \
    --backup-retention "$PG_BACKUP_DAYS" \
    --public-access Enabled \
    --tags "${TAGS[@]}" \
    --yes \
    -o none
  PG_CREATED=1
  info "created $PG_SERVER"
fi

# Checked rather than created-and-ignored: an `|| true` here once hid a
# wrong flag name, and the schema step then failed with "database does not
# exist" several minutes later.
if az postgres flexible-server db show \
     --resource-group "$RESOURCE_GROUP" \
     --server-name "$PG_SERVER" \
     --database-name "$PG_DATABASE" -o none 2>/dev/null; then
  info "database $PG_DATABASE already exists"
else
  az postgres flexible-server db create \
    --resource-group "$RESOURCE_GROUP" \
    --server-name "$PG_SERVER" \
    --name "$PG_DATABASE" \
    -o none
  info "created database $PG_DATABASE"
fi

# setup.sql opens with `create extension pgcrypto`, and Flexible Server refuses
# any extension that is not on this allow-list first.
az postgres flexible-server parameter set \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$PG_SERVER" \
  --name azure.extensions \
  --value pgcrypto \
  -o none
info "allow-listed the pgcrypto extension"

PG_HOST="$(az postgres flexible-server show -g "$RESOURCE_GROUP" -n "$PG_SERVER" --query fullyQualifiedDomainName -o tsv)"

# ------------------------------------------------------- app service plan ---

step "App Service plan"
az appservice plan create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PLAN_NAME" \
  --location "$LOCATION" \
  --sku "$PLAN_SKU" \
  --is-linux \
  --tags "${TAGS[@]}" \
  -o none
info "$PLAN_NAME ($PLAN_SKU, Linux)"

# ----------------------------------------------------------------- web app --

step "Web app"
if az webapp show -g "$RESOURCE_GROUP" -n "$APP_NAME" -o none 2>/dev/null; then
  info "$APP_NAME already exists"
else
  az webapp create \
    --resource-group "$RESOURCE_GROUP" \
    --plan "$PLAN_NAME" \
    --name "$APP_NAME" \
    --runtime "$NODE_RUNTIME" \
    --tags "${TAGS[@]}" \
    -o none
  info "created $APP_NAME"
fi

# `node server.js` is the entry point Next.js writes into .next/standalone.
# Basic and above keep the app warm with Always On; without it App Service
# unloads the container after 20 idle minutes and the next visitor waits for a
# cold start.
az webapp config set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --linux-fx-version "$NODE_RUNTIME" \
  --startup-file "node server.js" \
  --always-on true \
  --http20-enabled true \
  --min-tls-version 1.2 \
  --ftps-state Disabled \
  -o none
info "Node runtime, startup command, Always On, TLS 1.2, FTPS off"

az webapp update \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --https-only true \
  -o none
info "HTTP redirected to HTTPS"

az webapp log config \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --docker-container-logging filesystem \
  -o none
info "container logging on (az webapp log tail)"

step "Managed identity"
PRINCIPAL_ID="$(az webapp identity assign \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --query principalId -o tsv)"
info "principal $PRINCIPAL_ID"

# Lets the app reach Blob Storage with its own identity instead of a shared
# account key, once the storage layer is ported off Supabase.
STORAGE_ID="$(az storage account show -g "$RESOURCE_GROUP" -n "$STORAGE_ACCOUNT" --query id -o tsv)"
az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ID" \
  -o none 2>/dev/null || true
info "granted Storage Blob Data Contributor on $STORAGE_ACCOUNT"

# ------------------------------------------------------- database firewall --

step "Database firewall"

# `--public-access None` is documented as "public access mode, but no firewall
# rule". In CLI 2.91 it actually leaves publicNetworkAccess Disabled, and with
# no delegated subnet that is a server nothing can reach. Assert the state we
# need rather than trusting the create flag.
PUBLIC_ACCESS="$(az postgres flexible-server show \
  -g "$RESOURCE_GROUP" -n "$PG_SERVER" \
  --query network.publicNetworkAccess -o tsv)"
if [ "$PUBLIC_ACCESS" != "Enabled" ]; then
  info "public endpoint is $PUBLIC_ACCESS — enabling it so rules can be added"
  az postgres flexible-server update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$PG_SERVER" \
    --public-access Enabled \
    -o none
fi

# One rule rather than one per address. App Service reports 31 possible
# outbound IPs here, each firewall rule is a separate ~70-second server
# operation, and the list is not stable — Azure can move the app to another
# scale unit, at which point per-IP rules silently stop matching and the app
# loses its database.
#
# 0.0.0.0 is Azure's sentinel for "any Azure resource", not "the internet".
# It is wider than this app alone: another Azure tenant can reach the port,
# though they still need the admin user and a 32-character random password
# over enforced TLS. The tight alternative is a private endpoint (about
# ₹700/month) plus VNet integration, which also stops a laptop reaching the
# database to run migrations. See azure/README.md.
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$PG_SERVER" \
  --name "allow-azure-services" \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  -o none
info "Azure services allowed (covers this app's outbound addresses)"

if [ -n "$MY_IP" ]; then
  az postgres flexible-server firewall-rule create \
    --resource-group "$RESOURCE_GROUP" \
    --server-name "$PG_SERVER" \
    --name "operator" \
    --start-ip-address "$MY_IP" \
    --end-ip-address "$MY_IP" \
    -o none
  info "your address $MY_IP allowed (needed to load the schema)"
fi

# -------------------------------------------------------------- app settings --

step "App settings"
SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://${APP_NAME}.azurewebsites.net}"

# HOSTNAME matters: the Next.js standalone server binds to process.env.HOSTNAME,
# and the App Service container sets that to the machine name, which the server
# cannot bind to. Without this the app starts and then refuses every request.
settings=(
  "HOSTNAME=0.0.0.0"
  "NODE_ENV=production"
  "WEBSITE_NODE_DEFAULT_VERSION=~22"
  "SCM_DO_BUILD_DURING_DEPLOYMENT=false"
  "NEXT_TELEMETRY_DISABLED=1"
  "NEXT_PUBLIC_SITE_URL=$SITE_URL"
  "AZURE_STORAGE_ACCOUNT=$STORAGE_ACCOUNT"
  "AZURE_STORAGE_KEY=$STORAGE_KEY"
)
if [ -n "$PG_ADMIN_PASSWORD" ]; then
  settings+=("DATABASE_URL=postgresql://${PG_ADMIN_USER}:${PG_ADMIN_PASSWORD}@${PG_HOST}:5432/${PG_DATABASE}?sslmode=require")
fi

az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --settings "${settings[@]}" \
  -o none
info "${#settings[@]} settings written"
info "app secrets (ADMIN_PASSWORD_HASH, SESSION_SECRET) are pushed by deploy-local.sh"

# ------------------------------------------------------------------ schema --

if [ "$SKIP_SCHEMA" -eq 1 ]; then
  step "Schema — skipped (--skip-schema)"
elif ! command -v psql >/dev/null 2>&1; then
  step "Schema — skipped"
  info "psql is not installed. Install it with:  brew install libpq"
  info "then re-run this script, or load it by hand (see azure/README.md)."
elif [ -z "$PG_ADMIN_PASSWORD" ]; then
  step "Schema — skipped"
  info "This run does not know the server's password, so it cannot connect."
  info "Load the schema by hand; see azure/README.md."
else
  step "Loading the schema"
  # supabase/setup.sql is the single source of truth for the schema, and is
  # portable PostgreSQL — the directory is named after where the project
  # started, not where it runs.
  PGPASSWORD="$PG_ADMIN_PASSWORD" psql \
    --host "$PG_HOST" \
    --port 5432 \
    --username "$PG_ADMIN_USER" \
    --dbname "$PG_DATABASE" \
    --set=sslmode=require \
    --set ON_ERROR_STOP=1 \
    --quiet \
    --file "$SCHEMA_SOURCE"

  table_count="$(PGPASSWORD="$PG_ADMIN_PASSWORD" psql -h "$PG_HOST" -U "$PG_ADMIN_USER" -d "$PG_DATABASE" \
    -tAc "select count(*) from information_schema.tables where table_schema = 'public'")"
  info "$table_count tables in the public schema"
fi

# ----------------------------------------------------------------- outputs --

step "Writing azure/.env.azure"
umask 077
{
  echo "# Written by azure/infra.sh on $(date '+%Y-%m-%d %H:%M'). Git-ignored."
  echo "# Read by azure/deploy-local.sh. Treat it as a secret."
  echo "AZURE_RESOURCE_GROUP=$RESOURCE_GROUP"
  echo "AZURE_APP_NAME=$APP_NAME"
  echo "AZURE_LOCATION=$LOCATION"
  echo "AZURE_STORAGE_ACCOUNT=$STORAGE_ACCOUNT"
  echo "AZURE_STORAGE_KEY=$STORAGE_KEY"
  echo "AZURE_PG_SERVER=$PG_SERVER"
  echo "AZURE_PG_HOST=$PG_HOST"
  echo "NEXT_PUBLIC_SITE_URL=$SITE_URL"
  if [ -n "$PG_ADMIN_PASSWORD" ]; then
    echo "DATABASE_URL=postgresql://${PG_ADMIN_USER}:${PG_ADMIN_PASSWORD}@${PG_HOST}:5432/${PG_DATABASE}?sslmode=require"
  fi
} > "$OUTPUT_ENV"
info "$OUTPUT_ENV"

cat <<DONE

$(bold "Done.")

  Site        $SITE_URL
  Database    $PG_HOST/$PG_DATABASE
  Storage     $STORAGE_ACCOUNT ($PHOTOS_CONTAINER, $JOURNEY_CONTAINER)
  Logs        az webapp log tail -g $RESOURCE_GROUP -n $APP_NAME

  Next:       ./azure/deploy-local.sh

DONE
if [ "$PG_CREATED" -eq 1 ]; then
  bold "  The database password was generated and written to azure/.env.azure."
  bold "  It is not stored anywhere else — keep that file."
  echo
fi
