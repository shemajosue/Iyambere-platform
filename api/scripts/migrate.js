/**
 * Applies db/schema.sql to whatever DATABASE_URL points at.
 *
 *   npm run migrate            # create the schema
 *   npm run migrate -- --reset # drop everything first, then create it
 *
 * The README's `psql -f db/schema.sql` does the same thing, but psql is rarely
 * installed alongside a cloud database — this needs nothing but Node.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, '../../db/schema.sql');

// Reverse of schema.sql. Views and the trigger function go with their tables via
// CASCADE, so the tables and enums are the whole list.
const DROP_ALL = `
DROP TABLE IF EXISTS pressure_readings, report_events, reports, pipes, users CASCADE;
DROP SEQUENCE IF EXISTS ticket_ref_seq CASCADE;
DROP FUNCTION IF EXISTS touch_updated_at() CASCADE;
DROP TYPE IF EXISTS report_status, pipe_status, leak_severity, user_role CASCADE;
`;

async function main() {
  const reset = process.argv.includes('--reset');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
  console.log(`Connected to ${rows[0].db} — ${rows[0].version.split(',')[0]}`);

  if (reset) {
    console.log('Dropping existing Iyambere objects...');
    await pool.query(DROP_ALL);
  }

  // schema.sql wraps itself in BEGIN/COMMIT, so this is all-or-nothing already.
  await pool.query(schema);
  console.log('Schema applied. Next: npm run seed');
}

main()
  .catch((error) => {
    console.error('\nMigration failed:', error.message);
    if (error.code === '42710' || error.code === '42P07') {
      console.error('Those objects already exist — re-run with: npm run migrate -- --reset');
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
