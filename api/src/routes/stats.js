import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/** The headline numbers on the WASAC operations dashboard. */
router.get('/overview', requireRole('supervisor'), async (_req, res) => {
  const [counts, response, districts, anomalies] = await Promise.all([
    query(`
      SELECT count(*)                                                        AS total,
             count(*) FILTER (WHERE status = 'submitted')                    AS awaiting_dispatch,
             count(*) FILTER (WHERE status IN ('assigned','accepted','on_site')) AS in_progress,
             count(*) FILTER (WHERE status IN ('resolved','verified'))       AS closed,
             count(*) FILTER (WHERE created_at > now() - interval '7 days')  AS last_7_days
        FROM reports`),
    query(`
      SELECT round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 1)
               AS avg_hours_to_resolve
        FROM reports WHERE resolved_at IS NOT NULL`),
    query(`
      SELECT COALESCE(district, 'Unassigned') AS district,
             count(*)                         AS reports,
             count(*) FILTER (WHERE severity = 'high') AS high_severity
        FROM reports
       GROUP BY 1
       ORDER BY reports DESC
       LIMIT 10`),
    query('SELECT count(*) AS anomalous_zones FROM pressure_anomalies'),
  ]);

  res.json({
    ...counts.rows[0],
    avg_hours_to_resolve: response.rows[0].avg_hours_to_resolve,
    anomalous_zones: Number(anomalies.rows[0].anomalous_zones),
    by_district: districts.rows,
  });
});

/** Module 4: how each technician is actually performing, straight from the data. */
router.get('/technicians', requireRole('supervisor'), async (_req, res) => {
  const { rows } = await query(
    'SELECT * FROM technician_performance ORDER BY jobs_completed DESC, full_name'
  );
  res.json(rows);
});

/** The dispatch picker on the dashboard. */
router.get('/technicians/available', requireRole('supervisor'), async (req, res) => {
  const { district } = req.query;
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.phone, u.district,
            count(r.id) FILTER (
              WHERE r.status IN ('assigned','accepted','on_site')
            ) AS open_jobs
       FROM users u
       LEFT JOIN reports r ON r.assigned_to = u.id
      WHERE u.role = 'technician' AND u.is_active
        AND ($1::text IS NULL OR u.district = $1)
      GROUP BY u.id
      ORDER BY open_jobs, u.full_name`,
    [district || null]
  );
  res.json(rows);
});

export default router;
