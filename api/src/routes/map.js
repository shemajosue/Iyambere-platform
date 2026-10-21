import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { HttpError } from '../errors.js';

/**
 * The map API: everything WASAC needs to visualise where the network is
 * leaking, as standard GeoJSON. The Iyambere dashboard reads it, and so can
 * QGIS, ArcGIS or any web map (add it as a GeoJSON layer with the bearer
 * token), so the GIS team works from the same live data as operations.
 *
 *   GET /api/map/incidents   leak reports as points
 *   GET /api/map/network     the pipe registry as lines, with pressure status
 *   GET /api/map/hotspots    pipes ranked by how often they leak
 */
const router = Router();
router.use(requireAuth, requireRole('supervisor'));

const OPEN = ['submitted', 'assigned', 'accepted', 'on_site'];
const CLOSED = ['resolved', 'verified'];

const featureCollection = (features) => ({ type: 'FeatureCollection', features });

/**
 * Query parameters (all optional):
 *   state     open | closed | all          (default open)
 *   severity  low | medium | high          (comma-separated for several)
 *   days      only reports filed in the last N days
 */
router.get('/incidents', async (req, res) => {
  const { state = 'open', severity, days } = req.query;
  const conditions = [];
  const params = [];

  if (state === 'open') {
    params.push(OPEN);
    conditions.push(`r.status = ANY($${params.length}::report_status[])`);
  } else if (state === 'closed') {
    params.push(CLOSED);
    conditions.push(`r.status = ANY($${params.length}::report_status[])`);
  } else if (state === 'all') {
    conditions.push(`r.status <> 'rejected'`);
  } else {
    throw new HttpError(400, 'state must be open, closed or all.');
  }

  if (severity) {
    const levels = String(severity).split(',');
    if (levels.some((s) => !['low', 'medium', 'high'].includes(s))) {
      throw new HttpError(400, 'severity must be low, medium or high.');
    }
    params.push(levels);
    conditions.push(`r.severity = ANY($${params.length}::leak_severity[])`);
  }

  if (days) {
    const n = Number(days);
    if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'days must be a positive whole number.');
    params.push(n);
    conditions.push(`r.created_at > now() - make_interval(days => $${params.length})`);
  }

  const { rows } = await query(
    `SELECT r.id, r.ticket_ref, r.severity, r.status, r.description, r.district,
            r.latitude, r.longitude, r.created_at, r.resolved_at,
            round(EXTRACT(EPOCH FROM (now() - r.created_at)) / 3600, 1)::float AS age_hours,
            p.code AS pipe_code, t.full_name AS technician_name
       FROM reports r
       LEFT JOIN pipes p ON p.id = r.pipe_id
       LEFT JOIN users t ON t.id = r.assigned_to
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.created_at DESC`,
    params
  );

  res.json(featureCollection(rows.map(({ latitude, longitude, ...properties }) => ({
    type: 'Feature',
    id: properties.id,
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties,
  }))));
});

/** Every pipe, with its latest pressure deviation and open-leak count. */
router.get('/network', async (_req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.code, p.district, p.material, p.diameter_mm, p.installed_on, p.status,
            p.condition_score, p.design_pressure_bar AS epanet_pressure_bar, p.epanet_node, p.path,
            latest.measured_bar, latest.deviation_pct, latest.recorded_at AS reading_at,
            (SELECT count(*)::int FROM reports r
              WHERE r.pipe_id = p.id AND r.status = ANY($1::report_status[])) AS open_leaks
       FROM pipes p
       LEFT JOIN LATERAL (
         SELECT measured_bar, deviation_pct, recorded_at FROM pressure_readings
          WHERE pipe_id = p.id ORDER BY recorded_at DESC LIMIT 1
       ) latest ON true
      ORDER BY p.code`,
    [OPEN]
  );

  res.json(featureCollection(rows.map(({ path, ...properties }) => ({
    type: 'Feature',
    id: properties.id,
    geometry: { type: 'LineString', coordinates: path },
    properties: {
      ...properties,
      pressure_alert: properties.deviation_pct != null && Math.abs(properties.deviation_pct) > 15,
    },
  }))));
});

/**
 * Pipes ranked by leaks over the last `days` (default 90), combined with
 * condition and pressure — the shortlist for rehabilitation, not just repair.
 */
router.get('/hotspots', async (req, res) => {
  const days = Number(req.query.days ?? 90);
  if (!Number.isInteger(days) || days <= 0) throw new HttpError(400, 'days must be a positive whole number.');

  const { rows } = await query(
    `SELECT p.id, p.code, p.material, p.diameter_mm, p.installed_on, p.condition_score,
            count(r.id)::int                                             AS leaks,
            count(r.id) FILTER (WHERE r.severity = 'high')::int          AS bursts,
            count(r.id) FILTER (WHERE r.status = ANY($2::report_status[]))::int AS open_now,
            (SELECT deviation_pct FROM pressure_readings pr
              WHERE pr.pipe_id = p.id ORDER BY recorded_at DESC LIMIT 1) AS deviation_pct
       FROM pipes p
       JOIN reports r ON r.pipe_id = p.id
                     AND r.status <> 'rejected'
                     AND r.created_at > now() - make_interval(days => $1)
      GROUP BY p.id
      ORDER BY leaks DESC, bursts DESC, p.condition_score NULLS LAST`,
    [days, OPEN]
  );
  res.json(rows);
});

export default router;
