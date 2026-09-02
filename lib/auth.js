// Admin auth: scrypt password hashing (node:crypto, no deps), server-side sessions
// (hashed tokens in Postgres, httpOnly cookies), DB-backed rate limiting, audit log.
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const COOKIE_NAME = 'tyt_admin';
const SESSION_HOURS = 12;

// --- passwords ---------------------------------------------------------------
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length,
      { N: Number(N), r: Number(r), p: Number(p) });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch { return false; }
}

export const sha256 = s => createHash('sha256').update(s).digest('hex');

// --- sessions ----------------------------------------------------------------
export async function createSession(adminId) {
  const token = randomBytes(32).toString('hex');
  await query(
    `INSERT INTO sessions (token_hash, admin_id, expires_at)
     VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
    [sha256(token), adminId, SESSION_HOURS]);
  // opportunistic cleanup
  await query('DELETE FROM sessions WHERE expires_at < now()', []);
  return token;
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export async function getSessionAdmin(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const r = await query(
    `SELECT a.id, a.email, a.role FROM sessions s
     JOIN admin_users a ON a.id = s.admin_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT a.disabled`,
    [sha256(token)]);
  return r.rows[0] || null;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

export async function destroySession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

/** Wrap an /api/admin handler: 401 unless a valid session exists. */
export function requireAdmin(handler) {
  return async (req, res) => {
    const admin = await getSessionAdmin(req);
    if (!admin) return res.status(401).json({ error: 'unauthorized' });
    return handler(req, res, admin);
  };
}

// --- rate limiting (fixed window) --------------------------------------------
export async function rateLimit(key, max, windowSeconds) {
  const r = await query(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval
                    THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - ($2 || ' seconds')::interval
                    THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, windowSeconds]);
  return r.rows[0].count <= max;
}

export function clientIp(req) {
  // Prefer x-real-ip: Vercel sets it itself, so a client-sent X-Forwarded-For
  // can never prepend a forged address and rotate past per-IP rate limits.
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || 'unknown';
}

// Global spend guard for Google Routes calls: daily + monthly counters kept
// below the free tier. Every code path that can trigger a Google call checks
// this, so the "$0 by construction" guarantee holds site-wide.
export async function googleSpendAllowed() {
  const daily = Number(process.env.GOOGLE_DAILY_CAP || 500);
  const monthly = Number(process.env.GOOGLE_MONTHLY_CAP || 9000);
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).slice(0, 7);
  const dailyOk = await rateLimit('google-distance:daily:global', daily, 86_400);
  const monthlyOk = await rateLimit(`google-distance:month:${month}`, monthly, 32 * 86_400);
  return dailyOk && monthlyOk;
}

// --- audit -------------------------------------------------------------------
export async function audit(adminId, action, target, detail) {
  await query(
    'INSERT INTO admin_audit_log (admin_id, action, target, detail) VALUES ($1,$2,$3,$4)',
    [adminId, action, target ?? null, detail ? JSON.stringify(detail) : null]);
}

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
