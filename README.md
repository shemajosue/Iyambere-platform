# Iyambere

**A Smart Water Infrastructure Management Platform for Rwanda's National Water Supply Network**

Iyambere (Kinyarwanda: *progress*) helps WASAC cut Non-Revenue Water by turning leak
reporting from a passive phone-call channel into a georeferenced, verifiable digital workflow.

Built by **Team Iyambere** — University of Rwanda, College of Science and Technology.
Aligned with **SDG 6: Clean Water and Sanitation**.

---

## What it does

| Module | Who uses it | What it delivers |
|---|---|---|
| **1. Citizen reporting** | Public | GPS-tagged, photo-verified leak reports + live ticket tracking |
| **2. Operations dashboard** | WASAC operators | Map of live incidents, dispatch, response-time monitoring |
| **3. Pressure & EPANET** | WASAC engineers | Measured vs. EPANET-expected pressure, automatic anomaly flags |
| **4. Technician accountability** | Field technicians | Accept → arrive → repair → close-out, every step timestamped |
| **5. Pipeline asset registry** | Engineers | Material, age, condition, and active/inactive/decommissioned status |
| **6. Analytics** | Management | Response times, NRW indicators, district leaderboards |

## Architecture

```
iyambere/
├── app/      Expo (React Native + react-native-web) → Android · iOS · Web, one codebase
├── api/      Node.js + Express REST API, talking to PostgreSQL through `pg`
├── db/       schema.sql — the authoritative database definition
└── prisma/   optional read-only mirror, for browsing the data in Prisma Studio
```

One React Native codebase serves all three platforms. The citizen and technician
experiences are phone-first; the WASAC operations dashboard renders on the web build.

## Quick start

Prerequisites: **Node.js 18+**, and a PostgreSQL database — either local or hosted.

```bash
cd api
cp .env.example .env        # put your connection string in DATABASE_URL
npm install
npm run db:check            # proves the connection before touching anything
npm run migrate             # creates the schema from db/schema.sql
npm run seed                # demo accounts, pipeline registry, sample reports
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

## Demo accounts

Created by `npm run seed` — the password for all of them is `iyambere`.

| Phone | Role | Lands on |
|---|---|---|
| `0780000001` | Citizen | My reports · report a leak |
| `0780000002` | Technician | My jobs · accept, arrive, close out |
| `0780000003` | Supervisor | Operations dashboard · dispatch, verify |

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

Maps follow the same palette — dark Carto tiles on web, a matching
`customMapStyle` on native — with a soft halo under each incident so a cluster
of leaks reads as a hot zone.

## Where each part of the proposal lives

| Proposal module | Code |
|---|---|
| 1 — Citizen reporting | `app/app/citizen/`, `app/src/offlineQueue.ts` |
| 2 — Operations dashboard | `app/app/ops/index.tsx`, `api/src/routes/stats.js` |
| 3 — Pressure and EPANET | `app/app/ops/pressure.tsx`, `api/src/routes/pressure.js`, view `pressure_anomalies` |
| 4 — Technician accountability | `app/app/report/[id].tsx`, `advance()` in `api/src/routes/reports.js`, view `technician_performance` |
| 5 — Pipeline asset registry | `app/app/ops/pipes.tsx`, `api/src/routes/pipes.js`, table `pipes` |
| 6 — Analytics | `api/src/routes/stats.js`, dashboard stat row and district table |

Two design decisions worth knowing about. Every status change goes through one
`advance()` helper, so the timestamp trail and the visible timeline can never
drift apart — that trail is what makes response time measurable rather than
estimated. And pipe geometry is stored as plain JSON `[lng, lat]` pairs rather
than PostGIS, which keeps the schema runnable on any Postgres instance; swap the
`path` column for `geography(LineString)` when WASAC's full network data is
imported.

## Team

| Name | Role |
|---|---|
| NGOMA Wise Crepin | Team Lead / Water Systems |
| SHEMA Josue | GIS and Mapping Specialist |
| KUBWAYO Claudette | System Design and Development |
