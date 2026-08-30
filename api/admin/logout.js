// POST /api/admin/logout
import { destroySession, clearSessionCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  await destroySession(req);
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}
