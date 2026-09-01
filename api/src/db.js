import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';

// Numeric columns come back as strings by default. Latitude, pressure and the
// analytics averages are all NUMERIC, and the app wants numbers.
pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/iyambere';

// Hosted Postgres (Aiven, Neon, Supabase, RDS) refuses plaintext connections,
// but node-postgres will not pull a CA certificate out of the URL on its own.
// So: `sslmode=` in DATABASE_URL turns TLS on, and PGSSLROOTCERT — pointed at
// the ca.pem downloaded from the provider's console — turns on real verification
// of who we are talking to. Without the CA we still encrypt, but we cannot prove
// the server is theirs, so that path is development-only.
function sslOptions() {
  if (!/[?&]sslmode=(require|verify-ca|verify-full)/.test(connectionString)) return false;

  const caPath = process.env.PGSSLROOTCERT;
  if (caPath) return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };

  console.warn(
    'DATABASE_URL asks for SSL but PGSSLROOTCERT is unset — connecting without ' +
      'verifying the server certificate. Set PGSSLROOTCERT before going live.',
  );
  return { rejectUnauthorized: false };
}

export const pool = new pg.Pool({
  connectionString,
  ssl: sslOptions(),
  // A cloud database is milliseconds away instead of microseconds, and free
  // tiers cap total connections. Keep the pool small and fail fast.
  max: Number(process.env.PGPOOL_MAX || 10),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

// A dropped cloud connection surfaces on an idle client, not on a query. Without
// a listener here that event is an unhandled error and takes the process down.
pool.on('error', (error) => console.error('Idle database client error:', error));

export function query(text, params) {
  return pool.query(text, params);
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
