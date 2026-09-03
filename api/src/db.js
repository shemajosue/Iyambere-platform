import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';

// Numeric columns come back as strings by default. Latitude, pressure and the
// analytics averages are all NUMERIC, and the app wants numbers.
pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

// DATE columns have no time and no timezone, but the driver turns them into a
// JS Date at *local* midnight. Serialised to JSON from Rwanda (UTC+2) that
// becomes 22:00 the previous day, so a maintenance date entered on the 3rd
// reads back as the 2nd. Keep them as the 'YYYY-MM-DD' string Postgres stored.
pg.types.setTypeParser(1082, (value) => value);

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/iyambere';

const url = new URL(DATABASE_URL);
const sslmode = url.searchParams.get('sslmode');

/**
 * Hosted Postgres (Aiven, Neon, Supabase, RDS) issues certificates from its own
 * private root, so a plain TLS handshake fails with "self-signed certificate in
 * certificate chain" until you supply that root. PGSSLROOTCERT points at the
 * ca.pem downloaded from the provider's console and turns on real verification;
 * without it we still encrypt, but cannot prove the server is theirs.
 */
function sslOptions() {
  if (!sslmode || sslmode === 'disable') return false;

  const caPath = process.env.PGSSLROOTCERT;
  if (caPath) {
    if (!fs.existsSync(caPath)) {
      throw new Error(`PGSSLROOTCERT points at ${caPath}, which does not exist.`);
    }
    return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  }

  console.warn(
    'DATABASE_URL asks for SSL but PGSSLROOTCERT is unset — connecting without ' +
      'verifying the server certificate. Set PGSSLROOTCERT before going live.',
  );
  return { rejectUnauthorized: false };
}

// The connection is configured field by field rather than by handing pg the URL.
// pg merges whatever it parses out of a connection string OVER the options given
// here (pg 8.23 turns `sslmode=require` into `ssl: {}`), which would silently
// replace the settings above and reintroduce the self-signed failure.
export const pool = new pg.Pool({
  host: url.hostname,
  port: Number(url.port) || 5432,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)) || undefined,
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

/** The connection target, with the password removed — safe to log. */
export function describeConnection() {
  return `${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}`;
}

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
