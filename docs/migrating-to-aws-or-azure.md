# Migrating off Vercel and off Supabase

This app is a standard Next.js 16 (App Router) app with a Supabase backend
(Postgres + Storage), so it isn't locked into either. This doc covers two
independent migrations:

1. **Part 1** — moving the Next.js app's hosting off Vercel to AWS or Azure
   (Supabase stays as-is).
2. **Part 2** — moving the data layer off Supabase entirely, onto AWS
   (RDS + S3) or Azure (Flexible Server Postgres + Blob Storage).

You can do Part 1 without Part 2 (keep using Supabase from AWS/Azure-hosted
Next.js), or Part 2 without Part 1 (keep Vercel hosting, own your data).
Before migrating either, confirm the app is stable on Vercel + Supabase
(auth, CRUD, photo upload, share links, expiry) since that's the fastest
feedback loop during active development.

## Why this app is portable

Supabase-specific code is isolated to two places:
[src/lib/supabase/admin.ts](../src/lib/supabase/admin.ts) (the client) and the
repository layer in [src/lib/data/](../src/lib/data) (`profiles.ts`,
`photos.ts`, `share-links.ts`, `settings.ts`) — these are the only places that
call `supabase.from(...)` or `supabase.storage...`. Pages, Server Actions and
components only import functions like `listProfiles()` or
`uploadProfilePhoto()`, never the Supabase client directly. So swapping the
backend means rewriting the *internals* of those data-layer files only — no
changes needed elsewhere in the app.

## Part 1 — What stays the same when just moving hosting

- **Supabase** (Postgres + Storage) is already a separate, independently
  hosted service — no changes needed there regardless of where Next.js runs.
- **Environment variables** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OWNER_PASSWORD_HASH`, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`) are copied
  as-is into whichever platform replaces Vercel.
