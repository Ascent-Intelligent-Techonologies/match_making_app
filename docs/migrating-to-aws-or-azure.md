# Migrating from Vercel to AWS or Azure

This app is a standard Next.js 16 (App Router) app with a Supabase backend, so it
isn't locked into Vercel. The only Vercel-specific pieces are the build/deploy
pipeline and environment variable storage — the app code itself is portable.

Before migrating, confirm the app is stable on Vercel (auth, CRUD, photo
upload, share links, expiry) since that's the fastest feedback loop during
active development.

## What stays the same

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
