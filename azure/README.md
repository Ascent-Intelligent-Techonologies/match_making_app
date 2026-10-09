# Running AnuRupa Matrimony on Azure

Three files do the work:

| File | What it is |
| --- | --- |
| `azure/infra.sh` | Creates the Azure resources. Idempotent — run it as often as you like. |
| `azure-pipelines.yml` | Azure DevOps pipeline. Every push to `main` builds and deploys. |
| `azure/deploy-local.sh` | The same deploy, from your laptop, reading your local `.env`. |
| `azure/migrate-from-supabase.mjs` | One-off: copies the existing rows and files across. |

The target is the Azure column of `docs/cloud-cost-comparison.pdf`: **about ₹3,470 a
month** in Central India — of which the database, at ₹2,119, is **free for the
first 12 months** on a new Azure account, because B1ms with 32 GB is exactly
the free-tier SKU. Expect roughly **₹1,350 a month** for the first year.

---

## 1. What you need before you start

### Accounts and access

| | Why |
| --- | --- |
| An Azure subscription with a payment method | The resources below are billable from the moment they exist. |
| **Owner** or **Contributor + User Access Administrator** on it | Contributor alone can create everything except the role assignment that lets the web app read Blob Storage. |
| An Azure DevOps organisation and project | Only for the pipeline. `deploy-local.sh` works without it. |
| A domain name, if you want one | Optional. Without it the site lives at `https://<app>.azurewebsites.net`. |

### Tools on your machine

```bash
brew install azure-cli libpq
brew link --force libpq        # puts psql on your PATH
az login
```

Node 22 and `zip` you already have. `psql` is only needed the first time, to load
the schema; `infra.sh` skips that step with a clear message if it is missing.

### Values you must decide

Everything has a sane default. Override by exporting before running:

| Variable | Default | Note |
| --- | --- | --- |
| `LOCATION` | `centralindia` | Lowest latency for Hyderabad, and the region the cost sheet prices. |
| `RESOURCE_GROUP` | `anurupa-rg` | |
| `APP_BASENAME` | `anurupa` | App Service and storage names are global, so a 6-character hash of your subscription is appended. |
| `PLAN_SKU` | `B1` | Don't go below this: Free and Shared tiers have no Always On, so the first visitor after 20 idle minutes waits for a cold start. |

---

## 2. Create the infrastructure

```bash
./azure/infra.sh
```

It prints a plan, asks once, then creates:

- **Resource group** in Central India
- **App Service plan** — Basic B1, Linux, 1 core / 1.75 GB
- **Web App** — Node 22 LTS, Always On, HTTPS-only, TLS 1.2 floor, FTPS off,
  a system-assigned managed identity, and container logging on
- **PostgreSQL Flexible Server** — Burstable B1ms, 32 GB, v17, 7-day backups,
  no high availability, `pgcrypto` allow-listed
- **Storage account** — Standard LRS, hot, with two **private** containers
  (`profile-photos`, `journey-media`) and public blob access blocked
- **Firewall rules** letting only the web app's own outbound addresses and
  your current IP reach the database
- **The schema**, loaded from `supabase/setup.sql`

It writes `azure/.env.azure` (git-ignored) with the resource names and the
generated database password. **That file is the only copy of that password** —
keep it, or reset it later with `az postgres flexible-server update
--admin-password`.

Takes 6–10 minutes, nearly all of it waiting for Postgres.

### A note on the database firewall

The cost sheet says "public access off". In practice that needs the database
inside a virtual network, and a VNet-only database cannot be reached from your
laptop to load a schema or run a migration without also paying for a jumpbox or
Bastion. So the server keeps a public endpoint with **no open rules at all** and
an explicit allow-list: the web app's outbound addresses and your IP, nothing
else. TLS is required by default. The usual shortcut — the "allow all Azure
services" rule — is deliberately not used, because it admits every tenant in
the region, not just you.

