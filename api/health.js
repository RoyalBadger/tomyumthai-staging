// GET /api/health — verifies function runtime + database connectivity.
import { query } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const r = await query('SELECT count(*)::int AS items FROM menu_items', []);
    res.status(200).json({ ok: true, db: true, menu_items: r.rows[0].items });
  } catch (e) {
    res.status(500).json({ ok: false, db: false, error: e.code || e.message });
  }
}
