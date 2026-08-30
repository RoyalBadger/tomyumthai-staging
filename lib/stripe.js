// Minimal Stripe REST client (no SDK dependency). Form-encodes params per Stripe's API,
// authenticates with STRIPE_SECRET_KEY, supports idempotency keys.
// Webhook authenticity is established by RE-FETCHING objects from Stripe's API by id
// (an attacker cannot forge what api.stripe.com returns), so no raw-body signature
// handling is required in the serverless runtime.

export const PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY
  || 'pk_test_51UAGQG5VuFOBJIsBaKxnzZzpOimFfbmPStZCZhYZVyACVq9cqUCXkeMCYcy1ti3A7Sb5XDKCDQEBhimuf2HVg4D80078mONOJV';

/** Stripe-style application/x-www-form-urlencoded encoding with nested keys. */
export function formEncode(obj, prefix = '') {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') parts.push(formEncode(item, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === 'object') {
      parts.push(formEncode(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

export class StripeError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `stripe error ${status}`);
    this.name = 'StripeError';
    this.status = status;
    this.code = body?.error?.code;
  }
}

export async function stripeFetch(method, path, params, { idempotencyKey } = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : formEncode(params || {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new StripeError(res.status, body);
  return body;
}
