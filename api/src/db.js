import 'dotenv/config';
import pg from 'pg';

// Numeric columns come back as strings by default. Latitude, pressure and the
// analytics averages are all NUMERIC, and the app wants numbers.
pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/iyambere',
});

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
