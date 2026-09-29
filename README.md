# MapleSugaring_TBD

Capstone project: the dashboard for the maple sugaring club, connected to the load cell sensors
over LoRa. This repo is a small monorepo:

| Folder | What it is | Port |
|---|---|---|
| `web/` | Next.js dashboard (Dashboard, Stations, Data) | 3000 local, 3100 on the VM |
| `worker/` | API + sensor ingest (Express, Postgres) | 4000 |
| `scripts/` | Local dev helpers (a real Postgres 17 from npm, run-everything script) | Postgres on 5433 |

```
[load cell] -> HX711 -> LoRa32 node ~~LoRa~~> LoRa32 gateway -USB-> server.py --forward
     -> POST /ingest -> worker -> Postgres <- worker <- /api/* <- web (Next.js) <- browser
```

Deploying to the VM: see [docs/DEPLOY.md](docs/DEPLOY.md).

The gateway side (firmware, `server.py`) lives in [JassV9/maplebackend](https://github.com/JassV9/maplebackend).

## Run everything on your PC

Needs Node 22+. No Docker or Postgres install: `embedded-postgres` downloads Postgres 17 into `node_modules`.

```powershell
npm run setup   # once: installs root, web and worker packages
npm run dev     # Postgres :5433 (seeded with demo data the first time) + worker :4000 + web :3000
```

Open http://localhost:3000. The badge next to each page title says **Live** when the page is reading the
API, or **Sample data** when `WORKER_URL` is not set / the worker is down (the UI never breaks without
the backend). If port 3000 is taken: `$env:WEB_PORT=3005; npm run dev`.

Feed it readings without the boards:

```powershell
npm run simulate                  # the PRG-button test loop: ramps LC01 to 9.25 kg, then empties it
npm run simulate -- --live        # slow live readings that creep up
```

With the real gateway plugged in, run the gateway dashboard with forwarding
(`python server.py --forward http://localhost:4000` from maplebackend's `frontend/`). A new node id
(e.g. `LC01`) creates its own station card on first packet.

Other commands: `npm run db` (just Postgres), `npm run seed` (demo data into an empty database;
`npm --prefix worker run seed -- --force` wipes and reseeds), `npm test` (worker tests; set
`DATABASE_URL=postgres://tbd:tbd@127.0.0.1:5433/tbd` to include the API tests against Postgres).

## API (worker)

Browser calls go to `/api/<path>` on the web app, which forwards to the worker.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | 200 when Postgres answers, 503 otherwise |
| POST | `/ingest` | Gateway lines `{gateway, lines: [...]}` (header `X-Ingest-Key` when `INGEST_KEY` is set) |
| GET | `/stations`, `/stations/:bucketId` | Station cards (`StationView`), open alerts |
| POST/PATCH | `/stations`, `/stations/:bucketId` | Add or edit a station (name, location, target lbs, sensor id) |
| GET | `/dashboard` | Production totals and the 7-day collection chart |
| GET/POST/DELETE | `/collections` | Collections; a bucket without lbs is logged at its current load cell weight |
| GET/POST/PATCH | `/batches` | Boil batches |
| GET | `/seasons` | Season summaries for Overview / Analysis |
| GET/PATCH | `/alerts` | Open alerts; resolve one |
| GET | `/readings`, `/packets`, `/nodes`, `/gateways` | Raw sensor data and radio health (RSSI, SNR, lost packets) |

Ingest rules (same thresholds as maplebackend's parser): bucket full at 90 % (critical alert), sudden drop
of at least 1 kg and half the weight (logged as an automatic collection), weight outside -1 to 55 kg,
missing HX711, and a station goes offline after 15 minutes of silence.

## Database

`worker/migrations/*.sql` run automatically when the worker starts, once each, in order
(tracked in `schema_migrations`). `001_baseline.sql` is the shared class DDL; `002_tbd_core.sql` adds
readings, raw packets, collections, batches and alert de-duplication. Never edit a migration that has
run on the VM; add `003_...sql` instead. Weights are stored in kg and converted to lbs for the UI.

## Deploying on the VM

The repo is cloned at `/srv/TBD` on maplesugaring01 (the folders the Docker maintainer's
`/srv/msdocker/docker-compose.yml` builds from: `/srv/TBD/web`, `/srv/TBD/worker`, and
`/srv/TBD/postgres` for tbd-db data, gitignored). Each service is built with
`npm ci && npm run build && npm start` and health-checked on `GET /health`.

**Pull to deploy.** After a one-time `deploy/install-hook.sh`, every `git pull` in `/srv/TBD` runs
`deploy/update.sh`, which rebuilds only what changed (web, worker or both), restarts it, and waits
for its health check. It asks for the sudo password because docker needs it.

```bash
cd /srv/TBD
git pull                     # pulls and redeploys
SKIP_DEPLOY=1 git pull       # pull without redeploying
deploy/update.sh all         # rebuild everything by hand
```

Until the shared stack is running, `deploy/update.sh` uses `deploy/preview.compose.yml`: a TBD-only
stack (containers `TBD_PREVIEW_*`, its own database volume) with the site on
http://localhost:3100 on the VM. To switch to the shared stack later, create `deploy/.env` with
`COMPOSE_FILE=/srv/msdocker/docker-compose.yml`, `WEB_SERVICE=tbd-web`, `WORKER_SERVICE=tbd-worker`.

Worker environment: `DATABASE_URL` (set by compose), optional `INGEST_KEY`, `OFFLINE_AFTER_MINUTES`,
`FULL_PERCENT`, `METRIC_INTERVAL_MINUTES`. Web environment: `WORKER_URL` (set by compose).
