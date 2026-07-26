# Flowspace — Email, Zoom & Google OAuth setup

All three integrations are now implemented. Each needs credentials you generate
from the provider, pasted into `apps/api/.env`. The API does **not** hot-reload —
**restart it after editing `.env`** (`Ctrl-C`, then `npx tsx src/index.ts`).

---

## 0. Apply the database migration (one time, required for Zoom)

The Zoom feature adds three columns to the `Meeting` table. From the repo root:

```
cd "apps/api"
npx prisma migrate dev
```

This applies the `add_zoom_meeting_fields` migration and regenerates the Prisma
client. (Postgres must be running: `brew services start postgresql@16`.)

---

## 1. Email (Resend) — makes invites / verification / reset emails actually send

You don't have a Resend account yet, so:

1. Sign up at **https://resend.com** (free tier ~3,000 emails/month).
2. **Verify a sending domain**: Dashboard → *Domains* → *Add Domain* →
   enter `syspreedigital.com` → add the DNS records it shows to your domain host.
   (For a quick test you can instead use Resend's `onboarding@resend.dev` sender,
   which only sends to your own signup email.)
3. Create an API key: *API Keys* → *Create API Key* → copy it (starts with `re_`).
4. In `apps/api/.env` set:

   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
   EMAIL_FROM=Flowspace <noreply@syspreedigital.com>
   ```

   `EMAIL_FROM` must be on your verified domain (or `onboarding@resend.dev` for the test path).
5. Restart the API. Invites, email verification, and password resets now send real,
   Flowspace-branded (orange) emails. If the key/domain is missing it safely falls
   back to logging the link in the terminal.

---

## 2. Zoom — auto-creates a real meeting + join link

You have a Zoom Pro account, so:

1. Go to **https://marketplace.zoom.us** → sign in → *Develop* → *Build App*.
2. Choose **Server-to-Server OAuth** → name it (e.g. "Flowspace").
3. On the app's **App Credentials** page, copy:
   - **Account ID** → `ZOOM_ACCOUNT_ID`
   - **Client ID** → `ZOOM_CLIENT_ID`
   - **Client Secret** → `ZOOM_CLIENT_SECRET`
4. Under **Scopes**, add: `meeting:write:meeting:admin` (and `meeting:read:meeting:admin`).
5. Fill the basic *Information* fields, then **Activate** the app.
6. In `apps/api/.env`:

   ```
   ZOOM_ACCOUNT_ID=xxxxxxxx
   ZOOM_CLIENT_ID=xxxxxxxx
   ZOOM_CLIENT_SECRET=xxxxxxxx
   ```
7. Restart the API. In *Schedule a meeting*, tick **"Generate a Zoom link
   automatically"** — Flowspace creates a real Zoom meeting and attaches the join
   link (shown as "Join Zoom meeting"). Leaving it unticked keeps the manual
   paste-your-own-link behavior. If Zoom env vars are absent, the toggle silently
   no-ops and the manual field is used.

---

## 3. Google OAuth — "Continue with Google" login

The code is already fully wired (login button, callback, backend). It only needs
credentials, which you have:

1. In **https://console.cloud.google.com** → *APIs & Services* → *Credentials*.
2. *Create Credentials* → *OAuth client ID* → **Web application**.
3. Add **Authorized redirect URI**:
   `http://localhost:4000/api/auth/google/callback`
   (add your production URL too when you deploy).
4. Configure the OAuth consent screen if prompted (External, add your email as a
   test user).
5. Copy the Client ID / Secret into `apps/api/.env`:

   ```
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxx
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
   ```
6. Restart the API. The "Continue with Google" button on the login/register pages
   now works. (When these vars are empty, that endpoint returns 501 by design.)

---

## What changed in the code

- `apps/api/src/lib/email/index.ts` — added `ResendEmailProvider` (REST via fetch) + branded HTML template.
- `apps/api/src/lib/zoom/index.ts` — new Server-to-Server OAuth client (token caching + create-meeting).
- `apps/api/src/config/env.ts` — added Resend + Zoom env, `isZoomConfigured` flag.
- `apps/api/prisma/schema.prisma` + migration — `zoomMeetingId`, `zoomJoinUrl`, `zoomStartUrl` on `Meeting`.
- `apps/api/src/modules/meetings/meeting.service.ts` — creates the Zoom meeting when requested.
- `packages/shared-types/.../meeting.schema.ts` — added optional `generateZoomLink`.
- `apps/web/components/meetings/create-meeting-dialog.tsx` — the auto-Zoom toggle.
- `apps/web/.../meetings/page.tsx` + `lib/queries/meetings.ts` — show "Join Zoom meeting".

No new npm dependencies were added — both integrations use built-in `fetch`.
