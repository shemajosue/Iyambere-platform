/**
 * Loads the demo data only when the database has no accounts yet, so a
 * redeploy never wipes reports people have filed. Used by scripts/boot.js.
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const { rows } = await pool.query('SELECT count(*)::int AS n FROM users');
await pool.end();

if (rows[0].n > 0) {
  console.log('Accounts already exist — keeping the current data.');
} else {
  console.log('Empty database — loading the Kimisagara demo.');
  const seed = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed.js');
  const result = spawnSync(process.execPath, [seed], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}
