# MapleSugaring_TBD

Capstone project: the dashboard for the maple sugaring club, connected to the load cell sensors
over LoRa. This repo is a small monorepo:

| Folder | What it is | Port |
|---|---|---|
| `web/` | Next.js dashboard (Dashboard, Stations, Alerts, Data, Settings, Login) | 3000 |
| `worker/` | API + sensor ingest (Express, Postgres) | 4000 |
| `bridge/` | Gateway bridge: reads the gateway board over USB and sends readings to the API (Python) | |
| `scripts/` | Local dev helpers (a real Postgres 17 from npm, run-everything script) | Postgres on 5433 |

```
[load cell] -> HX711 -> LoRa32 node ~~LoRa~~> LoRa32 gateway -USB-> bridge/bridge.py
     -> POST /ingest -> worker -> Postgres <- worker <- /api/* <- web (Next.js) <- browser
```

Deploying on Vercel (free): see [docs/VERCEL.md](docs/VERCEL.md). On the VM: [docs/DEPLOY.md](docs/DEPLOY.md).

The gateway side (firmware, `server.py`) lives in [JassV9/maplebackend](https://github.com/JassV9/maplebackend).

## Run everything on your PC

Needs Node 22+. No Docker or Postgres install: `embedded-postgres` downloads Postgres 17 into `node_modules`.

```powershell
npm run setup   # once: installs root, web and worker packages
npm run dev     # Postgres :5433 (seeded with demo data the first time) + worker :4000 + web :3000
```

Open http://localhost:3000. Every page reads the API; if `WORKER_URL` is not set or the worker is down,
a banner says so and the pages show no station data. The weather cards and forecasts come from Open-Meteo
(free, no key). If port 3000 is taken: `$env:WEB_PORT=3005; npm run dev`.

Feed it readings without the boards:

```powershell
npm run simulate                  # the PRG-button test loop: ramps LC01 to 9.25 kg, then empties it
npm run simulate -- --live        # slow live readings that creep up
```

With the real gateway plugged in, run the bridge (`cd bridge`, `copy bridge.example.env bridge.env`,
`python bridge.py`; see [bridge/README.md](bridge/README.md)). A new node id (e.g. `LC01`) creates its
own station card on first packet, and open pages update within a few seconds of each reading.

Other commands: `npm run db` (just Postgres), `npm run seed` (demo data into an empty database;
`npm --prefix worker run seed -- --force` wipes and reseeds), `npm test` (worker tests; set
`DATABASE_URL=postgres://tbd:tbd@127.0.0.1:5433/tbd` to include the API tests against Postgres).

## Front end layout (`web/`)

The design from the `design-changes` branch, wired to the API. Imports use `@/` from `web/`.

```
web/
  app/                      routes only: page.tsx (Dashboard), login/, stations/, alerts/, data/[section]/, settings/, account/, demo/
  components/
    live/LiveProvider.tsx   the API data for every page (loaded in app/layout.tsx), polling /api/live, saving changes
    session/                SessionProvider (who is looking, from /api/auth/me), ClubSettingsProvider (units, thresholds, seasons)
    stations/               StationsPage, StationSheet (the pop-up), StationForms, LogCollectionModal, StationsMap, StationStateProvider
    dashboard/              SummaryCards, StationTile, NextSteps, CardArt
    alerts/                 NotificationsMenu (the bell), AlertIcon
    data/                   Overview, Collections, Batches, Analysis, BatchStateProvider
    settings/               Thresholds, Users & Roles, Trees & Sensors, Notifications, Units & Season, Display, Audit Log
    layout/AppShell.tsx     sidebar, top bar, mobile nav
    auth/                   AccessContext (ShowFor, useShows), AccountMenu
    ui/                     shared building blocks (ui.tsx), pickers (PersonPicker, DateTimePicker), chart styles
    icons.tsx               every SVG icon
  lib/
    live/                   loading (load.ts, weather.ts) and shaping the API's answers into the day the screens read (day.ts)
    selectors/              alerts judged from thresholds, station status, season and analysis figures
    types/schema.ts         the shapes the screens use
```

Settings with no API home yet (thresholds, units, season dates, notification choices)
are saved in the browser (localStorage), so they are per device for now.

Who sees which card is in `worker/src/rbac.config.js`: see [docs/FRONTEND_ROLES.md](docs/FRONTEND_ROLES.md).

### Front-end changes without merge pain

- Branch from `main` and work in `web/`. A file that was `components/X.tsx` on the old flat
  `design-changes` branch is `web/components/X.tsx` here, same name and same folders.
- `npm run dev` gives you the real API with demo data, so pages show live-shaped data instead of mocks.
  Read data with `useLive()` and save with its `send()`; who is looking comes from `useSession()`.
- Visual changes (Tailwind classes, `web/app/globals.css` tokens such as `text-body`) merge cleanly. Keep
  data loading in `components/live/` and `lib/live/` so a restyle and a data change don't collide.
- A page that needs data the API doesn't have yet: ask for the endpoint, or keep the data in the browser
  for now (as Settings does) rather than adding mock files.

## Sign-in (Google, RIT accounts)

Off by default: with `AUTH_PROVIDER` unset the API is open, as before, and no keys are needed.
To turn it on locally, copy `worker/.env.example` to `worker/.env`, fill in the Google client ID and
secret, a `SESSION_SECRET` and `ADMIN_EMAILS`, then `npm run dev`. Sign-in is optional: signed-out
visitors get the read-only guest view, and the profile icon at the top right starts Google sign-in.
The worker runs the OAuth code flow (PKCE, state, nonce), checks the ID token server-side and sets
an httpOnly session cookie (sessions live in the `sessions` table).

Who gets in: verified Google accounts whose email domain **and** Workspace `hd` claim are in
`ALLOWED_EMAIL_DOMAINS` (default `g.rit.edu`, RIT's Google Workspace), plus anyone in
`ALLOWED_EMAILS` or `ADMIN_EMAILS`. New users are `member`; `ADMIN_EMAILS` are made `owner` on every
sign-in and can change roles with `PATCH /users/:id`. `/health` and `/ingest` never need a session.

**Roles:** member, manager, owner; signed out is the guest view (no role). What each may see and do, and which cards
show for whom, is in one file, `worker/src/rbac.config.js`; every API route checks it. See
[docs/RBAC.md](docs/RBAC.md).

Google Cloud setup: create an OAuth client of type "Web application" and add
`<PUBLIC_URL>/api/auth/google/callback` as an authorized redirect URI for each place the app runs
(e.g. `http://localhost:3000/api/auth/google/callback`).

## API (worker)

Browser calls go to `/api/<path>` on the web app, which forwards to the worker.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | 200 when Postgres answers, 503 otherwise |
| POST | `/ingest` | Gateway lines `{gateway, lines: [...]}`, header `X-Ingest-Key` (see "Ingest keys" below) |
| GET | `/live` | `{version}`: changes whenever a reading, alert, collection or node status changes; pages poll it |
| GET/POST | `/demo`, `/demo/tare`, `/demo/mode`, `/demo/reset`, `/demo/clear-alerts`, `/demo/test-email`, `/demo/calibration/*` | The temporary Demo tab (open to guests via `demo:use`) |
| GET/POST/DELETE | `/gateway-keys`, `/gateway-keys/:id` | Per-gateway bridge keys: list, make (`{gateway}`, key shown once), revoke (owner) |
| GET | `/auth/me` | `{authEnabled, user, role, permissions, components, roles}`: who is looking, which cards they see, and every role's permissions |
| GET | `/auth/google`, `/auth/google/callback` | Google sign-in redirect and callback |
| POST | `/auth/logout` | End the session |
| GET/PATCH | `/users`, `/users/:id` | List users; set `{role}` (owner; the last owner cannot be demoted) |
| PATCH | `/me` | Your own `{name, pronouns}` (needs sign-in) |
| GET | `/roles`, `/audit?entity=user&id=` | Roles and their permissions; the audit log: role changes, station edits, maintenance, collections, batches (owner) |
| GET | `/stations`, `/stations/:bucketId` | Station cards (`StationView`), open alerts |
| POST/PATCH | `/stations`, `/stations/:bucketId` | Add or edit a station (name, location, target lbs, sensor id, map `lat`/`lon`, `retired`) |
| POST | `/stations/:bucketId/mode` | `{mode, minutes?, extendMinutes?}`: maintenance (managers) or collection mode; both end by themselves |
| GET/POST | `/notes` | Notes on stations and batches (`{subject: "bucket" or "batch", subjectId, text}`) |
| GET | `/dashboard` | Production totals and the 7-day collection chart |
| GET/POST/PATCH/DELETE | `/collections` | Collections; a bucket without lbs is logged at its current load cell weight; edit date, batch, buckets and weights |
| GET/POST/PATCH | `/batches` | Boil batches; a closed batch can only be changed with `batches:editClosed` (owner) |
| GET | `/seasons` | Season summaries for Overview / Analysis |
| GET/PATCH | `/alerts` | Open alerts (`?all` adds the last week's resolved ones); `{acknowledged}` takes one, `{is_resolved}` fixes it |
| GET | `/readings`, `/packets`, `/nodes`, `/gateways` | Raw sensor data and radio health (RSSI, SNR, lost packets) |

Ingest keys: `/ingest` accepts the shared `INGEST_KEY` or a per-gateway key (`npm --prefix worker run
gateway-key -- create GW-LAB`; stored hashed in `gateway_keys`, and it fixes the gateway's name). With
neither set up, ingest is open for local dev, unless `REQUIRE_INGEST_KEY=true`, which is always the case on Vercel.

Station modes: **normal** (a sudden drop of at least 1 kg and half the weight is a critical "bucket tipped"
alert, emailed when `RESEND_API_KEY` and `ALERT_EMAIL_TO` are set), **collection** (the drop is logged as an
automatic collection, no alert) and **maintenance** (weight changes count for nothing, no alerts). Collection
and maintenance switch back to normal after `MODE_MINUTES` (30). Weights shown are the node's reading minus
the station's tare, times its calibration factor (set from known weights on the Demo tab).

Ingest rules (same thresholds as maplebackend's parser): bucket full at 90 % (critical alert), weight outside -1 to 55 kg,
missing HX711, and a station goes offline after 15 minutes of silence.

## Database

`worker/migrations/*.sql` run automatically when the worker starts, once each, in order
(tracked in `schema_migrations`). `001_baseline.sql` is the shared class DDL; `002_tbd_core.sql` adds
readings, raw packets, collections, batches and alert de-duplication. Never edit a migration that has
run on the VM; add a new numbered file instead. `003_google_login.sql` adds roles, Google ids on
`users` and the `sessions` table. Weights are stored in kg and converted to lbs for the UI.

## Deploying on the VM

The site runs on its own VM, maplesugaring02.webdev.gccis.rit.edu, at http://maplesugaring02.webdev.gccis.rit.edu:3000
(port 3000 is the one ITS opened). `deploy/vm.compose.yml` runs three containers: `TBD_DB` (Postgres 17,
data in the `tbd_pg` volume), `TBD_WKR` (the worker, internal only) and `TBD_WEB` (the site on :3000, which
forwards `/api/*` to the worker). Each Node service is built with `npm ci && npm run build && npm start`
and health-checked on `GET /health`. Settings and secrets live in `deploy/.env` on the VM (gitignored;
start from `deploy/.env.example`). Step by step: [docs/DEPLOY.md](docs/DEPLOY.md).

**Pull to deploy.** After a one-time `deploy/install-hook.sh`, every `git pull` in the repo on the VM runs
`deploy/update.sh`, which rebuilds only what changed (web, worker or both), restarts it, and waits
for its health check. It asks for the sudo password because docker needs it.

```bash
git pull                     # pulls and redeploys
SKIP_DEPLOY=1 git pull       # pull without redeploying
deploy/update.sh all         # rebuild everything by hand
```

`deploy/preview.compose.yml` is the older localhost-only stack from the shared maplesugaring01 VM.

Worker environment: `DATABASE_URL` (set by compose), optional `INGEST_KEY`, `REQUIRE_INGEST_KEY`, `OFFLINE_AFTER_MINUTES`,
`FULL_PERCENT`, `METRIC_INTERVAL_MINUTES`, and the sign-in settings in `worker/.env.example`. Web environment: `WORKER_URL` (set by compose).
