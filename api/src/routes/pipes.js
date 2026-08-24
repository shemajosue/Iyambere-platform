import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Module 5: the national pipeline asset registry.
 * Filter by district or by status so the dashboard can, for example, show only
 * the inactive segments that are so often mistaken for live mains in the field.
 */
router.get('/', async (req, res) => {
  const { district, status } = req.query;
  const conditions = [];
  const params = [];

  if (district) {
    params.push(district);
    conditions.push(`district = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`SELECT * FROM pipes ${where} ORDER BY code`, params);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM pipes WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Pipe not found.' });

  // The maintenance history that makes the registry worth keeping.
  const history = await query(
    `SELECT ticket_ref, severity, status, resolved_at, resolution_notes
       FROM reports WHERE pipe_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [req.params.id]
  );

  res.json({ ...rows[0], history: history.rows });
});

router.post('/', requireRole('supervisor'), async (req, res) => {
  const {
    code, district, material, diameter_mm, installed_on,
    design_pressure_bar, condition_score, status, path, notes,
  } = req.body;

  if (!code || !district) {
    return res.status(400).json({ error: 'A pipe code and district are required.' });
  }

  const { rows } = await query(
    `INSERT INTO pipes (code, district, material, diameter_mm, installed_on,
                        design_pressure_bar, condition_score, status, path, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::pipe_status, 'active'),
             COALESCE($9::jsonb, '[]'::jsonb), $10)
     RETURNING *`,
    [code, district, material || null, diameter_mm || null, installed_on || null,
     design_pressure_bar || null, condition_score || null, status || null,
     JSON.stringify(path || []), notes || null]
  );

  res.status(201).json(rows[0]);
});

/** Field staff update condition and activity status without leaving the site. */
router.patch('/:id', requireRole('supervisor', 'technician'), async (req, res) => {
  const allowed = ['status', 'condition_score', 'last_maintenance_on', 'notes'];
  const assignments = [];
  const params = [];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      params.push(req.body[field]);
      assignments.push(
        field === 'status'
          ? `status = $${params.length}::pipe_status`
          : `${field} = $${params.length}`
      );
    }
  }

  if (!assignments.length) return res.status(400).json({ error: 'Nothing to update.' });

  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE pipes SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );

  if (!rows[0]) return res.status(404).json({ error: 'Pipe not found.' });
  res.json(rows[0]);
});

export default router;
