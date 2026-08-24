import { Router } from 'express';
import { query, transaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { upload, photoUrl } from '../upload.js';

const router = Router();
router.use(requireAuth);

const LIST_COLUMNS = `
  r.id, r.ticket_ref, r.description, r.severity, r.status,
  r.latitude, r.longitude, r.district, r.photo_url, r.resolution_photo_url,
  r.resolution_notes, r.created_at, r.assigned_at, r.accepted_at,
  r.arrived_at, r.resolved_at, r.verified_at,
  reporter.full_name  AS reporter_name,
  reporter.phone      AS reporter_phone,
  tech.id             AS technician_id,
  tech.full_name      AS technician_name,
  tech.phone          AS technician_phone,
  p.code              AS pipe_code
`;

function buildListQuery(where, params) {
  return query(
    `SELECT ${LIST_COLUMNS}
       FROM reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       LEFT JOIN users tech ON tech.id = r.assigned_to
       LEFT JOIN pipes p   ON p.id = r.pipe_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT 200`,
    params
  );
}

/**
 * Everyone sees the reports that concern them: citizens see their own,
 * technicians see their assignments, supervisors see the whole network.
 */
router.get('/', async (req, res) => {
  const { role, id } = req.user;
  const { status } = req.query;

  const conditions = [];
  const params = [];

  if (role === 'citizen') {
    params.push(id);
    conditions.push(`r.reporter_id = $${params.length}`);
  } else if (role === 'technician') {
    params.push(id);
    conditions.push(`r.assigned_to = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await buildListQuery(where, params);
  res.json(rows);
});

/** One report plus its full status timeline. */
router.get('/:id', async (req, res) => {
  const { rows } = await buildListQuery('WHERE r.id = $1', [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  // Citizens and technicians may only open a report they are party to.
  const { role, id } = req.user;
  if (role === 'citizen' || role === 'technician') {
    const allowed = await query(
      'SELECT 1 FROM reports WHERE id = $1 AND (reporter_id = $2 OR assigned_to = $2)',
      [req.params.id, id]
    );
    if (!allowed.rowCount) return res.status(403).json({ error: 'Not your report.' });
  }

  const events = await query(
    `SELECT e.status, e.note, e.created_at, u.full_name AS actor_name
       FROM report_events e
       LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.report_id = $1
      ORDER BY e.created_at`,
    [req.params.id]
  );

  res.json({ ...report, timeline: events.rows });
});

/** Module 1: a citizen submits a geotagged, photo-verified leak report. */
router.post('/', upload.single('photo'), async (req, res) => {
  const { latitude, longitude, description, severity, district } = req.body;
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'A GPS location is required to submit a report.' });
  }

  const report = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO reports (reporter_id, description, severity, district,
                            latitude, longitude, photo_url)
       VALUES ($1, $2, COALESCE($3::leak_severity, 'medium'), $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        description || null,
        severity || null,
        district || null,
        latitude,
        longitude,
        photoUrl(req, req.file),
      ]
    );

    const row = inserted.rows[0];
    await client.query(
      `INSERT INTO report_events (report_id, actor_id, status, note)
       VALUES ($1, $2, 'submitted', 'Report received.')`,
      [row.id, req.user.id]
    );
    return row;
  });

  res.status(201).json(report);
});

// --------------------------------------------------------------- workflow ---

/**
 * Advances a report to `status`, stamping the matching timestamp column and
 * appending a timeline entry. This single helper is why the accountability
 * trail can never drift out of sync with the report's state.
 */
async function advance({ reportId, actorId, status, timestampColumn, note, extra = {} }) {
  return transaction(async (client) => {
    const assignments = [`status = $1`, `${timestampColumn} = now()`];
    const params = [status];

    for (const [column, value] of Object.entries(extra)) {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    }

    params.push(reportId);
    const updated = await client.query(
      `UPDATE reports SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!updated.rowCount) return null;

    await client.query(
      `INSERT INTO report_events (report_id, actor_id, status, note) VALUES ($1, $2, $3, $4)`,
      [reportId, actorId, status, note]
    );
    return updated.rows[0];
  });
}

/** Module 2: the operator dispatches a technician from the dashboard. */
router.post('/:id/assign', requireRole('supervisor'), async (req, res) => {
  const { technician_id, pipe_id } = req.body;
  if (!technician_id) return res.status(400).json({ error: 'Choose a technician.' });

  const tech = await query(`SELECT full_name FROM users WHERE id = $1 AND role = 'technician'`, [
    technician_id,
  ]);
  if (!tech.rowCount) return res.status(400).json({ error: 'That technician does not exist.' });

  const report = await advance({
    reportId: req.params.id,
    actorId: req.user.id,
    status: 'assigned',
    timestampColumn: 'assigned_at',
    note: `Assigned to ${tech.rows[0].full_name}.`,
    extra: pipe_id ? { assigned_to: technician_id, pipe_id } : { assigned_to: technician_id },
  });

  if (!report) return res.status(404).json({ error: 'Report not found.' });
  res.json(report);
});

/** Module 4: the technician confirms the job, then confirms arrival on site. */
router.post('/:id/accept', requireRole('technician'), async (req, res) => {
  const report = await advance({
    reportId: req.params.id,
    actorId: req.user.id,
    status: 'accepted',
    timestampColumn: 'accepted_at',
    note: 'Technician accepted the job.',
  });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  res.json(report);
});

router.post('/:id/arrive', requireRole('technician'), async (req, res) => {
  const report = await advance({
    reportId: req.params.id,
    actorId: req.user.id,
    status: 'on_site',
    timestampColumn: 'arrived_at',
    note: 'Technician arrived on site.',
  });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  res.json(report);
});

/** Close-out: a photo of the completed repair plus what was done. */
router.post(
  '/:id/resolve',
  requireRole('technician'),
  upload.single('photo'),
  async (req, res) => {
    const report = await advance({
      reportId: req.params.id,
      actorId: req.user.id,
      status: 'resolved',
      timestampColumn: 'resolved_at',
      note: req.body.notes || 'Repair completed.',
      extra: {
        resolution_notes: req.body.notes || null,
        resolution_photo_url: photoUrl(req, req.file),
      },
    });
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    res.json(report);
  }
);

/** A repair only counts once a supervisor has verified it. */
router.post('/:id/verify', requireRole('supervisor'), async (req, res) => {
  const report = await advance({
    reportId: req.params.id,
    actorId: req.user.id,
    status: 'verified',
    timestampColumn: 'verified_at',
    note: req.body.notes || 'Repair verified.',
  });
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  res.json(report);
});

export default router;
