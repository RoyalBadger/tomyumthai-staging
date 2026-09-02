// Opportunistic housekeeping, fired (not awaited) after successful order
// creation — the Hobby-plan function cap leaves no room for a cron endpoint.
// Self-throttles via the rate_limits table to at most a few runs per day.
import { query } from './db.js';
import { rateLimit } from './auth.js';

const PII_RETENTION_DAYS = 90;   // completed/canceled orders older than this lose direct identifiers
const CANCELED_PURGE_DAYS = 30;  // never-paid canceled orders older than this are deleted outright

export async function runMaintenance() {
  // rateLimit returns true while under the cap: allow at most 4 runs/day.
  if (!(await rateLimit('maintenance:daily', 4, 86_400))) return;

  // 1. Cancel stale unpaid orders (abandoned checkouts).
  await query(
    `UPDATE orders SET status = 'canceled', updated_at = now()
     WHERE status = 'pending_payment' AND created_at < now() - interval '24 hours'`, []);

  // 2. Delete never-paid canceled orders outright (order_items cascade away).
  //    Paid-then-canceled orders are kept — they are refund records.
  await query(
    `DELETE FROM orders
     WHERE status = 'canceled' AND paid_at IS NULL
       AND created_at < now() - interval '${CANCELED_PURGE_DAYS} days'`, []);

  // 3. PII scrub: old orders keep items and totals (history, reporting) but lose
  //    name/phone/email/address. customer_id survives, so a signed-in customer's
  //    own order history keeps working; a leaked database exposes at most
  //    PII_RETENTION_DAYS of guest contact details instead of the site's lifetime.
  await query(
    `UPDATE orders SET customer_name = NULL, customer_phone = NULL, customer_email = NULL,
       delivery_address = NULL, delivery_notes = NULL, pii_scrubbed_at = now(), updated_at = now()
     WHERE status IN ('completed','canceled') AND pii_scrubbed_at IS NULL
       AND created_at < now() - interval '${PII_RETENTION_DAYS} days'`, []);

  // 4. Stale rate-limit counters. 45 days is safely past the longest window in
  //    use (the 32-day monthly Google cap) so no live counter is ever reset.
  await query(`DELETE FROM rate_limits WHERE window_start < now() - interval '45 days'`, []);
}
