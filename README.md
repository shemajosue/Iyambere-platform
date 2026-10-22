# Iyambere

**A Smart Water Infrastructure Management Platform for Rwanda's National Water Supply Network**

Iyambere (Kinyarwanda: *progress*) helps WASAC cut Non-Revenue Water by turning leak
reporting from a passive phone-call channel into a georeferenced, verifiable digital workflow.

Built by **Team Iyambere** — University of Rwanda, College of Science and Technology.
Aligned with **SDG 6: Clean Water and Sanitation**. Pilot zone: **Kimisagara, Nyarugenge**
(supplied from the Kimisagara water treatment plant).

**Three portals, one platform:**

- **Citizen portal** — report a leak in under a minute: GPS or a pin dropped on the map, a
  photo, how bad it is. Then follow the ticket until the repair is verified.
- **Technician portal** — your jobs on a map; accept, confirm arrival, close out with notes,
  a photo and a pressure-gauge reading. Every step is timestamped.
- **WASAC operations portal** — the leak map, dispatch and re-dispatch by workload,
  verification, the pipe registry, EPANET pressure alerts, technician performance and
  account administration.

Every report is matched to the nearest live pipe on arrival, so it reaches WASAC already
carrying that pipe's material, age, condition and EPANET-modelled pressure — and a warning
if a dead main runs close by.

---

## What it does

| Module | Who uses it | What it delivers |
|---|---|---|
| **1. Citizen reporting** | Public | GPS-tagged, photo-verified leak reports + live ticket tracking |
| **2. Operations dashboard** | WASAC operators | Leak map, dispatch and re-dispatch, response-time monitoring |
| **3. Pressure & EPANET** | WASAC engineers | Each report linked to its pipe's EPANET pressure; gauge readings vs. model, automatic anomaly flags |
| **4. Technician accountability** | Field technicians | Accept → arrive → repair → close-out, every step timestamped |
| **5. Pipeline asset registry** | Engineers | Material, age, condition, and active/inactive/decommissioned status |
| **6. Analytics** | Management | Response times, NRW indicators, district leaderboards |

## Architecture

```
iyambere/
├── app/      Expo (React Native + react-native-web) → Android · iOS · Web, one codebase
├── api/      Node.js + Express REST API, talking to PostgreSQL through `pg`
├── db/       schema.sql + numbered migrations — the authoritative database definition
├── docs/     API reference and the presentation guide
├── prisma/   optional read-only mirror, for browsing the data in Prisma Studio
├── Dockerfile    the whole platform as one container
└── render.yaml   one-click cloud deployment
```

The API is organised by resource, one file each in `api/src/routes/`:
`auth`, `reports` (the workflow), `map` (GeoJSON), `pipes`, `pressure`, `stats`, `users`.
Shared pieces live beside them: `db.js` (connection pool), `auth.js` (tokens and roles),
`network.js` (matching a GPS point to a pipe), `errors.js` (clean error responses).
See [docs/API.md](docs/API.md) for every endpoint.

One React Native codebase serves all three platforms. The citizen and technician
experiences are phone-first; the WASAC operations dashboard renders on the web build.

## Run it in the cloud (always on)

The fastest way to get a public link for a presentation — it keeps running when
your laptop is closed. **Step-by-step guide: [docs/DEPLOY.md](docs/DEPLOY.md).**

