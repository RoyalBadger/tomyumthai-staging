// Postgres pool singleton for Vercel serverless functions.
// DATABASE_URL comes from the Neon integration (Vercel project env vars).
import pg from 'pg';

let pool;

export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: true },
      max: 3, // serverless: keep tiny, Neon pools upstream
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
