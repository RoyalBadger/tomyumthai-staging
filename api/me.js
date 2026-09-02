// Customer portal — ONE consolidated function (Vercel Hobby 12-function cap):
//   POST   {action:'start',  phone}        — text a 6-digit code (Twilio Verify)
//   POST   {action:'verify', phone, code}  — check code -> sign in (180d cookie)
//   GET                                    — who am I: saved profile
//   GET    ?orders=1                       — my order history (paid orders, by phone)
//   PATCH  {name?, email?, address?}       — update saved info
//   DELETE                                 — log out
import { query } from '../lib/db.js';
import { rateLimit, clientIp, readJsonBody } from '../lib/auth.js';
import { normalizePhoneUS, cleanName, cleanLine, cleanEmail } from '../lib/validate.js';
import {
  verifyStart, verifyCheck, createCustomerSession, getSessionCustomer,
  destroyCustomerSession, setCustomerCookie, clearCustomerCookie,
} from '../lib/customer-auth.js';

const profile = c => ({
  name: c.name, phone: c.phone_e164, email: c.email, address: c.default_address,
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'POST') {
      const body = readJsonBody(req);
      const phone = normalizePhoneUS(body.phone);
      if (!phone) return res.status(400).json({ error: 'Please enter a valid 10-digit US phone number.' });
      const ip = clientIp(req);

      if (body.action === 'start') {
        const okPhone = await rateLimit(`otp:phone:${phone}`, 3, 600);
        const okIp = await rateLimit(`otp:ip:${ip}`, 6, 600);
        if (!okPhone || !okIp) return res.status(429).json({ error: 'Too many codes requested — please wait a few minutes.' });
        await verifyStart(phone);
        return res.status(200).json({ ok: true });
      }

      if (body.action === 'verify') {
        if (!/^[0-9]{4,8}$/.test(String(body.code || ''))) {
          return res.status(400).json({ error: 'Please enter the 6-digit code from the text message.' });
        }
        const okTry = await rateLimit(`otpcheck:phone:${phone}`, 6, 600);
        if (!okTry) return res.status(429).json({ error: 'Too many attempts — please request a new code in a few minutes.' });
        const approved = await verifyCheck(phone, body.code);
        if (!approved) return res.status(400).json({ error: 'That code is not right — please check the text and try again.' });

        const cust = (await query(
          `INSERT INTO customers (phone_e164, verified_at, last_seen)
           VALUES ($1, now(), now())
           ON CONFLICT (phone_e164) DO UPDATE SET verified_at = now(), last_seen = now()
           RETURNING id, phone_e164, name, email, default_address`,
          [phone])).rows[0];
        const token = await createCustomerSession(cust.id);
        setCustomerCookie(res, token);
        return res.status(200).json({ ok: true, customer: profile(cust) });
      }

      return res.status(400).json({ error: 'unknown action' });
    }

    if (req.method === 'GET') {
      const cust = await getSessionCustomer(req);
      if (!cust) return res.status(401).json({ error: 'not signed in' });

      if (req.query?.orders) {
        const orders = (await query(
          `SELECT id, public_code, order_type, status, total_cents, created_at
           FROM orders
           WHERE customer_phone = $1 AND status <> 'pending_payment'
           ORDER BY created_at DESC LIMIT 20`,
          [cust.phone_e164])).rows;
        let items = [];
        if (orders.length) {
          items = (await query(
            `SELECT order_id, item_id, name, size_label, protein, extras, spice_level,
                    exclusions, notes, qty
             FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY id`,
            [orders.map(o => o.id)])).rows;
        }
        const byOrder = {};
        for (const it of items) (byOrder[it.order_id] ??= []).push(it);
        return res.status(200).json({
          orders: orders.map(o => ({
            code: o.public_code, type: o.order_type, status: o.status,
            total_cents: o.total_cents, created_at: o.created_at,
            items: byOrder[o.id] || [],
          })),
        });
      }
      return res.status(200).json({ customer: profile(cust) });
    }

    if (req.method === 'PATCH') {
      const cust = await getSessionCustomer(req);
      if (!cust) return res.status(401).json({ error: 'not signed in' });
      const body = readJsonBody(req);
      const name = body.name !== undefined ? (cleanName(body.name) || null) : cust.name;
      const email = body.email !== undefined ? (cleanEmail(body.email) || null) : cust.email;
      const address = body.address !== undefined ? (cleanLine(body.address) || null) : cust.default_address;
      const r = await query(
        `UPDATE customers SET name = $2, email = $3, default_address = $4 WHERE id = $1
         RETURNING id, phone_e164, name, email, default_address`,
        [cust.id, name, email, address]);
      return res.status(200).json({ ok: true, customer: profile(r.rows[0]) });
    }

    if (req.method === 'DELETE') {
      await destroyCustomerSession(req);
      clearCustomerCookie(res);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    console.error('me endpoint error', e);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
}
