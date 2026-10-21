# Iyambere API reference

Base URL: wherever the server runs, e.g. `http://localhost:4000` or your
`https://iyambere.onrender.com`. All bodies are JSON unless marked *multipart*.

Authenticate with `POST /api/auth/login`, then send the token on every call:

```
Authorization: Bearer <token>
```

Errors always come back as `{ "error": "Human-readable message" }` with a
meaningful status: `400` bad input, `401` not signed in, `403` wrong role or
not your job, `404` not found, `409` the step is not allowed from the report's
current status.

## Roles

| Role | Portal | Can do |
|---|---|---|
| `citizen` | Citizen | File reports, follow their own tickets |
| `technician` | Technician | See and work the jobs assigned to them, read the registry, add gauge readings |
| `supervisor` | WASAC operations | Everything: dispatch, verify, reject, map, registry, pressure, accounts |

Citizens register themselves. Technician and supervisor accounts are created by
a supervisor (`POST /api/users`).

## The report lifecycle

```
submitted ──assign──▶ assigned ──accept──▶ accepted ──arrive──▶ on_site ──resolve──▶ resolved ──verify──▶ verified
    │                    │  ▲                  │
    │                    │  └──── re-assign ───┘   (allowed until the technician is on site)
    └──── reject ────────┴──▶ rejected            (duplicates, not a network leak)
```

Each step stamps its own timestamp (`assigned_at`, `accepted_at`, `arrived_at`,
`resolved_at`, `verified_at`, `rejected_at`) and adds a line to the report's
timeline. Steps out of order are refused with `409`; a technician acting on a
job that is not theirs gets `403`.

## Accounts — `/api/auth`

| Method & path | Who | Body | Returns |
|---|---|---|---|
| `POST /api/auth/register` | anyone | `full_name, phone, password, district?, email?` | `{ token, user }` — always a citizen |
| `POST /api/auth/login` | anyone | `phone, password` | `{ token, user }` |
| `GET /api/auth/me` | signed in | — | the current user |

## Reports — `/api/reports`

| Method & path | Who | Body | Notes |
|---|---|---|---|
| `GET /api/reports?status=` | all | — | Citizens get their own, technicians their assignments, supervisors everything |
| `GET /api/reports/:id` | party to it / supervisor | — | Report + `timeline` + `hydraulics` (staff only, see below) |
| `POST /api/reports` | all | *multipart*: `latitude, longitude, severity (low\|medium\|high), description?, district?, photo?` | Matched to the nearest live pipe within 150 m |
| `POST /api/reports/:id/assign` | supervisor | `technician_id, pipe_id?` | Dispatch, or re-dispatch until arrival |
| `POST /api/reports/:id/accept` | assigned technician | — | |
| `POST /api/reports/:id/arrive` | assigned technician | — | |
| `POST /api/reports/:id/resolve` | assigned technician | *multipart*: `notes` (required), `photo?` | Close-out |
| `POST /api/reports/:id/verify` | supervisor | `notes?` | A repair only counts once verified |
| `POST /api/reports/:id/reject` | supervisor | `reason` (required) | Before anyone is on site; reporter sees the reason |

`hydraulics` on a report:

```json
{
  "pipe": { "code": "KMS-BR-03", "material": "PVC", "diameter_mm": 110, "installed_on": "2005-02-01",
            "design_pressure_bar": 3.9, "epanet_node": "J-12", "condition_score": 2,
            "status": "active", "previous_leaks": 2, "path": [[30.0478, -1.9486], ...] },
  "latest_reading": { "measured_bar": 3.11, "epanet_expected_bar": 3.9, "deviation_pct": -20.26, "recorded_at": "..." },
  "nearby_inactive": [ { "code": "KMS-OLD-05", "status": "inactive", "distance_m": 24, ... } ]
}
```

## Map (GeoJSON) — `/api/map` · supervisor

Standard GeoJSON `FeatureCollection`s, so the same live layers open in QGIS or
ArcGIS (add a GeoJSON layer with the `Authorization` header).

| Path | Query | Features |
|---|---|---|
| `GET /api/map/incidents` | `state=open\|closed\|all` (default `open`), `severity=high,medium`, `days=30` | Points: `ticket_ref, severity, status, age_hours, pipe_code, technician_name, ...` |
| `GET /api/map/network` | — | LineStrings: pipe attributes + `measured_bar, deviation_pct, pressure_alert, open_leaks` |
| `GET /api/map/hotspots` | `days=90` | Plain JSON: pipes ranked by leaks, bursts, open now, pressure deviation |

## Pipeline registry — `/api/pipes`

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/pipes?district=&status=` | signed in | |
| `GET /api/pipes/:id` | signed in | Includes the last 20 reports on that pipe |
| `POST /api/pipes` | supervisor | `code, district` required; `path` as `[[lng, lat], ...]` |
| `PATCH /api/pipes/:id` | supervisor, technician | `status, condition_score, last_maintenance_on, notes` |

## Pressure & EPANET — `/api/pressure` · supervisor, technician

| Method & path | Notes |
|---|---|
| `GET /api/pressure/anomalies` | Pipes whose latest reading is more than 15% off the EPANET value |
| `GET /api/pressure/pipe/:pipeId` | Last 100 readings for one pipe |
| `POST /api/pressure/readings` | One reading or an array: `pipe_id, node_ref, measured_bar, epanet_expected_bar?, recorded_at?`. The expected value defaults to the pipe's EPANET pressure |

Model pressures are loaded from an EPANET run with
`npm run import:epanet -- results.csv` (see `api/scripts/import-epanet.js`).

## Analytics — `/api/stats` · supervisor

| Path | Returns |
|---|---|
| `GET /api/stats/overview` | Counts by stage, average hours to repair, pressure alerts, reports by district |
| `GET /api/stats/technicians` | Per technician: jobs assigned and completed, average hours to arrive and to resolve |
| `GET /api/stats/technicians/available` | Active technicians ordered by open workload (the dispatch picker) |

## Accounts admin — `/api/users` · supervisor

| Method & path | Notes |
|---|---|
| `GET /api/users?role=&search=` | With activity counts |
| `POST /api/users` | Create a citizen, technician or supervisor (staff need a district) |
| `PATCH /api/users/:id` | Role, district, name, email, `is_active`. Cannot lock out the last supervisor |
| `POST /api/users/:id/password` | Reset a password |

## Health

`GET /health` → `{ "status": "ok" }`, used by the cloud host's health check.
