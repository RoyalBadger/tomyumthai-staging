// Cash payout preparation. Session verification and persistence belong to callers.
// Payout approval is an owner-only action; ordinary managers handle daily service.

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is out of range`);
  }
}

/** Reimburse a whole percentage of a receipt, rounded to the nearest cent. */
export function payoutCents(receipt_cents, percent) {
  integer(receipt_cents, 1, 200_000, 'receipt_cents');
  integer(percent, 1, 100, 'percent');
  return Math.floor(receipt_cents * percent / 100);
}

/**
 * recordPayout receives the approved record and must persist it atomically.
 * admin is a trusted, already-verified session, never a client request body.
 * Each invocation is a separate approval; callers handle request deduplication.
 */
export function createCashPayoutService({ recordPayout }) {
  if (typeof recordPayout !== 'function') throw new TypeError('recordPayout is required');

  return {
    async approve(admin, { receipt_cents, percent, reason }) {
      if (!admin || typeof admin.id !== 'string' || !admin.id.trim()) {
        throw Object.assign(new Error('Sign in required'), { status: 401 });
      }
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 200) {
        throw new TypeError('A reason of 1 to 200 characters is required');
      }
      const record = Object.freeze({
        approved_by: admin.id,
        receipt_cents,
        percent,
        amount_cents: payoutCents(receipt_cents, percent),
        reason: reason.trim(),
      });
      await recordPayout(record);
      return record;
    },
  };
}
