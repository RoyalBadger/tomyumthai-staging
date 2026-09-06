// GET  /api/admin/settings — store controls; ?requests=1 lists change requests
// POST /api/admin/settings — {subject, details}: file a site/design change request for the web admin
// PATCH /api/admin/settings — {request_id, status:'done'|'declined'|'open'} resolves a request, or:
// PATCH /api/admin/settings — {store_open_override?, delivery_paused?, closed_message?,
//                              holiday_dates?, last_order_buffer_minutes?,
//                              pickup_eta_minutes?, delivery_eta_minutes?}
import { query } from '../../lib/db.js';
import { requireAdmin, audit, readJsonBody } from '../../lib/auth.js';

export default requireAdmin(async (req, res, admin) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET' && req.query?.requests) {
    const r = await query(
      `SELECT r.id, r.subject, r.details, r.status, r.created_at, r.resolved_at, a.email AS by_email
       FROM change_requests r LEFT JOIN admin_users a ON a.id = r.admin_id
       ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 200`, []);
    return res.status(200).json({ requests: r.rows });
  }

  if (req.method === 'POST') {
    const body = readJsonBody(req);
    const subject = String(body.subject || '').trim().slice(0, 120);
    const details = String(body.details || '').trim().slice(0, 2000) || null;
    if (!subject) return res.status(400).json({ error: 'Give the request a short title.' });
    const r = await query(
      'INSERT INTO change_requests (admin_id, subject, details) VALUES ($1,$2,$3) RETURNING id, subject, details, status, created_at',
      [admin.id, subject, details]);
    await audit(admin.id, 'change_request', String(r.rows[0].id), { subject });
    // Optional outbound notification (e.g. a Power Automate / Zapier "HTTP request received"
    // flow that emails the web admin). Silent if unset or unreachable.
    if (process.env.CHANGE_REQUEST_WEBHOOK) {
      try {
        await fetch(process.env.CHANGE_REQUEST_WEBHOOK, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.rows[0].id, subject, details, by: admin.email, site: 'Tom Yum Thai ordering' }),
          signal: AbortSignal.timeout(4000),
        });
      } catch { /* notification is best-effort */ }
    }
    return res.status(200).json({ ok: true, request: r.rows[0] });
  }

  if (req.method === 'GET') {
    // one-row table; SELECT * tolerates a column whose migration hasn't run yet
    const r = await query('SELECT * FROM settings', []);
    return res.status(200).json(r.rows[0]);
  }

  if (req.method === 'PATCH') {
    const body = readJsonBody(req);
    if (body.request_id !== undefined) {
      const status = String(body.status || '');
      if (!['open', 'done', 'declined'].includes(status)) return res.status(400).json({ error: 'status must be open, done, or declined' });
      const r = await query(
        `UPDATE change_requests SET status = $2, resolved_at = CASE WHEN $2 = 'open' THEN NULL ELSE now() END
         WHERE id = $1 RETURNING id, subject, status, resolved_at`, [Number(body.request_id), status]);
      if (!r.rows[0]) return res.status(404).json({ error: 'unknown request' });
      await audit(admin.id, 'change_request_status', String(r.rows[0].id), { status });
      return res.status(200).json({ ok: true, request: r.rows[0] });
    }
    const sets = [];
    const vals = [];
    const changes = {};
    const push = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); changes[col] = val; };

    if (body.store_open_override !== undefined) {
      if (!['auto', 'closed', 'open'].includes(body.store_open_override)) {
        return res.status(400).json({ error: "store_open_override must be 'auto', 'closed', or 'open'" });
      }
      push('store_open_override', body.store_open_override);
    }
    if (body.delivery_paused !== undefined) {
      if (typeof body.delivery_paused !== 'boolean') {
        return res.status(400).json({ error: 'delivery_paused must be true or false' });
      }
      push('delivery_paused', body.delivery_paused);
    }
    if (body.closed_message !== undefined) {
      push('closed_message', body.closed_message === null ? null : String(body.closed_message).slice(0, 300));
    }
    if (body.holiday_dates !== undefined) {
      if (!Array.isArray(body.holiday_dates) || !body.holiday_dates.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d))) {
        return res.status(400).json({ error: 'holiday_dates must be an array of YYYY-MM-DD strings' });
      }
      push('holiday_dates', body.holiday_dates);
    }
    if (body.last_order_buffer_minutes !== undefined) {
      const n = Number(body.last_order_buffer_minutes);
      if (!Number.isInteger(n) || n < 0 || n > 120) return res.status(400).json({ error: 'buffer must be 0..120 minutes' });
      push('last_order_buffer_minutes', n);
    }
    for (const col of ['pickup_eta_minutes', 'delivery_eta_minutes']) {
      if (body[col] !== undefined) {
        if (!/^\d{1,3}(-\d{1,3})?$/.test(String(body[col]))) return res.status(400).json({ error: `${col} must look like '15-20'` });
        push(col, String(body[col]));
      }
    }
    for (const col of ['delivery_fee_cents', 'delivery_minimum_cents']) {
      if (body[col] !== undefined) {
        const n = Number(body[col]);
        if (!Number.isInteger(n) || n < 0 || n > 20_000) return res.status(400).json({ error: `${col} must be an integer 0..20000` });
        push(col, n);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });

    await query(`UPDATE settings SET ${sets.join(', ')}`, vals);
    await audit(admin.id, 'settings_update', null, changes);
    const r = await query('SELECT store_open_override, closed_message, holiday_dates, last_order_buffer_minutes, pickup_eta_minutes, delivery_eta_minutes, delivery_paused FROM settings', []);
    return res.status(200).json({ ok: true, settings: r.rows[0] });
  }

  res.status(405).json({ error: 'method not allowed' });
});
