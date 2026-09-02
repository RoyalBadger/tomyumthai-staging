// POST   /api/admin/login  {email, password, totp} — sign in
// GET    /api/admin/login                          — session check ("me")
// DELETE /api/admin/login                          — logout
// One file so all three share a single Vercel function (Hobby plan caps
// deployments at 12 functions). TOTP is mandatory for POST; a one-time
// recovery code is accepted in place of the 6-digit code.
import { query } from '../../lib/db.js';
import {
  verifyPassword, createSession, setSessionCookie, rateLimit, clientIp, audit,
  readJsonBody, sha256, getSessionAdmin, destroySession, clearSessionCookie,
} from '../../lib/auth.js';
import { verifyTotp } from '../../lib/totp.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const admin = await getSessionAdmin(req);
    if (!admin) return res.status(401).json({ error: 'unauthorized' });
    return res.status(200).json({ email: admin.email, role: admin.role });
  }
  if (req.method === 'DELETE') {
    await destroySession(req);
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { email, password, totp } = readJsonBody(req);
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!emailNorm || !password || !totp) return res.status(400).json({ error: 'email, password and code are required' });

  const ip = clientIp(req);
  const okIp = await rateLimit(`login:ip:${ip}`, 10, 900);
  const okEmail = await rateLimit(`login:email:${emailNorm}`, 10, 900);
  if (!okIp || !okEmail) {
    await audit(null, 'login_rate_limited', emailNorm, { ip });
    return res.status(429).json({ error: 'too many attempts — try again in 15 minutes' });
  }

  const r = await query(
    'SELECT id, password_hash, totp_secret, recovery_codes, disabled FROM admin_users WHERE email = $1',
    [emailNorm]);
  const user = r.rows[0];
  const fail = async why => {
    await audit(user?.id ?? null, 'login_failed', emailNorm, { ip, why });
    return res.status(401).json({ error: 'invalid credentials' }); // same message for every failure mode
  };

  if (!user || user.disabled) return fail('no_user');
  if (!(await verifyPassword(password, user.password_hash))) return fail('bad_password');

  const code = String(totp).trim();
  let mfaOk = false;
  if (user.totp_secret && verifyTotp(user.totp_secret, code)) {
    mfaOk = true;
  } else if (/^[0-9a-f]{10}$/i.test(code) && (user.recovery_codes || []).includes(sha256(code.toLowerCase()))) {
    mfaOk = true; // consume the recovery code
    await query('UPDATE admin_users SET recovery_codes = array_remove(recovery_codes, $2) WHERE id = $1',
      [user.id, sha256(code.toLowerCase())]);
    await audit(user.id, 'recovery_code_used', emailNorm, { ip });
  }
  if (!mfaOk) return fail('bad_totp');

  const token = await createSession(user.id);
  setSessionCookie(res, token);
  await audit(user.id, 'login_success', emailNorm, { ip });
  res.status(200).json({ ok: true });
}
