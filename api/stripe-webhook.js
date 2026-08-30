// POST /api/stripe-webhook — configure in Stripe Dashboard for payment_intent.succeeded
// (payment_intent.payment_failed optional).
// AUTHENTICITY MODEL: we never trust the webhook payload. We take only the payment_intent
// id from it and RE-FETCH the object from api.stripe.com with our secret key; a forged id
// simply won't exist / won't match an order + amount. This avoids raw-body signature
// handling entirely and is idempotent (only pending_payment -> received transitions).
import { query } from '../lib/db.js';
import { stripeFetch } from '../lib/stripe.js';
import { readJsonBody } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const event = readJsonBody(req);
  const piId = event?.data?.object?.object === 'payment_intent' ? event.data.object.id : null;
  if (!piId || !/^pi_[A-Za-z0-9]+$/.test(piId)) return res.status(200).json({ ignored: true });

  let pi;
  try {
    pi = await stripeFetch('GET', `/v1/payment_intents/${piId}`);
  } catch (e) {
    // Unknown/forged id or Stripe hiccup: 200 for 404s (nothing to do), 500 to make Stripe retry otherwise.
    if (e.status === 404) return res.status(200).json({ ignored: true });
    console.error('webhook stripe fetch error', e.message);
    return res.status(500).json({ error: 'retry' });
  }

  if (pi.status !== 'succeeded') return res.status(200).json({ ignored: true, status: pi.status });
  const orderId = pi.metadata?.order_id;
  if (!orderId) return res.status(200).json({ ignored: true });

  try {
    const r = await query(
      `UPDATE orders SET status = 'received', paid_at = now(), updated_at = now()
       WHERE id = $1 AND stripe_payment_intent = $2 AND total_cents = $3
         AND status = 'pending_payment'
       RETURNING public_code`,
      [orderId, pi.id, pi.amount]);
    if (r.rows[0]) console.log(`order ${r.rows[0].public_code} paid -> received`);
    return res.status(200).json({ ok: true, updated: r.rowCount });
  } catch (e) {
    console.error('webhook db error', e);
    return res.status(500).json({ error: 'retry' });
  }
}
