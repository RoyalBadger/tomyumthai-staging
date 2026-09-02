// Self-contained migration runner: pulls DATABASE_URL from Vercel, applies any
// unapplied db/migrations/*.sql via migrate.mjs, then deletes the pulled
// credentials file. Works from any cwd:  node db/migrate-with-env.mjs
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = join(repo, '.env.migration');

console.log('--- pulling env vars from Vercel ---');
execSync('npx vercel env pull .env.migration --environment=production --yes',
  { cwd: repo, stdio: 'inherit', shell: true });

try {
  const m = readFileSync(envFile, 'utf8').match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!m) {
    console.error('DATABASE_URL not found in pulled env file');
    process.exit(1);
  }
  process.env.DATABASE_URL = m[1];
  console.log('--- running migrations ---');
  await import(pathToFileURL(join(repo, 'db', 'migrate.mjs')).href);
} finally {
  rmSync(envFile, { force: true });
  console.log('--- credentials file deleted ---');
}
