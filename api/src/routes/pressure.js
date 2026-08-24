import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Module 3: pressure intelligence.
 *
 * Field sensors report the pressure they measure; the EPANET hydraulic model
 * says what that node *should* read. A sustained gap between the two is the
 * signature of a leak that no citizen has walked past yet — which is how the
 * platform finds failures in rural zones where nobody is there to report them.
 */

/** Zones whose latest reading is more than 15% away from the EPANET model. */
router.get('/anomalies', requireRole('supervisor', 'technician'), async (_req, res) => {
  const { rows } = await query(
    'SELECT * FROM pressure_anomalies ORDER BY abs(deviation_pct) DESC'
  );
  res.json(rows);
});

/** Recent readings for one pipe, newest first — the trend behind an alert. */
router.get('/pipe/:pipeId', requireRole('supervisor', 'technician'), async (req, res) => {
  const { rows } = await query(
    `SELECT id, node_ref, measured_bar, epanet_expected_bar, deviation_pct, recorded_at
       FROM pressure_readings
      WHERE pipe_id = $1
      ORDER BY recorded_at DESC
      LIMIT 100`,
    [req.params.pipeId]
  );
  res.json(rows);
});

/**
 * Ingestion endpoint for the sensor gateway. Accepts a single reading or a
 * batch, so a gateway that has been offline can flush its queue in one call.
 */
router.post('/readings', requireRole('supervisor', 'technician'), async (req, res) => {
  const readings = Array.isArray(req.body) ? req.body : [req.body];

  const invalid = readings.find(
    (r) => !r.pipe_id || !r.node_ref || r.measured_bar === undefined
  );
  if (invalid) {
    return res
      .status(400)
      .json({ error: 'Each reading needs pipe_id, node_ref and measured_bar.' });
  }

  const inserted = [];
  for (const r of readings) {
    const { rows } = await query(
      `INSERT INTO pressure_readings (pipe_id, node_ref, measured_bar,
                                      epanet_expected_bar, recorded_at)
       VALUES ($1, $2, $3,
               COALESCE($4::numeric, (SELECT design_pressure_bar FROM pipes WHERE id = $1), 0),
               COALESCE($5::timestamptz, now()))
       RETURNING *`,
      [r.pipe_id, r.node_ref, r.measured_bar, r.epanet_expected_bar ?? null, r.recorded_at ?? null]
    );
    inserted.push(rows[0]);
  }

  res.status(201).json(inserted);
});

export default router;