- **`src/proxy.ts`** (Next's middleware equivalent) runs fine under Node.js
  hosting; no rewrite required.

## Option A — AWS

Recommended path: **AWS Amplify Hosting** (SSR support for Next.js) for the
least friction, since it understands the Next.js build output directly like
Vercel does.

1. Push the repo to CodeCommit/GitHub and connect it in the Amplify console.
2. Amplify auto-detects Next.js and uses `next build` — no custom build
   config needed beyond adding the environment variables above in
   **App settings → Environment variables**.
3. Point your domain's DNS (or Route 53) at the Amplify app.

Alternative (more control, more setup): **ECS Fargate / App Runner**
running the app in a Docker container:

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

- Build and push the image to **ECR**.
- Run it on **App Runner** (simplest, autoscaling, HTTPS built in) or
  **ECS Fargate** behind an **Application Load Balancer** if you need a VPC.
- Store secrets in **AWS Secrets Manager** or **SSM Parameter Store** and
  inject them as container environment variables.
- Put **CloudFront** in front for caching of static assets (`/_next/static`,
  `/public`) if using ECS/App Runner directly.

## Option B — Azure

Recommended path: **Azure Static Web Apps (Standard/hybrid plan)** or
**Azure App Service (Linux, Node 22)** — both support Next.js SSR.

Using App Service:

1. Create an **App Service** (Linux, Node 22 runtime).
2. Deploy via GitHub Actions (Azure provides a ready-made workflow) or
   `az webapp deploy` with the built `.next` output.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_PASSWORD_HASH`,
   `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL` under
   **Configuration → Application settings**.
4. Enable **Always On** so the Node process (and cookie/session handling)
   doesn't cold-start between owner logins.

Container route (same Dockerfile as above) works identically via
**Azure Container Apps**, with secrets in **Azure Key Vault** referenced as
app setting values.

## Part 2 — Moving the data layer off Supabase

Supabase Postgres is vanilla Postgres and Supabase Storage is S3-compatible,
so both the database and the files migrate cleanly to either cloud.

### 2a. Database (Postgres → RDS or Azure Flexible Server)

1. Dump only the app schema (skip Supabase's internal `storage`, `auth`,
   `realtime` schemas — this app doesn't use Supabase Auth or Realtime):
   ```bash
   pg_dump "$SUPABASE_DB_URL" \
     --schema=public --format=custom --file=aura.dump
   ```
2. Create the target database:
   - **AWS**: Amazon RDS for PostgreSQL (or Aurora PostgreSQL) 15+.
   - **Azure**: Azure Database for PostgreSQL – Flexible Server.
3. Restore: `pg_restore --no-owner --no-privileges -d "$NEW_DB_URL" aura.dump`.
4. `pgcrypto` (used for `gen_random_uuid()`) is available on both RDS and
   Azure Flexible Server — re-run `create extension if not exists pgcrypto;`
   if `pg_restore` didn't already.
5. Since we never rely on Supabase Row Level Security policies (RLS is
   enabled with zero policies — see [schema.sql](../supabase/schema.sql)),
   there's nothing RLS-related to port. On the new database, just create an
   app-specific DB user/role with normal `GRANT` privileges on the `public`
   schema; the app's Node code remains the only thing enforcing owner vs.
   client access.
6. Swap `src/lib/supabase/admin.ts` for a plain Postgres client — e.g.
   [`postgres`](https://www.npmjs.com/package/postgres) or
   [`pg`](https://www.npmjs.com/package/pg) (or an ORM like Drizzle/Prisma if
   you want typed queries). Rewrite the query bodies inside
   `src/lib/data/*.ts` to use SQL/ORM calls instead of
   `supabase.from(...).select(...)` — the exported function names and
   signatures (`listProfiles`, `getProfileWithPhotos`, `createShareLink`,
   etc.) can stay identical so no caller changes are needed.

### 2b. File storage (Supabase Storage → S3 or Blob Storage)

Supabase Storage exposes an S3-compatible endpoint
(`https://<project-ref>.supabase.co/storage/v1/s3`), which makes bulk copying
straightforward:

- **AWS**: create an S3 bucket, then copy objects with
  [`rclone`](https://rclone.org/s3/) configured with Supabase's S3 endpoint as
  the source and the new S3 bucket as the destination — object keys map
  directly to the `storage_path` column in `profile_photos`, so no DB changes
  needed beyond pointing at the new bucket name.
- **Azure**: create a Blob Storage container, then copy with
  [`azcopy`](https://learn.microsoft.com/azure/storage/common/storage-use-azcopy-v10)
  (`azcopy copy` supports S3 as a source directly).
- Update `src/lib/data/photos.ts` (upload/delete) and
  `src/lib/data/profiles.ts` (`attachSignedPhotoUrls`) to use:
  - **AWS**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
    (`getSignedUrl`) in place of `createSignedUrl`/`createSignedUrls`.
  - **Azure**: `@azure/storage-blob`'s `generateBlobSASQueryParameters` for
    time-limited read URLs, mirroring the current 1-hour signed URL TTL in
    [src/lib/constants.ts](../src/lib/constants.ts).

### 2c. Env vars after leaving Supabase

Replace `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` with the new provider's
credentials, e.g.:

- AWS: `DATABASE_URL` (RDS connection string), `AWS_REGION`,
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or an IAM role if hosting on
  AWS), `S3_BUCKET_NAME`.
- Azure: `DATABASE_URL` (Flexible Server connection string),
  `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER_NAME`.

`OWNER_PASSWORD_HASH`, `SESSION_SECRET` and `NEXT_PUBLIC_SITE_URL` are
unaffected by this migration since they're app-level, not Supabase-related.

## Things to double check after moving off Vercel

- **Image optimization**: `next/image` remote patterns in
  [next.config.ts](../next.config.ts) already allow `*.supabase.co` — no
  change needed since photos are served from Supabase Storage, not the
  hosting platform.
- **Cookies/session**: the owner session cookie is a self-signed JWT (via
  `jose`), so it doesn't depend on any platform-specific session store.
- **Custom domain + HTTPS**: re-issue/verify TLS certs on the new platform
  before cutting over DNS.
- **Cold starts**: AWS App Runner/ECS and Azure App Service don't behave
  exactly like Vercel's edge network — if the owner dashboard feels slow on
  first request, enable "always on"/minimum instance count.
