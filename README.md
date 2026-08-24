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
├── app/    Expo (React Native + react-native-web)  → Android · iOS · Web, one codebase
├── api/    Node.js + Express REST API
└── db/     PostgreSQL schema and seed data
```

One React Native codebase serves all three platforms. The citizen and technician
experiences are phone-first; the WASAC operations dashboard renders on the web build.

## Quick start

Prerequisites: **Node.js 18+**, **PostgreSQL 14+**.

```bash
# 1. Database
createdb iyambere
psql -d iyambere -f db/schema.sql

# 2. API
cd api
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET
npm install
npm run seed                # demo accounts, pipeline registry, sample reports
npm run dev                 # http://localhost:4000

# 3. App
cd ../app
npm install
npm run web                 # dashboard in the browser
npm start                   # scan the QR code with Expo Go for mobile
```

Testing on a real phone? `localhost` there means the phone itself, so set
`apiUrl` in `app/app.json` to your machine's LAN address, e.g. `http://192.168.1.20:4000`.

## Demo accounts

Created by `npm run seed` — the password for all of them is `iyambere`.

| Phone | Role | Lands on |
|---|---|---|
| `0780000001` | Citizen | My reports · report a leak |
| `0780000002` | Technician | My jobs · accept, arrive, close out |
| `0780000003` | Supervisor | Operations dashboard · dispatch, verify |

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
