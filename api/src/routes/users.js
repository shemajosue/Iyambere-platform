import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();

// Account administration is a supervisor capability throughout.
router.use(requireAuth, requireRole('supervisor'));

const PUBLIC_FIELDS = 'id, full_name, phone, email, role, district, is_active, created_at';

/**
 * Everyone on the platform, with enough activity to tell a working account from
 * a dormant one. Filterable by role so the admin screen can show one group.
 */
router.get('/', async (req, res) => {
  const { role, search } = req.query;
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`u.role = $${params.length}::user_role`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.full_name ILIKE $${params.length} OR u.phone ILIKE $${params.length})`);
  }

  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS.split(', ').map((f) => `u.${f}`).join(', ')},
            count(DISTINCT filed.id)    AS reports_filed,
            count(DISTINCT assigned.id) AS jobs_assigned,
            count(DISTINCT assigned.id) FILTER (
              WHERE assigned.status IN ('resolved', 'verified')
            )                           AS jobs_completed
       FROM users u
       LEFT JOIN reports filed    ON filed.reporter_id = u.id
       LEFT JOIN reports assigned ON assigned.assigned_to = u.id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY u.id
      ORDER BY u.is_active DESC, u.role, u.full_name`,
    params
  );

  res.json(rows);
});

/**
 * Provisions a WASAC staff account. This is the only way a technician or
 * supervisor comes into existence — self-registration through the app always
 * produces a citizen, so field and operations access is always granted
 * deliberately by someone who already has it.
 */
router.post('/', async (req, res) => {
  const { full_name, phone, password, role, district, email } = req.body;

  if (!full_name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone number and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Use a password of at least 6 characters.' });
  }
  if (!['citizen', 'technician', 'supervisor'].includes(role)) {
    return res.status(400).json({ error: 'Choose a role for this account.' });
  }
  if (role !== 'citizen' && !district) {
    return res.status(400).json({ error: 'Staff accounts need a district so work can be zoned.' });
  }

  const existing = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rowCount) {
    return res.status(409).json({ error: 'That phone number already has an account.' });
  }

  const { rows } = await query(
    `INSERT INTO users (full_name, phone, email, district, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, $6::user_role)
     RETURNING ${PUBLIC_FIELDS}`,
    [full_name, phone, email || null, district || null, bcrypt.hashSync(password, 10), role]
  );

  res.status(201).json(rows[0]);
});

/** Change someone's role, zone, or whether they can still sign in. */
router.patch('/:id', async (req, res) => {
  const targetId = Number(req.params.id);
  const { role, district, is_active, full_name, email } = req.body;

  // Two ways a supervisor could lock themselves — and possibly everyone — out.
  if (targetId === req.user.id) {
    if (is_active === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    if (role && role !== 'supervisor') {
      return res.status(400).json({ error: 'You cannot remove your own supervisor access.' });
    }
  }

  // And one way the organisation could lose administration entirely.
  if (role === 'citizen' || role === 'technician' || is_active === false) {
    const target = await query('SELECT role FROM users WHERE id = $1', [targetId]);
    if (target.rows[0]?.role === 'supervisor') {
      const { rows } = await query(
        `SELECT count(*)::int AS remaining FROM users
          WHERE role = 'supervisor' AND is_active AND id <> $1`,
        [targetId]
      );
      if (rows[0].remaining === 0) {
        return res
          .status(400)
          .json({ error: 'This is the last active supervisor. Promote someone else first.' });
      }
    }
  }

  const assignments = [];
  const params = [];
  const set = (column, value, cast = '') => {
    params.push(value);
    assignments.push(`${column} = $${params.length}${cast}`);
  };

  if (role !== undefined) set('role', role, '::user_role');
  if (district !== undefined) set('district', district || null);
  if (is_active !== undefined) set('is_active', is_active);
  if (full_name !== undefined) set('full_name', full_name);
  if (email !== undefined) set('email', email || null);

  if (!assignments.length) return res.status(400).json({ error: 'Nothing to update.' });

  params.push(targetId);
  const { rows } = await query(
    `UPDATE users SET ${assignments.join(', ')}
      WHERE id = $${params.length} RETURNING ${PUBLIC_FIELDS}`,
    params
  );

  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  res.json(rows[0]);
});

/**
 * Sets a new password for someone who has lost theirs. There is no self-service
 * reset yet, so without this a forgotten technician password is unrecoverable.
 */
router.post('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Use a password of at least 6 characters.' });
  }

  const { rows } = await query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING ${PUBLIC_FIELDS}`,
    [bcrypt.hashSync(password, 10), req.params.id]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  res.json({ ok: true, user: rows[0] });
});

export default router;