1. Push this repository to GitHub (it must include `Dockerfile` and `render.yaml`).
2. Sign in to [render.com](https://render.com) with GitHub → **New → Blueprint** →
   choose the repository → **Apply**.
3. Render creates the PostgreSQL database and the service, wires them together and
   builds the app (about 5–10 minutes). The first boot loads the Kimisagara demo.
4. Open the `https://iyambere-….onrender.com` address it gives you. All three portals
   are there; the demo buttons on the sign-in page open each one with one tap.

Notes for the free plan: the service sleeps after 15 minutes without visitors and
takes about a minute to wake, so **open the link a few minutes before you present**.
Uploaded photos are kept on the container's disk and are lost on redeploy — fine
for a demo; use object storage (S3, Cloudinary) before a real pilot.

Any host that runs a Docker image works the same way (Railway, Fly.io, Google Cloud
Run, a VPS): set `DATABASE_URL`, `JWT_SECRET` and, for a demo, `SEED_DEMO=true`.

## Quick start (on your own machine)

Prerequisites: **Node.js 18+**, and a PostgreSQL database — either local or hosted.

```bash
cd api
cp .env.example .env        # put your connection string in DATABASE_URL
npm install
npm run db:check            # proves the connection before touching anything
npm run migrate             # creates the schema from db/schema.sql
npm run seed                # Kimisagara demo: accounts, registry, reports
npm run dev                 # http://localhost:4000
```

Then, in a second terminal:

```bash
cd app
npm install
npm run web                 # dashboard in the browser
npm start                   # scan the QR code with Expo Go for mobile
```

Testing on a real phone? `localhost` there means the phone itself, so set
`apiUrl` in `app/app.json` to your machine's LAN address, e.g. `http://192.168.1.20:4000`.

## Using Aiven (or Neon, Supabase, RDS)

Aiven is ordinary PostgreSQL with TLS required, so nothing in the application
changes — only `DATABASE_URL`. From the Aiven console, copy the **Service URI**
into `api/.env`, keeping `?sslmode=require` on the end:

```
DATABASE_URL=postgres://avnadmin:PASSWORD@HOST.aivencloud.com:PORT/defaultdb?sslmode=require
```

`sslmode=require` encrypts the connection but does not verify *who* answered it.
To verify the server's identity too, download **CA Certificate** from the same
page and point at it:

```
PGSSLROOTCERT=./certs/ca.pem
```

Without it the API still connects, but logs a warning at startup — fine while
developing, not fine in production. Run `npm run db:check` first: it reports the
database, the user, whether TLS actually engaged, and translates the common
failures (wrong port, missing `sslmode`, IP not allowed) into what to fix.

Aiven names the default database `defaultdb`, not `iyambere`, and uses a custom
port rather than 5432. Both are already in the URI it gives you — paste it whole.

## Browsing the data (optional)

`prisma/schema.prisma` is a **read-only mirror** of the database, kept only so
you can inspect a live Aiven instance in a GUI:

```bash
npm install       # in the repo root, once
npm run studio    # reads the same api/.env
```

It is not a migration source and the application never imports Prisma — the API
talks to PostgreSQL directly through `pg`. Three things in `db/schema.sql`
cannot be expressed in Prisma at all: the generated `deviation_pct` column, the
`ticket_ref` sequence default, and the `pressure_anomalies` /
`technician_performance` views that the dashboard reads. Running
`prisma migrate` or `prisma db push` would destroy them, so don't. After editing
`db/schema.sql`, refresh the mirror with `npm run db:pull`.

## Loading real EPANET results

```bash
cd api
npm run import:epanet -- path/to/results.csv
```

The CSV has `pipe_code, epanet_node, pressure_m` (EPANET's SI output, metres of head)
or `pressure_bar`. The script converts and stores the modelled pressure on each pipe;
from then on every report on that pipe shows it, and gauge readings are compared to it.

## Demo accounts

Created by `npm run seed` — the password for all of them is `iyambere`. On the sign-in
page, the three portal buttons sign in as the first three with one tap.

| Phone | Name | Role | Lands on |
|---|---|---|---|
| `0780000001` | Uwase Aline | Citizen | My reports · report a leak |
| `0780000002` | Habimana Eric | Technician | My jobs · accept, arrive, close out |
| `0780000003` | Mukamana Josiane | WASAC supervisor | Operations dashboard · leak map · dispatch |
| `0780000004` | Niyonzima Patrick | Technician | — |
| `0780000005` | Mugisha Jean | Citizen | — |
| `0780000006` | Ingabire Diane | Citizen | — |

The pipe geometry in the demo is **illustrative**, laid out around Kimisagara. Replace it
with the surveyed network from the GIS work before the pilot.

## Design system

A dark operations console. Colour is reserved for meaning — a status, a
severity, a pressure deviation — so a screen full of green reads as a network in
good health and a red chip is worth walking over to.

| Token | Value | Used for |
|---|---|---|
| Canvas | `#0A0A0C` | Page background |
| Surface | `#131317` | Cards and panels |
| Raised | `#1B1B21` | Inputs, active tabs, map wells |
| Accent | `#3ECF8E` | The single interactive colour |
| Brand | `#F97316` | The Iyambere mark |
| Burst / Steady / Repaired | `#F26D78` · `#E9A73E` · `#3ECF8E` | Severity and status |

Everything lives in [theme.ts](app/src/theme.ts) and the primitives in
[ui.tsx](app/src/components/ui.tsx) — `Card`, `Panel`, `Tabs`, `StatusChip`,
`Stat`, `Meter`, `Checkbox`. No screen defines a colour of its own.

**One layout, two shapes.** [AppShell](app/src/components/AppShell.tsx) renders
an icon rail plus a top bar above 900px and a bottom tab bar below it, and
[ReportList](app/src/components/ReportList.tsx) renders the same reports as a
dense table on a dashboard and as cards on a phone. Both show the identical five
facts, because those are the five an operator needs before deciding to act.

Maps follow the same palette — OpenStreetMap tiles darkened with a CSS filter on
web (no API key needed), a matching `customMapStyle`
on native — with a soft halo under each incident so a cluster of leaks reads as a
hot zone. Leaflet ships inside the app (`app/public/vendor/leaflet`), so the map
never depends on a CDN during a demo.

## Where each part of the proposal lives

| Proposal module | Code |
|---|---|
| 1 — Citizen reporting | `app/app/citizen/`, `app/src/offlineQueue.ts` |
| 2 — Operations dashboard | `app/app/ops/index.tsx`, `app/app/ops/map.tsx`, `api/src/routes/stats.js`, `api/src/routes/map.js` |
| 3 — Pressure and EPANET | `app/app/ops/pressure.tsx`, `api/src/routes/pressure.js`, `api/src/network.js`, `api/scripts/import-epanet.js`, view `pressure_anomalies` |
| 4 — Technician accountability | `app/app/report/[id].tsx`, `advance()` in `api/src/routes/reports.js`, view `technician_performance` |
| 5 — Pipeline asset registry | `app/app/ops/pipes.tsx`, `api/src/routes/pipes.js`, table `pipes` |
| 6 — Analytics | `api/src/routes/stats.js`, dashboard stat row and district table |

Two design decisions worth knowing about. Every status change goes through one
`advance()` helper, which checks the move is legal from the current status (and,
for technicians, that the job is theirs) in the same statement that makes it, so
the timestamp trail cannot be skipped or forged and two people pressing a button
at once cannot both succeed — that trail is what makes response time measurable
rather than estimated. And pipe geometry is stored as plain JSON `[lng, lat]` pairs rather
than PostGIS, which keeps the schema runnable on any Postgres instance; swap the
`path` column for `geography(LineString)` when WASAC's full network data is
imported.

## Team

| Name | Role |
|---|---|
| NGOMA Wise Crepin | Team Lead / Water Systems |
| SHEMA Josue | GIS and Mapping Specialist |
| KUBWAYO Claudette | System Design and Development |
