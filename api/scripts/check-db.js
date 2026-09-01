/**
 * Connectivity smoke test. Run this BEFORE migrating, so a bad host, a wrong
 * password or a missing sslmode fails here with an explanation instead of
 * halfway through creating tables.
 *
 *   npm run db:check
 */
import 'dotenv/config';
import { pool } from '../src/db.js';

// The mistakes an Aiven connection string actually fails on, and what to do.
const HINTS = {
  ENOTFOUND: 'Host not found. Check the host in DATABASE_URL against the Aiven console.',
  ECONNREFUSED: 'Nothing listening on that port. Aiven uses a custom port, not 5432.',
  ETIMEDOUT: 'Connection timed out. If your Aiven service restricts IPs, add yours.',
  '28P01': 'Password rejected. Copy the password again from the Aiven console.',
  '3D000': 'That database does not exist. Aiven names the default one "defaultdb".',
  '28000': 'Authentication rejected — usually a missing ?sslmode=require on the URL.',
};

function redact(url) {
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:••••@');
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy api/.env.example to api/.env first.');
    process.exitCode = 1;
    return;
  }

  console.log(`Connecting to ${redact(url)}`);

  const { rows } = await pool.query(`
    SELECT current_database() AS database,
           current_user       AS user,
           version()          AS version,
           (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS tables
  `);

  const info = rows[0];
  console.log(`  database : ${info.database}`);
  console.log(`  user     : ${info.user}`);
  console.log(`  server   : ${info.version.split(' on ')[0]}`);
  console.log(`  tables   : ${info.tables} in the public schema`);

  // TLS status comes from the driver, not from SQL — worth showing, because a
  // hosted database that connected without it is misconfigured.
  const client = await pool.connect();
  const encrypted = Boolean(client.connection?.stream?.encrypted);
  client.release();
  console.log(`  TLS      : ${encrypted ? 'encrypted' : 'PLAINTEXT'}`);

  console.log(
    info.tables > 0
      ? '\nReady. The schema is already there — run "npm run seed" for demo data.'
      : '\nReady. Empty database — run "npm run migrate" next.'
  );
}

main()
  .catch((error) => {
    console.error(`\nCould not connect: ${error.message}`);
    const hint = HINTS[error.code];
    if (hint) console.error(`\n  ${hint}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
