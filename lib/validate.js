// Input validation helpers for customer-facing endpoints.

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX) or return null. */
export function normalizePhoneUS(input) {
  const digits = String(input || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10 || ten[0] === '0' || ten[0] === '1') return null;
  return `+1${ten}`;
}

/** Trimmed 1..80 char name or null. */
export function cleanName(input) {
  const s = String(input || '').trim().replace(/\s+/g, ' ');
  return s.length >= 1 && s.length <= 80 ? s : null;
}

/** Trimmed 1..200 char single-line text or null (for addresses/notes). */
export function cleanLine(input, max = 200) {
  const s = String(input || '').trim().replace(/[\r\n]+/g, ', ');
  return s.length >= 1 && s.length <= max ? s : null;
}
