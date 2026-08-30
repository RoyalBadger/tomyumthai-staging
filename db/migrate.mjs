// Applies db/migrations/*.sql in filename order, tracking applied ones in _migrations.
// Usage: DATABASE_URL=... npm run migrate
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set((await client.query('SELECT name FROM _migrations')).rows.map(r => r.name));
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (applied.has(f)) { console.log(`skip  ${f}`); continue; }
    const sql = readFileSync(join(dir, f), 'utf8');
    console.log(`apply ${f}`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }
  console.log('migrations complete');
} finally {
  await client.end();
}
