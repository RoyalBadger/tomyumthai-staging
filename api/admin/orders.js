// GET  /api/admin/orders?since=<iso>   — kitchen queue: active paid orders (+ recent completed)
// PATCH /api/admin/orders              — {id, status} advance an order through the lifecycle
//                                        {id, reprint: true} queue the tickets for the print agent again
// Poll GET every 5-10s from the kitchen screen; `new_since` in the response drives the audio alert.
//
// Print agent (restaurant PC, print-agent/agent.mjs) — authenticated by the X-Print-Token
// header (env PRINT_AGENT_TOKEN) instead of an admin session. It lives in this function
// because the Vercel Hobby plan caps deployments at 12 functions and we are at the cap.
//   GET  ?printer=1              → orders whose tickets still need printing (+ heartbeat)
//   PATCH {id, printed: true}    → mark an order's tickets as printed
import { createHash, timingSafeEqual } from 'node:crypto';
import { query } from '../../lib/db.js';
import { requireAdmin, audit, readJsonBody } from '../../lib/auth.js';
import { canTransition } from '../../lib/order-status.js';

const ORDER_COLS = `o.id, o.public_code, o.order_type, o.status, o.customer_name, o.customer_phone,
              o.sms_opt_in, o.delivery_address, o.delivery_notes, o.subtotal_cents, o.discount_cents,
              o.tax_cents, o.delivery_fee_cents, o.total_cents, o.promo_code,
              o.paid_at, o.created_at, o.updated_at, o.printed_at, o.print_requested_at`;

async function attachItems(orders) {
  let items = [];
  if (orders.length) {
    items = (await query(
      `SELECT oi.order_id, oi.name, oi.size_label, oi.variant, oi.protein, oi.extras, oi.spice_level,
              oi.exclusions, oi.notes, oi.unit_price_cents, oi.qty,
              COALESCE(oi.station, 'main') AS station
       FROM order_items oi
       WHERE oi.order_id = ANY($1::uuid[]) ORDER BY oi.id`,
      [orders.map(o => o.id)])).rows;
  }
  const byOrder = {};
  for (const it of items) (byOrder[it.order_id] ??= []).push(it);
  return orders.map(o => ({ ...o, items: byOrder[o.id] || [] }));
}

// --- print agent -------------------------------------------------------------
const sha = s => createHash('sha256').update(String(s)).digest();

/** true if the request carries a valid print-agent token; null if none was sent. */
function printTokenStatus(req) {
  const sent = req.headers['x-print-token'];
  if (typeof sent !== 'string' || !sent) return null;
  const expected = process.env.PRINT_AGENT_TOKEN;
  if (!expected || expected.length < 32) return false;
  return timingSafeEqual(sha(sent), sha(expected));
}

async function printAgentHandler(req, res) {
  if (req.method === 'GET') {
    // Heartbeat first so the portal knows the agent is alive even when nothing is pending.
    await query('UPDATE settings SET print_agent_seen_at = now()', []);
    const orders = (await query(
      `SELECT ${ORDER_COLS} FROM orders o
       WHERE o.status IN ('received','cooking','ready') AND o.paid_at IS NOT NULL
         AND (o.printed_at IS NULL OR o.print_requested_at > o.printed_at)
       ORDER BY o.created_at ASC LIMIT 20`, [])).rows;
    return res.status(200).json({ now: new Date().toISOString(), orders: await attachItems(orders) });
  }

  if (req.method === 'PATCH') {
    const { id, printed } = readJsonBody(req);
    if (!id || printed !== true) return res.status(400).json({ error: 'id and printed:true required' });
    const r = await query(
      `UPDATE orders SET printed_at = now() WHERE id = $1 RETURNING public_code, printed_at`, [id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'unknown order' });
    return res.status(200).json({ ok: true, order: r.rows[0] });
  }

  res.status(405).json({ error: 'method not allowed' });
}

// --- admin (kitchen screen) --------------------------------------------------
const adminHandler = requireAdmin(async (req, res, admin) => {
  if (req.method === 'GET') {
    const [ordersRes, settingsRes] = await Promise.all([
      query(
        `SELECT ${ORDER_COLS} FROM orders o
         WHERE o.status IN ('received','cooking','ready')
            OR (o.status = 'completed' AND o.updated_at > now() - interval '2 hours')
         ORDER BY o.created_at ASC`, []),
      query('SELECT * FROM settings', []),
    ]);
    const orders = await attachItems(ordersRes.rows);

    const since = req.query?.since ? new Date(req.query.since) : null;
    const newCount = since && !isNaN(since)
      ? orders.filter(o => o.status === 'received' && new Date(o.paid_at || o.created_at) > since).length
      : 0;

    return res.status(200).json({
      now: new Date().toISOString(),
      new_since: newCount,
      print_agent_seen_at: settingsRes.rows[0]?.print_agent_seen_at || null,
      orders,
    });
  }

  if (req.method === 'PATCH') {
    const { id, status, reprint } = readJsonBody(req);
    if (!id) return res.status(400).json({ error: 'id required' });

    const cur = (await query('SELECT id, public_code, status FROM orders WHERE id = $1', [id])).rows[0];
    if (!cur) return res.status(404).json({ error: 'unknown order' });

    if (reprint === true) {
      if (!['received', 'cooking', 'ready'].includes(cur.status)) {
        return res.status(409).json({ error: `cannot print ${cur.public_code} while ${cur.status}` });
      }
      const r = await query(
        `UPDATE orders SET print_requested_at = now() WHERE id = $1 RETURNING print_requested_at`, [id]);
      await audit(admin.id, 'reprint', cur.public_code, null);
      return res.status(200).json({ ok: true, print_requested_at: r.rows[0].print_requested_at });
    }

    if (!status) return res.status(400).json({ error: 'id and status required' });
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const tokenOk = printTokenStatus(req);
  if (tokenOk === true) return printAgentHandler(req, res);
  if (tokenOk === false) return res.status(401).json({ error: 'bad print token' });
  return adminHandler(req, res);
}