If you would rather have the VNet, say so and I'll switch it; the app tier
supports VNet integration at no extra charge, it just needs a jumpbox or a
pipeline-run migration step to replace the direct `psql`.

---

## 3. Deploy

### From your laptop

```bash
./azure/deploy-local.sh
```

Reads `.env.local` and `azure/.env.azure`, builds the standalone bundle, pushes
the secrets to App Service, zip-deploys, and polls the site until it answers.
Roughly three minutes.

```bash
./azure/deploy-local.sh --settings-only   # just re-push env vars
./azure/deploy-local.sh --no-build        # redeploy the last build
./azure/deploy-local.sh --skip-settings   # code only
```

### From a push to main

In Azure DevOps, once:

1. **Project settings → Service connections → New → Azure Resource Manager →
   Workload identity federation (automatic)**. Name it `anurupa-azure`, scope it
   to the resource group. Federation is preferred over a service principal
   secret: there is no credential to rotate or leak.
2. **Pipelines → Library → + Variable group**, named `anurupa-azure`:
   - `azureResourceGroup` — e.g. `anurupa-rg`
   - `azureAppName` — e.g. `anurupa-a1b2c3`
   - `siteUrl` — e.g. `https://anurupa-a1b2c3.azurewebsites.net`

   (All three are in `azure/.env.azure`.) Then **Pipeline permissions → allow**
   this pipeline to use the group.
3. **Pipelines → New pipeline → GitHub → this repo → Existing YAML file →
   `/azure-pipelines.yml`**.

Pull requests type-check, lint and build but do not deploy. Pushes to `main`
deploy, then smoke-test the URL and fail the run if the site does not come back.

Application secrets are **not** in the pipeline or the variable group. They live
in App Service configuration, written by `infra.sh` and `deploy-local.sh`, so
read access to this repository or to Azure DevOps does not hand over the
production database.

---

## 4. Move the data off Supabase

The application no longer talks to Supabase at all: `src/lib/data/*` runs SQL
against this database through `pg`, and photos and videos live in the two Blob
containers. What is left is moving the existing rows and files across.

```bash
node azure/migrate-from-supabase.mjs --dry-run   # count everything, write nothing
node azure/migrate-from-supabase.mjs             # do it
```

It reads Supabase through its REST API with the service-role key still in
`.env.local`, so you do not need the database password from the Supabase
dashboard. Tables are copied parents-first, rows are inserted with
`on conflict do nothing`, and a blob already in Azure at the same size is
skipped — so if it stops halfway, run it again.

The file paths it copies come from `profile_photos.storage_path` and
`journey_media.storage_path` rather than from a bucket listing, so what moves
is exactly what the application can still reach. An orphaned file in Supabase
that no row points at is left behind deliberately.

Once the app is running on Azure and you are satisfied, delete
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. Nothing
reads them except this migration script.

## 5. After the first deploy

### A custom domain

```bash
az webapp config hostname add -g anurupa-rg --webapp-name <app> --hostname anurupa.in
az webapp config ssl create   -g anurupa-rg --name <app> --hostname anurupa.in
az webapp config ssl bind     -g anurupa-rg --name <app> \
  --certificate-thumbprint <thumbprint> --ssl-type SNI
```

The managed certificate is free and renews itself. Afterwards set
`NEXT_PUBLIC_SITE_URL` to the new domain in `.env.local` and re-run
`./azure/deploy-local.sh` — share links are built from it at build time, so a
settings change alone is not enough.

### Day-to-day

```bash
az webapp log tail        -g anurupa-rg -n <app>      # live logs
az webapp restart         -g anurupa-rg -n <app>
az webapp config appsettings list -g anurupa-rg -n <app> -o table
az postgres flexible-server show -g anurupa-rg -n <pg> --query state
```

### Turning it off

```bash
az group delete --name anurupa-rg --yes
```

Deletes everything in one go, including the database and its backups. There is
no undo.
