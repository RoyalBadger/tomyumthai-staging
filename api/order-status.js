// GET /api/order-status?code=TYT-2026-0001 — public order status.
// Order codes are sequential (kitchen-friendly), therefore guessable — so this endpoint
// returns NO personal information: status, type, timing, and item names only.
import { query } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const code = String(req.query?.code || '').trim().toUpperCase();
  if (!/^TYT-\d{4}-\d{4,}$/.test(code)) return res.status(400).json({ error: 'invalid order code' });

  const o = (await query(
    `SELECT public_code, order_type, status, created_at, total_cents
     FROM orders WHERE public_code = $1 AND status <> 'canceled'`, [code])).rows[0];
  if (!o || o.status === 'pending_payment') return res.status(404).json({ error: 'order not found' });

  const items = (await query(
    `SELECT name, size_label, qty FROM order_items
     WHERE order_id = (SELECT id FROM orders WHERE public_code = $1) ORDER BY id`, [code])).rows;

  const st = (await query('SELECT pickup_eta_minutes, delivery_eta_minutes FROM settings', [])).rows[0];

  res.status(200).json({
    order_code: o.public_code,
    order_type: o.order_type,
    status: o.status, // received | cooking | ready | completed
    created_at: o.created_at,
    total_cents: o.total_cents,
    eta_minutes: o.order_type === 'delivery' ? st.delivery_eta_minutes : st.pickup_eta_minutes,
    items: items.map(i => ({ name: i.name + (i.size_label ? ` (${i.size_label})` : ''), qty: i.qty })),
  });
}
