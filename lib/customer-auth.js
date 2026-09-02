// Customer sessions (phone-OTP identity) + Twilio Verify REST client.
// Separate from admin sessions on purpose: customers get a long-lived
// convenience session; the manager portal keeps its strict TOTP regime.
// Zero dependencies — Verify is called over plain REST like our Stripe client.
import { createHash, randomBytes } from 'node:crypto';
import { query } from './db.js';
import { parseCookies } from './auth.js';

const COOKIE = 'tyt_csess';
const SESSION_DAYS = 180;
const sha256 = s => createHash('sha256').update(s).digest('hex');

// --- Twilio Verify ----------------------------------------------------------
function twilioCreds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const verify = process.env.TWILIO_VERIFY_SID;
  if (!sid || !token || !verify) throw new Error('Twilio env vars missing');
  return { auth: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), verify };
}

async function twilioPost(path, params) {
  const { auth, verify } = twilioCreds();
  const res = await fetch(`https://verify.twilio.com/v2/Services/${verify}/${path}`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('twilio verify error', res.status, j.code, j.message);
    const err = new Error(j.code === 60200 ? 'That phone number does not look valid.'
      : j.code === 60203 ? 'Too many attempts for this number — please wait a few minutes.'
      : 'Could not send the code — please try again shortly.');
    err.status = 400;
    throw err;
  }
  return j;
}

export function verifyStart(phoneE164) {
  return twilioPost('Verifications', { To: phoneE164, Channel: 'sms' });
}

export async function verifyCheck(phoneE164, code) {
  const j = await twilioPost('VerificationCheck', { To: phoneE164, Code: String(code) });
  return j.status === 'approved';
}

// --- sessions ---------------------------------------------------------------
export async function createCustomerSession(customerId) {
  const token = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO customer_sessions (token_hash, customer_id, expires_at)
     VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [sha256(token), customerId]);
  await query('DELETE FROM customer_sessions WHERE expires_at < now()', []);
  return token;
}

export async function getSessionCustomer(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await query(
    `SELECT c.id, c.phone_e164, c.name, c.email, c.default_address
     FROM customer_sessions s JOIN customers c ON c.id = s.customer_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)]);
  const cust = r.rows[0] || null;
  if (cust) {
    // Sliding renewal: every authenticated visit extends the session.
    await query(
      `UPDATE customer_sessions SET expires_at = now() + interval '${SESSION_DAYS} days'
       WHERE token_hash = $1`, [sha256(token)]);
    await query('UPDATE customers SET last_seen = now() WHERE id = $1', [cust.id]);
  }
  return cust;
}

export async function destroyCustomerSession(req) {
  const token = parseCookies(req)[COOKIE];
  if (token) await query('DELETE FROM customer_sessions WHERE token_hash = $1', [sha256(token)]);
}

// SameSite=Lax (not Strict): a 3-D Secure bank redirect during payment returns
// the customer cross-site; Lax keeps them signed in on that top-level navigation.
export function setCustomerCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
}

export function clearCustomerCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
