// RFC 6238 TOTP (SHA-1, 6 digits, 30s step) using only node:crypto. Tested against
// the RFC test vectors in tests/totp.test.mjs.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20)); // 160-bit, standard for SHA-1 TOTP
}

function hotp(secretBuf, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secretBuf).update(msg).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

/** Verify a 6-digit code, accepting +/-1 time step (90s tolerance total). */
export function verifyTotp(secretBase32, code, { now = Date.now(), step = 30, window = 1 } = {}) {
  const cleaned = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const secretBuf = base32Decode(secretBase32);
  const counter = Math.floor(now / 1000 / step);
  const target = Buffer.from(cleaned);
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(hotp(secretBuf, counter + i));
    if (candidate.length === target.length && timingSafeEqual(candidate, target)) return true;
  }
  return false;
}

export function otpauthUri(email, secretBase32) {
  const issuer = encodeURIComponent('Tom Yum Thai');
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
