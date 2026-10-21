import { Router } from 'express';
import { query, transaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { upload, photoUrl } from '../upload.js';
import { HttpError } from '../errors.js';
import { inactivePipesNear, nearestActivePipe } from '../network.js';

const router = Router();
router.use(requireAuth);

const SEVERITIES = ['low', 'medium', 'high'];

const LIST_COLUMNS = `
  r.id, r.ticket_ref, r.description, r.severity, r.status,
  r.latitude, r.longitude, r.district, r.photo_url, r.resolution_photo_url,
  r.resolution_notes, r.created_at, r.assigned_at, r.accepted_at,
  r.arrived_at, r.resolved_at, r.verified_at, r.rejected_at,
  r.pipe_id, r.pipe_distance_m,
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

/** Rejects anything that is not a positive whole number before it reaches SQL. */
function reportId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'That is not a valid report.');
  return id;
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
    conditions.push(`r.status = $${params.length}::report_status`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await buildListQuery(where, params);
  res.json(rows);
});

/**
 * The hydraulic context of a report: the pipe it was matched to, what the
 * EPANET model expects there, the most recent measured pressure, and any
 * inactive mains nearby that a crew could confuse with the live one.
 */
async function hydraulicContext(report) {
  const nearbyInactive = await inactivePipesNear(report.latitude, report.longitude);
  if (!report.pipe_id) return { pipe: null, latest_reading: null, nearby_inactive: nearbyInactive };

  const [pipe, reading, history] = await Promise.all([
    query(
      `SELECT id, code, district, material, diameter_mm, installed_on, design_pressure_bar,
              condition_score, status, last_maintenance_on, epanet_node, notes, path
         FROM pipes WHERE id = $1`,
      [report.pipe_id]
    ),
    query(
      `SELECT node_ref, measured_bar, epanet_expected_bar, deviation_pct, recorded_at
         FROM pressure_readings WHERE pipe_id = $1
        ORDER BY recorded_at DESC LIMIT 1`,
      [report.pipe_id]
    ),
    query(
      `SELECT count(*)::int AS previous_leaks
         FROM reports WHERE pipe_id = $1 AND id <> $2 AND status <> 'rejected'`,
      [report.pipe_id, report.id]
    ),
  ]);

  return {
    pipe: pipe.rows[0] ? { ...pipe.rows[0], previous_leaks: history.rows[0].previous_leaks } : null,
    latest_reading: reading.rows[0] ?? null,
    nearby_inactive: nearbyInactive,
  };
}

/** One report plus its full status timeline and hydraulic context. */
router.get('/:id', async (req, res) => {
  const id = reportId(req);
  const { rows } = await buildListQuery('WHERE r.id = $1', [id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  // Citizens and technicians may only open a report they are party to.
  const { role, id: userId } = req.user;
  if (role === 'citizen' || role === 'technician') {
    const allowed = await query(
      'SELECT 1 FROM reports WHERE id = $1 AND (reporter_id = $2 OR assigned_to = $2)',
      [id, userId]
    );
    if (!allowed.rowCount) return res.status(403).json({ error: 'Not your report.' });
  }

  const [events, hydraulics] = await Promise.all([
    query(
      `SELECT e.status, e.note, e.created_at, u.full_name AS actor_name
         FROM report_events e
         LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.report_id = $1
        ORDER BY e.created_at, e.id`,
      [id]
    ),
    // Citizens do not need the network internals, only their ticket's progress.
    role === 'citizen' ? null : hydraulicContext(report),
  ]);

  res.json({ ...report, timeline: events.rows, hydraulics });
});

/**
 * Module 1: a citizen submits a geotagged, photo-verified leak report.
 * The report is matched to the nearest live pipe on arrival, so it reaches
 * the operator already carrying that pipe's data and modelled pressure.
 */
router.post('/', upload.single('photo'), async (req, res) => {
  const { description, severity, district } = req.body;
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (req.body.latitude === undefined || req.body.longitude === undefined) {
    throw new HttpError(400, 'A GPS location is required to submit a report.');
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new HttpError(400, 'That GPS location is not valid.');
  }
  if (severity && !SEVERITIES.includes(severity)) {
    throw new HttpError(400, 'Severity must be low, medium or high.');
  }

  const match = await nearestActivePipe(latitude, longitude);

  const report = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO reports (reporter_id, description, severity, district,
                            latitude, longitude, photo_url, pipe_id, pipe_distance_m)
       VALUES ($1, $2, COALESCE($3::leak_severity, 'medium'), $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.id,
        description || null,
        severity || null,
        district || null,
        latitude,
        longitude,
        photoUrl(req, req.file),
        match?.pipe_id ?? null,
        match?.distance_m ?? null,
      ]
    );

    const row = inserted.rows[0];
    const note = match
      ? `Report received. Matched to pipe ${match.code}, ${Math.round(match.distance_m)} m away.`
      : 'Report received.';
    await client.query(
      `INSERT INTO report_events (report_id, actor_id, status, note)
       VALUES ($1, $2, 'submitted', $3)`,
      [row.id, req.user.id, note]
    );
    return row;
  });

  res.status(201).json(report);
});

// --------------------------------------------------------------- workflow ---

/**
 * The only legal moves through a report's life. Anything else — verifying a
 * repair that never happened, accepting a job twice — is refused, because the
 * accountability trail is only worth something if it cannot be skipped.
 *
 *   submitted → assigned → accepted → on_site → resolved → verified
 *        ↘ rejected ↙ (before anyone is on site)
 */
const TRANSITIONS = {
  assigned: ['submitted', 'assigned', 'accepted'], // re-dispatch allowed until arrival
  accepted: ['assigned'],
  on_site: ['accepted'],
  resolved: ['on_site'],
  verified: ['resolved'],
  rejected: ['submitted', 'assigned'],
};

const STATUS_WORDS = {
  submitted: 'waiting for dispatch',
  assigned: 'assigned',
  accepted: 'accepted',
  on_site: 'in progress on site',
  resolved: 'repaired and awaiting verification',
  verified: 'already verified',
  rejected: 'closed',
};

/**
 * Advances a report to `status`, stamping the matching timestamp column and
 * appending a timeline entry. This single helper is why the accountability
 * trail can never drift out of sync with the report's state.
 *
 * The status check and the update happen in one statement, so two people
 * pressing a button at the same moment cannot both succeed.
 */
async function advance({
  reportId, actorId, status, timestampColumn, note, extra = {}, mustBeAssignedTo = null,
}) {
  return transaction(async (client) => {
    const assignments = [`status = $1`, `${timestampColumn} = now()`];
    const params = [status];

    for (const [column, value] of Object.entries(extra)) {
      params.push(value);
      assignments.push(`${column} = $${params.length}`);
    }

    params.push(TRANSITIONS[status]);
    const fromClause = `status = ANY($${params.length}::report_status[])`;

    let ownerClause = '';
    if (mustBeAssignedTo) {
      params.push(mustBeAssignedTo);
      ownerClause = ` AND assigned_to = $${params.length}`;
    }

    params.push(reportId);
    const updated = await client.query(
      `UPDATE reports SET ${assignments.join(', ')}
        WHERE id = $${params.length} AND ${fromClause}${ownerClause}
        RETURNING *`,
      params
    );

    if (!updated.rowCount) {
      const current = await client.query(
        'SELECT status, assigned_to FROM reports WHERE id = $1', [reportId]
      );
      const row = current.rows[0];
      if (!row) throw new HttpError(404, 'Report not found.');
      if (mustBeAssignedTo && row.assigned_to !== mustBeAssignedTo) {
        throw new HttpError(403, 'This job is assigned to another technician.');
      }
      throw new HttpError(409, `This report is ${STATUS_WORDS[row.status]}, so that step is not available.`);
    }

    await client.query(
      `INSERT INTO report_events (report_id, actor_id, status, note) VALUES ($1, $2, $3, $4)`,
      [reportId, actorId, status, note]
    );
    return updated.rows[0];
  });
}

/** Module 2: the operator dispatches (or re-dispatches) a technician. */
router.post('/:id/assign', requireRole('supervisor'), async (req, res) => {
  const id = reportId(req);
  const { technician_id, pipe_id } = req.body;
  if (!technician_id) throw new HttpError(400, 'Choose a technician.');

  const tech = await query(
    `SELECT full_name FROM users WHERE id = $1 AND role = 'technician' AND is_active`,
    [technician_id]
  );
  if (!tech.rowCount) throw new HttpError(400, 'That technician does not exist or is inactive.');

  // A re-dispatch starts the technician's clock again from zero.
  const extra = { assigned_to: technician_id, accepted_at: null };
  if (pipe_id) extra.pipe_id = pipe_id;

  const report = await advance({
    reportId: id,
    actorId: req.user.id,
    status: 'assigned',
    timestampColumn: 'assigned_at',
    note: `Assigned to ${tech.rows[0].full_name}.`,
    extra,
  });
  res.json(report);
});

/** Module 4: the assigned technician confirms the job, then arrival on site. */
router.post('/:id/accept', requireRole('technician'), async (req, res) => {
  const report = await advance({
    reportId: reportId(req),
    actorId: req.user.id,
    status: 'accepted',
    timestampColumn: 'accepted_at',
    note: 'Technician accepted the job.',
    mustBeAssignedTo: req.user.id,
  });
  res.json(report);
});

router.post('/:id/arrive', requireRole('technician'), async (req, res) => {
  const report = await advance({
    reportId: reportId(req),
    actorId: req.user.id,
    status: 'on_site',
    timestampColumn: 'arrived_at',
    note: 'Technician arrived on site.',
    mustBeAssignedTo: req.user.id,
  });
  res.json(report);
});

/** Close-out: what was done (required) plus a photo of the completed repair. */
router.post(
  '/:id/resolve',
  requireRole('technician'),
  upload.single('photo'),
  async (req, res) => {
    const notes = (req.body.notes || '').trim();
    if (!notes) throw new HttpError(400, 'Describe the repair before closing the job.');

    const report = await advance({
      reportId: reportId(req),
      actorId: req.user.id,
      status: 'resolved',
      timestampColumn: 'resolved_at',
      note: notes,
      extra: {
        resolution_notes: notes,
        resolution_photo_url: photoUrl(req, req.file),
      },
      mustBeAssignedTo: req.user.id,
    });
    res.json(report);
  }
);

/** A repair only counts once a supervisor has verified it. */
router.post('/:id/verify', requireRole('supervisor'), async (req, res) => {
  const report = await advance({
    reportId: reportId(req),
    actorId: req.user.id,
    status: 'verified',
    timestampColumn: 'verified_at',
    note: req.body.notes || 'Repair verified.',
  });
  res.json(report);
});

/** Duplicates and false alarms are closed with a reason the citizen can read. */
router.post('/:id/reject', requireRole('supervisor'), async (req, res) => {
  const reason = (req.body.reason || '').trim();
  if (!reason) throw new HttpError(400, 'Give a reason so the reporter knows why it was closed.');

  const report = await advance({
    reportId: reportId(req),
    actorId: req.user.id,
    status: 'rejected',
    timestampColumn: 'rejected_at',
    note: reason,
  });
  res.json(report);
});

export default router;
