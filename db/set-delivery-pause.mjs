// Pause/resume direct delivery from the command line (same effect as the
// manager-portal toggle). Usage:  node db/set-delivery-pause.mjs on|off
// Pulls DATABASE_URL from Vercel like migrate-with-env.mjs, then updates the
// settings singleton and prints the resulting value.
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const arg = (process.argv[2] || '').toLowerCase();
if (!['on', 'off'].includes(arg)) {
  console.error('usage: node db/set-delivery-pause.mjs on|off   (on = delivery paused, Grubhub takes over)');
  process.exit(1);
}

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = join(repo, '.env.migration');
execSync('npx vercel env pull .env.migration --environment=production --yes',
  { cwd: repo, stdio: 'inherit', shell: true });

let url;
try {
  const m = readFileSync(envFile, 'utf8').match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!m) { console.error('DATABASE_URL not found in pulled env file'); process.exit(1); }
  url = m[1];
} finally {
  rmSync(envFile, { force: true });
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query('UPDATE settings SET delivery_paused = $1', [arg === 'on']);
  const r = await client.query('SELECT delivery_paused FROM settings');
  console.log('delivery_paused =', r.rows[0].delivery_paused,
    arg === 'on' ? '(site now routes delivery to Grubhub; pickup stays open)' : '(direct delivery restored)');
} finally {
  await client.end();
}
