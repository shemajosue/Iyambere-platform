-- Iyambere — Smart Water Infrastructure Management Platform
-- PostgreSQL schema. Run once against an empty database:
--   createdb iyambere && psql -d iyambere -f db/schema.sql

BEGIN;

-- ---------------------------------------------------------------- enums ----

CREATE TYPE user_role     AS ENUM ('citizen', 'technician', 'supervisor');
CREATE TYPE leak_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE pipe_status   AS ENUM ('active', 'inactive', 'decommissioned');

-- The lifecycle of a report. Every transition is timestamped so response
-- performance can be measured instead of estimated.
CREATE TYPE report_status AS ENUM (
    'submitted',   -- citizen sent it in
    'assigned',    -- operator dispatched a technician
    'accepted',    -- technician confirmed the job
    'on_site',     -- technician arrived at the GPS location
    'resolved',    -- repair done, close-out submitted
    'verified',    -- supervisor confirmed the repair
    'rejected'     -- not a genuine leak / duplicate
);

-- ---------------------------------------------------------------- users ----

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     TEXT        NOT NULL,
    phone         TEXT        NOT NULL UNIQUE,   -- the login identifier in Rwanda
    email         TEXT,
    password_hash TEXT        NOT NULL,
    role          user_role   NOT NULL DEFAULT 'citizen',
    district      TEXT,                          -- technicians and supervisors are zoned
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------- pipeline registry ----

-- Module 5: the national asset registry. `path` holds the segment geometry as
-- a JSON array of [longitude, latitude] pairs, which keeps the schema portable
-- to any Postgres instance; swap it for PostGIS geography when WASAC's full
-- network data is imported.
CREATE TABLE pipes (
    id                  SERIAL PRIMARY KEY,
    code                TEXT        NOT NULL UNIQUE,
    district            TEXT        NOT NULL,
    material            TEXT,                       -- HDPE, PVC, steel, ductile iron
    diameter_mm         INTEGER,
    installed_on        DATE,
    design_pressure_bar NUMERIC(5, 2),              -- expected operating pressure
    condition_score     SMALLINT CHECK (condition_score BETWEEN 1 AND 5),
    status              pipe_status NOT NULL DEFAULT 'active',
    last_maintenance_on DATE,
    path                JSONB       NOT NULL DEFAULT '[]'::jsonb,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pipes_district_idx ON pipes (district);
CREATE INDEX pipes_status_idx   ON pipes (status);

-- -------------------------------------------------------------- reports ----

-- Human-facing ticket references: IYB-000001, IYB-000002, ...
CREATE SEQUENCE ticket_ref_seq START 1;

CREATE TABLE reports (
    id                   SERIAL PRIMARY KEY,
    ticket_ref           TEXT          NOT NULL UNIQUE
                             DEFAULT 'IYB-' || lpad(nextval('ticket_ref_seq')::text, 6, '0'),
    reporter_id          INTEGER       NOT NULL REFERENCES users (id),
    description          TEXT,
    severity             leak_severity NOT NULL DEFAULT 'medium',
    status               report_status NOT NULL DEFAULT 'submitted',

    latitude             NUMERIC(9, 6) NOT NULL,
    longitude            NUMERIC(9, 6) NOT NULL,
    district             TEXT,
    photo_url            TEXT,

    pipe_id              INTEGER       REFERENCES pipes (id),
    assigned_to          INTEGER       REFERENCES users (id),

    -- Module 4: the accountability trail.
    assigned_at          TIMESTAMPTZ,
    accepted_at          TIMESTAMPTZ,
    arrived_at           TIMESTAMPTZ,
    resolved_at          TIMESTAMPTZ,
    verified_at          TIMESTAMPTZ,

    resolution_notes     TEXT,
    resolution_photo_url TEXT,

    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_idx   ON reports (status);
CREATE INDEX reports_assigned_idx ON reports (assigned_to);
CREATE INDEX reports_reporter_idx ON reports (reporter_id);
CREATE INDEX reports_created_idx  ON reports (created_at DESC);

-- Append-only timeline shown to the citizen as they track their ticket.
CREATE TABLE report_events (
    id         SERIAL PRIMARY KEY,
    report_id  INTEGER       NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
    actor_id   INTEGER       REFERENCES users (id),
    status     report_status NOT NULL,
    note       TEXT,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX report_events_report_idx ON report_events (report_id, created_at);

-- ----------------------------------------------------- pressure / EPANET ----

-- Module 3: field sensor readings compared against the EPANET hydraulic model.
-- A sustained deviation is the signature of a leak that no citizen has seen yet.
CREATE TABLE pressure_readings (
    id                  SERIAL PRIMARY KEY,
    pipe_id             INTEGER       NOT NULL REFERENCES pipes (id) ON DELETE CASCADE,
    node_ref            TEXT          NOT NULL,        -- EPANET node identifier
    measured_bar        NUMERIC(5, 2) NOT NULL,
    epanet_expected_bar NUMERIC(5, 2) NOT NULL,
    recorded_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),

    -- Deviation from the model, as a percentage, maintained by the database.
    deviation_pct       NUMERIC(6, 2) GENERATED ALWAYS AS (
                            CASE WHEN epanet_expected_bar = 0 THEN 0
                                 ELSE round(
                                     (measured_bar - epanet_expected_bar)
                                     / epanet_expected_bar * 100, 2)
                            END
                        ) STORED
);

CREATE INDEX pressure_pipe_idx ON pressure_readings (pipe_id, recorded_at DESC);

-- A zone is anomalous when its latest reading is more than 15% off the model.
CREATE VIEW pressure_anomalies AS
SELECT DISTINCT ON (r.pipe_id)
       r.id,
       r.pipe_id,
       p.code     AS pipe_code,
       p.district,
       r.node_ref,
       r.measured_bar,
       r.epanet_expected_bar,
       r.deviation_pct,
       r.recorded_at
FROM   pressure_readings r
JOIN   pipes p ON p.id = r.pipe_id
WHERE  abs(r.deviation_pct) > 15
ORDER  BY r.pipe_id, r.recorded_at DESC;

-- -------------------------------------------------- technician analytics ----

-- Module 6: response performance per technician, computed rather than reported.
CREATE VIEW technician_performance AS
SELECT u.id                                                         AS technician_id,
       u.full_name,
       u.district,
       count(r.id)                                                  AS jobs_assigned,
       count(*) FILTER (WHERE r.status IN ('resolved', 'verified')) AS jobs_completed,
       round(avg(EXTRACT(EPOCH FROM (r.arrived_at  - r.assigned_at)) / 3600)::numeric, 2) AS avg_hours_to_arrive,
       round(avg(EXTRACT(EPOCH FROM (r.resolved_at - r.assigned_at)) / 3600)::numeric, 2) AS avg_hours_to_resolve
FROM   users u
LEFT   JOIN reports r ON r.assigned_to = u.id
WHERE  u.role = 'technician'
GROUP  BY u.id, u.full_name, u.district;

-- ------------------------------------------------------------- triggers ----

CREATE FUNCTION touch_updated_at() RETURNS TRIGGER AS $fn$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER reports_touch_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
