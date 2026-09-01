// GET  /api/admin/orders?since=<iso>   — kitchen queue: active paid orders (+ recent completed)
// PATCH /api/admin/orders              — {id, status} advance an order through the lifecycle
// Poll GET every 5-10s from the kitchen screen; `new_since` in the response drives the audio alert.
import { query } from '../../lib/db.js';
import { requireAdmin, audit, readJsonBody } from '../../lib/auth.js';
import { canTransition } from '../../lib/order-status.js';

export default requireAdmin(async (req, res, admin) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const orders = (await query(
      `SELECT o.id, o.public_code, o.order_type, o.status, o.customer_name, o.customer_phone,
              o.sms_opt_in, o.delivery_address, o.delivery_notes, o.subtotal_cents, o.discount_cents,
              o.tax_cents, o.delivery_fee_cents, o.total_cents, o.promo_code,
              o.paid_at, o.created_at, o.updated_at
       FROM orders o
       WHERE o.status IN ('received','cooking','ready')
          OR (o.status = 'completed' AND o.updated_at > now() - interval '2 hours')
       ORDER BY o.created_at ASC`, [])).rows;

    let items = [];
    if (orders.length) {
      items = (await query(
        `SELECT order_id, name, size_label, protein, extras, spice_level, exclusions, notes,
                unit_price_cents, qty, COALESCE(station, 'main') AS station
         FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY id`,
        [orders.map(o => o.id)])).rows;
    }
    const byOrder = {};
    for (const it of items) (byOrder[it.order_id] ??= []).push(it);

    const since = req.query?.since ? new Date(req.query.since) : null;
    const newCount = since && !isNaN(since)
      ? orders.filter(o => o.status === 'received' && new Date(o.paid_at || o.created_at) > since).length
      : 0;

    return res.status(200).json({
      now: new Date().toISOString(),
      new_since: newCount,
      orders: orders.map(o => ({ ...o, items: byOrder[o.id] || [] })),
    });
  }

  if (req.method === 'PATCH') {
    const { id, status } = readJsonBody(req);
    if (!id || !status) return res.status(400).json({ error: 'id and status required' });

    const cur = (await query('SELECT id, public_code, status FROM orders WHERE id = $1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'unknown order' });
    if (!canTransition(cur.status, status)) {
      return res.status(409).json({ error: `cannot move ${cur.public_code} from ${cur.status} to ${status}` });
    }

    const r = await query(
      `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 AND status = $3
       RETURNING id, public_code, status, updated_at`,
      [id, status, cur.status]); // optimistic: concurrent tap loses cleanly
    if (!r.rows[0]) return res.status(409).json({ error: 'order changed underneath you — refresh' });

    await audit(admin.id, 'status_change', cur.public_code, { from: cur.status, to: status });
    return res.status(200).json({ ok: true, order: r.rows[0] });
  }

  res.status(405).json({ error: 'method not allowed' });
});
