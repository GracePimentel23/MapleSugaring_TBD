# Running TBD on Vercel (free)

Two Vercel projects built from this repo, both on the free Hobby plan, plus a free Neon Postgres:

| Project | Folder | What it is |
|---|---|---|
| `tbd-api` | `worker/` | The API (Express) as one Vercel function, with the Neon database attached |
| `tbd` | `web/` | The dashboard (Next.js). Its `/api/*` is rewritten straight to `tbd-api` |

```
LC01 ~LoRa~> gateway -USB-> bridge/bridge.py (any laptop) --HTTPS + X-Ingest-Key--> tbd-api /ingest -> Neon
browser -> tbd (Next.js) -> tbd-api -> Neon        browser polls /api/live every 5 s, re-renders on change
```

What is different from the VM: migrations run during the `tbd-api` build (there is no boot step), the
"node offline after 15 min" check runs when someone reads the stations instead of on a timer, and the
worker's database pool is small. Local `npm run dev` and the VM Docker setup are unchanged.

## One-time setup

You need a Vercel account (sign up with GitHub, Hobby plan) and Node 22+.

### 1. Log in from this repo

```powershell
npx vercel login
```

### 2. Create the API project and its database

```powershell
cd worker
npx vercel link            # "create a new project", name it tbd-api, keep the detected settings
```

Then in the Vercel dashboard, open **tbd-api > Storage > Create Database > Neon** (free plan), and connect
it to the project for all environments. That sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`.

Add the other settings under **tbd-api > Settings > Environment Variables** (Production):

| Name | Value |
|---|---|
| `INGEST_KEY` | a long random string; the bridge sends it. Make one: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` |
| `DEV_ROLE` | leave unset: without Google sign-in the public site is read-only (guest) |

Deploy it:

```powershell
npx vercel --prod          # still in worker/
```

The build log should say `applying migration 001_baseline.sql` ... `worker build check ok`.
Check `https://<tbd-api domain>/health` answers `{"ok":true,"db":"up"}`.

### 3. Create the web project

```powershell
cd ..\web
npx vercel link            # new project, name it tbd
npx vercel env add WORKER_URL production    # paste https://<tbd-api domain>, no trailing slash
npx vercel --prod
```

Open the `tbd` URL. The badge next to the title should say **Live**, with no stations yet.

### 4. Point the bridge at it

On the computer with the gateway plugged in (see [bridge/README.md](../bridge/README.md)):

```
TBD_URL=https://<tbd-api domain>
INGEST_KEY=<the INGEST_KEY from step 2>
```

`python bridge.py`. The first packet from LC01 creates its station card.

## Updating

```powershell
cd worker; npx vercel --prod     # API changes (also runs new migrations)
cd web;    npx vercel --prod     # dashboard changes
```

To deploy on every push instead, connect the projects to the GitHub repo (**Settings > Git**, root directory
`worker` and `web`). Because the repo lives on GracePimentel23's account, she has to install the Vercel
GitHub app for it first.

## Optional: Google sign-in on Vercel

Same settings as in `worker/.env.example`, added to **tbd-api**: `AUTH_PROVIDER=google`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `ADMIN_EMAILS`, and `PUBLIC_URL=https://<tbd domain>`. In Google
Cloud, add `https://<tbd domain>/api/auth/google/callback` as an authorized redirect URI. Redeploy tbd-api.

## Per-gateway keys

Instead of sharing `INGEST_KEY`, give each bridge its own key, which also fixes the name it shows up as.
In `worker/`, run `npx vercel env pull .env --environment=production` (copies the Neon `DATABASE_URL`
into the gitignored `worker/.env`), then:

```powershell
npm run gateway-key -- create GW-LAB     # prints the key once
npm run gateway-key -- list
npm run gateway-key -- revoke 3
```

Delete `worker/.env` afterwards if you don't want production credentials on that computer.

## Free plan limits to keep in mind

Hobby includes 1,000,000 function calls and 4 hours of active CPU a month; going over pauses the projects
until the month is up. Rough use: the bridge sends one request every 5 s while packets arrive and one a
minute otherwise; an open dashboard tab asks `/api/live` every 5 s (an edge rewrite, not a function in
`tbd`) and re-renders only when a reading or alert changed. A bridge running all month plus a few people
watching stays under the limit. For long unattended runs, set `FORWARD_INTERVAL=15` in `bridge.env`.
Watch **Usage** in the Vercel dashboard. Neon's free tier is 0.5 GB, roughly a few months of one node.
