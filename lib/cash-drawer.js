// Cash drawer command service. One instance represents one open drawer.
// Callers provide verified staff sessions and an atomic entry append adapter.

function integer(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} is out of range`);
  }
}

function requireStaff(session) {
  if (!session || typeof session.id !== 'string' || !session.id.trim()) {
    throw Object.assign(new Error('Sign in required'), { status: 401 });
  }
  if (!['owner', 'manager', 'server'].includes(session.role)) {
    throw Object.assign(new Error('Staff access required'), { status: 403 });
  }
}

/** Tax is rounded to the nearest cent, with half cents rounded up. */
export function cashSaleTotal(subtotal_cents, tax_rate_bps) {
  integer(subtotal_cents, 1, 200_000, 'subtotal_cents');
  integer(tax_rate_bps, 0, 10_000, 'tax_rate_bps');
  const tax_cents = Math.floor(subtotal_cents * tax_rate_bps / 10_000);
  return { subtotal_cents, tax_cents, total_cents: subtotal_cents + tax_cents };
}

/**
 * appendEntry(entry) commits one immutable entry or rejects without a write.
 * Completed operations are retained for this instance's lifetime.
 * This service is independent of HTTP and database connection management.
 */
export function createCashDrawer({ appendEntry, tax_rate_bps = 825 }) {
  if (typeof appendEntry !== 'function') throw new TypeError('appendEntry is required');
  integer(tax_rate_bps, 0, 10_000, 'tax_rate_bps');
  let rate = tax_rate_bps;
  const completed = new Map();

  return {
    // Managers and owners configure the rate used by subsequent sales.
    setTaxRate(session, next_rate_bps) {
      requireStaff(session);
      integer(next_rate_bps, 0, 10_000, 'tax_rate_bps');
      rate = next_rate_bps;
      return { tax_rate_bps: rate };
    },

    async recordSale(session, { operation_id, subtotal_cents }) {
      requireStaff(session);
      if (typeof operation_id !== 'string' || !operation_id.trim() || operation_id.length > 100) {
        throw new TypeError('operation_id must contain 1 to 100 characters');
      }
      integer(subtotal_cents, 1, 200_000, 'subtotal_cents');
      const previous = completed.get(operation_id);
      if (previous) {
        if (previous.subtotal_cents !== subtotal_cents || previous.recorded_by !== session.id) {
          throw Object.assign(new Error('Operation already used for another sale'), { status: 409 });
        }
        return previous;
      }
      const entry = Object.freeze({
        operation_id,
        recorded_by: session.id,
        tax_rate_bps: rate,
        ...cashSaleTotal(subtotal_cents, rate),
      });
      await appendEntry(entry);
      completed.set(operation_id, entry);
      return entry;
    },
  };
}
