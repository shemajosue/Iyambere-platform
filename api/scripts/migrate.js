/**
 * Brings whatever DATABASE_URL points at up to date.
 *
 *   npm run migrate            # create the schema, then apply pending migrations
 *   npm run migrate -- --reset # drop everything first, then rebuild from scratch
 *
 * Two kinds of file are applied, in this order:
 *
 *   db/schema.sql        the base schema, run once on an empty database
 *   db/migrations/*.sql  every change since, applied in filename order
 *
 * Applied migrations are recorded in schema_migrations, so re-running this is
 * safe and never touches existing data. Once the database holds anything you
 * care about, add a numbered file in db/migrations/ rather than editing
 * schema.sql — editing the base only affects databases created from scratch.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(here, '../../db');
const schemaPath = path.join(dbDir, 'schema.sql');
const migrationsDir = path.join(dbDir, 'migrations');

// Reverse of schema.sql. Views and the trigger function go with their tables via
// CASCADE, so the tables and enums are the whole list.
const DROP_ALL = `
DROP TABLE IF EXISTS pressure_readings, report_events, reports, pipes, users CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;
DROP SEQUENCE IF EXISTS ticket_ref_seq CASCADE;
DROP FUNCTION IF EXISTS touch_updated_at() CASCADE;
DROP TYPE IF EXISTS report_status, pipe_status, leak_severity, user_role CASCADE;
`;

const LEDGER = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function baseSchemaExists() {
  const { rows } = await pool.query(
    `SELECT to_regclass('public.users') IS NOT NULL AS present`
  );
  return rows[0].present;
}

async function main() {
  const reset = process.argv.includes('--reset');

  const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
  console.log(`Connected to ${rows[0].db} — ${rows[0].version.split(',')[0]}\n`);

  if (reset) {
    console.log('Dropping existing Iyambere objects...');
    await pool.query(DROP_ALL);
  }

  if (await baseSchemaExists()) {
    console.log('Base schema already present — skipping schema.sql');
  } else {
    // schema.sql wraps itself in BEGIN/COMMIT, so this is all-or-nothing already.
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
    console.log('Base schema applied from db/schema.sql');
  }

  await pool.query(LEDGER);

  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
    : [];

  const applied = new Set(
    (await pool.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
  );

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    // Each migration and its ledger entry commit together, so an interrupted
    // run can never leave a migration half-applied but marked as done.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  applied  ${file}`);
      count++;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${file} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  console.log(
    count === 0
      ? `\nUp to date — ${files.length} migration(s) already applied.`
      : `\n${count} migration(s) applied.`
  );
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
