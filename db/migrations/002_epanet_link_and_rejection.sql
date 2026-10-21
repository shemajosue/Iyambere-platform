-- Links every leak report to the hydraulic model, and lets operators close
-- reports that are not genuine leaks.
--
-- Thesis decision (Oct 2026): no field pressure sensors in the pilot. Instead,
-- each report is matched to the nearest pipe in the registry, so it arrives
-- carrying that pipe's material, diameter, condition and EPANET-modelled
-- pressure. Technicians can add a gauge reading on site for comparison.

-- How far the reported GPS point is from the matched pipe. A large distance
-- means the match is weak and the operator should check it before dispatch.
ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS pipe_distance_m NUMERIC(7, 1);

-- Duplicates and false alarms are closed with a reason, never deleted, so the
-- citizen still sees what happened to their ticket.
ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- The EPANET junction this segment is modelled by, so imported model results
-- and on-site gauge readings line up with the same node.
ALTER TABLE pipes
    ADD COLUMN IF NOT EXISTS epanet_node TEXT;

COMMENT ON COLUMN pipes.design_pressure_bar IS
    'Pressure the EPANET model predicts for this segment (bar). Loaded by npm run import:epanet.';
