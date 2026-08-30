// Creates (or resets) an admin user with TOTP enrollment. Run locally, never deployed.
// Usage:
//   DATABASE_URL=... ADMIN_EMAIL=owner@mytomyumthai.com ADMIN_PASSWORD='...' ADMIN_ROLE=owner node db/create-admin.mjs
// Prints: the otpauth:// URI (scan as QR / enter manually in any authenticator app)
// and 8 one-time recovery codes. Both are shown ONCE — store them safely.
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { hashPassword, sha256 } from '../lib/auth.js';
import { generateTotpSecret, otpauthUri } from '../lib/totp.js';

const url = process.env.DATABASE_URL;
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const role = process.env.ADMIN_ROLE || 'manager';

if (!url || !email || !password) {
  console.error('Set DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (and optionally ADMIN_ROLE=owner|manager).');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}

const totpSecret = generateTotpSecret();
const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(5).toString('hex')); // 10 hex chars
const passwordHash = await hashPassword(password);

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query(
    `INSERT INTO admin_users (email, password_hash, totp_secret, recovery_codes, role, disabled)
     VALUES ($1,$2,$3,$4,$5,false)
     ON CONFLICT (email) DO UPDATE SET password_hash=$2, totp_secret=$3, recovery_codes=$4, role=$5, disabled=false`,
    [email, passwordHash, totpSecret, recoveryCodes.map(sha256), role]);
  await client.query('DELETE FROM sessions USING admin_users a WHERE sessions.admin_id=a.id AND a.email=$1', [email]);
  console.log(`\nAdmin ${email} (${role}) created/reset. Existing sessions revoked.\n`);
  console.log('1) Add to your authenticator app (Google Authenticator, Authy, 1Password, ...):');
  console.log(`   ${otpauthUri(email, totpSecret)}`);
  console.log(`   Manual entry secret: ${totpSecret}\n`);
  console.log('2) One-time recovery codes (each works once, in place of the 6-digit code):');
  for (const c of recoveryCodes) console.log(`   ${c}`);
  console.log('\nStore these somewhere safe (password manager). They will not be shown again.');
} finally {
  await client.end();
}
