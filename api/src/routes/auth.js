import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

const PUBLIC_FIELDS = 'id, full_name, phone, email, role, district';

router.post('/register', async (req, res) => {
  const { full_name, phone, password, email, district } = req.body;
  if (!full_name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone number and password are required.' });
  }

  const existing = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rowCount) {
    return res.status(409).json({ error: 'That phone number is already registered.' });
  }

  // Registration through the app is always a citizen account. Technician and
  // supervisor accounts are provisioned by WASAC, not self-service.
  const { rows } = await query(
    `INSERT INTO users (full_name, phone, email, district, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, 'citizen')
     RETURNING ${PUBLIC_FIELDS}`,
    [full_name, phone, email || null, district || null, bcrypt.hashSync(password, 10)]
  );

  const user = rows[0];
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body;
  const { rows } = await query(
    `SELECT ${PUBLIC_FIELDS}, password_hash FROM users WHERE phone = $1`,
    [phone]
  );

  const user = rows[0];
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Wrong phone number or password.' });
  }

  delete user.password_hash;
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  res.json(rows[0]);
});

export default router;
