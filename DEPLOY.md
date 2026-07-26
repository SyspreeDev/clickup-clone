# Deploying Flowspace

Architecture: **Vercel** hosts the Next.js web app (`apps/web`). The Express +
Socket.io API and PostgreSQL **cannot** run on Vercel — deploy those to
**Railway** (easiest, DB + API in one place) or Render.

---

## 1. Push to GitHub (run on your Mac)

Secrets are already git-ignored (`apps/api/.env`, `apps/web/.env.local`). From the repo root:

```
cd "/Users/apple/Downloads/ClickUp Clone "
git add -A
git commit -m "Flowspace: email, Zoom, Google OAuth + deploy config"
```

Create an empty repo on github.com (no README), then:

```
git remote add origin https://github.com/<you>/flowspace.git
git branch -M main
git push -u origin main
```

---

## 2. Deploy API + Postgres to Railway

1. Go to https://railway.app → New Project → **Deploy from GitHub repo** → pick this repo.
2. Add a **PostgreSQL** plugin (Railway provisions a DB and a `DATABASE_URL`).
3. In the API service settings:
   - **Root directory**: `apps/api`
   - **Build**: `pnpm install && pnpm --filter api db:deploy && pnpm --filter api build`
   - **Start**: `pnpm --filter api start`  (or `npx tsx src/index.ts`)
4. Set environment variables (from your local `apps/api/.env`, but production values):
   - `DATABASE_URL` = (reference the Railway Postgres variable)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` = new strong random strings
   - `NODE_ENV=production`
   - `CORS_ORIGIN` = your Vercel URL (e.g. `https://flowspace.vercel.app`)
   - `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`
   - (optional) `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_*`
   - Do **not** set `CORS_ALLOW_ALL` in production.
5. Deploy. Note the public API URL, e.g. `https://flowspace-api.up.railway.app`.
6. Seed data if needed: run `pnpm --filter api db:seed` as a one-off, or import your data.

---

## 3. Deploy web to Vercel

1. https://vercel.com → Add New → Project → import the GitHub repo.
2. **Root Directory**: `apps/web`  (Vercel detects Next.js + the pnpm/Turborepo monorepo).
3. Environment variables:
   - `NEXT_PUBLIC_API_URL` = your Railway API URL (e.g. `https://flowspace-api.up.railway.app`)
   - `NEXT_PUBLIC_SOCKET_URL` = same Railway API URL
4. Deploy. Vercel gives you `https://<project>.vercel.app` — your public link.

> Note: `apps/web/.env.local` (used for the local tunnel, blank same-origin URLs)
> is git-ignored and does NOT affect Vercel. Set the real URLs in the Vercel
> dashboard as above. With those set, the web app talks directly to the Railway
> API (CORS is handled by `CORS_ORIGIN` on the API).

---

## 4. Point the two at each other

- Vercel `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` → Railway API URL.
- Railway `CORS_ORIGIN` → Vercel URL.
- Redeploy both after setting these.

## 5. Zoom / Google callback URLs (if used)

- Google OAuth: add `https://<railway-api>/api/auth/google/callback` as an authorized redirect URI.
- Zoom S2S needs no redirect URI.
