// POST /api/orders — create a prepaid order.
// Body: {order_type, promo_code?, customer:{name, phone}, delivery?:{address, notes?},
//        items:[{id, size_label?, protein?, extras?, spice_level?, exclusions?, notes?, qty}]}
// Server recomputes ALL money (lib/pricing.js), creates the order as pending_payment,
// creates a Stripe PaymentIntent, and returns {client_secret, publishable_key, order_code, totals}.
// The order reaches the kitchen ONLY after the webhook confirms payment.
import { query, getPool } from '../lib/db.js';
import { loadPricingContext, priceCart, CartError } from '../lib/pricing.js';
import { orderingWindow, closedMessage } from '../lib/hours.js';
import { rateLimit, clientIp, readJsonBody } from '../lib/auth.js';
import { stripeFetch, PUBLISHABLE_KEY, StripeError } from '../lib/stripe.js';
import { normalizePhoneUS, cleanName, cleanLine, cleanEmail } from '../lib/validate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const ip = clientIp(req);
  if (!(await rateLimit(`orders:ip:${ip}`, 10, 600))) {
    return res.status(429).json({ error: 'Too many order attempts — please wait a few minutes or call us.' });
  }

  const body = readJsonBody(req);

  // --- store open? ---
  const st = (await query(
    `SELECT store_open_override, closed_message, holiday_dates, business_hours,
            last_order_buffer_minutes, pickup_eta_minutes, delivery_eta_minutes
     FROM settings`, [])).rows[0];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  const holidayToday = (st.holiday_dates || []).some(d => new Date(d).toISOString().slice(0, 10) === today);
  const win = orderingWindow(st.business_hours, st.last_order_buffer_minutes);
  if (st.store_open_override === 'closed' || holidayToday || !win.open) {
    const message = st.store_open_override === 'closed' || holidayToday
      ? (st.closed_message || 'Online ordering is paused right now — please call us at (214) 703-0391.')
      : closedMessage(win.reason);
    return res.status(409).json({ error: message });
  }

  // --- contact info ---
  const name = cleanName(body.customer?.name);
  const phone = normalizePhoneUS(body.customer?.phone);
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!phone) return res.status(400).json({ error: 'Please enter a valid 10-digit US phone number.' });
  const smsOptIn = body.customer?.sms_opt_in === true;
  const email = cleanEmail(body.customer?.email);
  if (String(body.customer?.email || '').trim() && !email) {
    return res.status(400).json({ error: 'Please enter a valid email address, or leave it blank.' });
  }
  let address = null, deliveryNotes = null;
  if (body.order_type === 'delivery') {
    address = cleanLine(body.delivery?.address);
    if (!address) return res.status(400).json({ error: 'Please enter a delivery address.' });
    deliveryNotes = cleanLine(body.delivery?.notes) || null;
  }

  // --- price it (throws CartError with a customer-safe message) ---
  let priced;
  try {
    const ctx = await loadPricingContext(body.promo_code);
    priced = priceCart({ order_type: body.order_type, promo_code: body.promo_code, items: body.items }, ctx);
  } catch (e) {
    if (e instanceof CartError) return res.status(400).json({ error: e.message });
    console.error('pricing error', e);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
  if (priced.total_cents < 50) return res.status(400).json({ error: 'Order total is below the card minimum.' });

  // --- create order + items in a transaction ---
  const pool = getPool();
  const client = await pool.connect();
  let order;
  try {
    await client.query('BEGIN');
    const year = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' });
    const seq = (await client.query("SELECT nextval('order_code_seq') AS n")).rows[0].n;
    const code = `TYT-${year}-${String(seq).padStart(4, '0')}`;
    order = (await client.query(
      `INSERT INTO orders (public_code, order_type, status, customer_name, customer_phone,
         customer_email, sms_opt_in, delivery_address, delivery_notes, subtotal_cents, discount_cents,
         tax_cents, delivery_fee_cents, total_cents, promo_code)
       VALUES ($1,$2,'pending_payment',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, public_code`,
      [code, body.order_type, name, phone, email, smsOptIn, address, deliveryNotes,
       priced.subtotal_cents, priced.discount_cents, priced.tax_cents,
       priced.delivery_fee_cents, priced.total_cents, priced.promo_code])).rows[0];
    for (const l of priced.lines) {
      await client.query(
        `INSERT INTO order_items (order_id, item_id, name, size_label, protein, extras,
           spice_level, exclusions, notes, unit_price_cents, qty, station)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [order.id, l.item_id, l.name, l.size_label, l.protein, l.extras,
         l.spice_level, l.exclusions, l.notes, l.unit_price_cents, l.qty, l.station || 'main']);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('order insert error', e);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  } finally {
    client.release();
  }

  // --- Stripe PaymentIntent (idempotent on order id) ---
  let intent;
  try {
    intent = await stripeFetch('POST', '/v1/payment_intents', {
      amount: priced.total_cents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: `Tom Yum Thai ${order.public_code} (${body.order_type})`,
      metadata: { order_id: order.id, order_code: order.public_code },
      ...(email ? { receipt_email: email } : {}),
    }, { idempotencyKey: `pi-${order.id}` });
    await query('UPDATE orders SET stripe_payment_intent = $2, updated_at = now() WHERE id = $1',
      [order.id, intent.id]);
  } catch (e) {
    console.error('stripe error', e instanceof StripeError ? `${e.status} ${e.code} ${e.message}` : e);
    await query("UPDATE orders SET status = 'canceled', updated_at = now() WHERE id = $1", [order.id]);
    return res.status(502).json({ error: 'Card processing is unavailable right now — please call us at (214) 703-0391.' });
  }

  // opportunistic cleanup of stale unpaid orders
  query(`UPDATE orders SET status = 'canceled', updated_at = now()
         WHERE status = 'pending_payment' AND created_at < now() - interval '24 hours'`, []).catch(() => {});

  res.status(200).json({
    order_code: order.public_code,
    client_secret: intent.client_secret,
    publishable_key: PUBLISHABLE_KEY,
    eta_minutes: body.order_type === 'delivery' ? st.delivery_eta_minutes : st.pickup_eta_minutes,
    totals: {
      subtotal_cents: priced.subtotal_cents,
      discount_cents: priced.discount_cents,
      delivery_fee_cents: priced.delivery_fee_cents,
      tax_cents: priced.tax_cents,
      total_cents: priced.total_cents,
      promo_code: priced.promo_code,
    },
  });
}
