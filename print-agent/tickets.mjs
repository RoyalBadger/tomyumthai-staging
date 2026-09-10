// Ticket formatting for Star TSP143 thermal printers (raw bytes over TCP port 9100).
// Pure functions, no I/O — tests/print-tickets.test.mjs exercises them.
//
// Two command profiles: "star" (Star Line Mode, the printer's default emulation) and
// "escpos" (if the printer is ever switched to ESC/POS mode in the Star utility).
// Paper 80mm, printable 72mm = 48 columns in font A on the TSP143.

export const PROFILES = {
  star: {
    init: [0x1b, 0x40],
    align: n => [0x1b, 0x1d, 0x61, n],          // 0 left, 1 center, 2 right
    size: (h, w) => [0x1b, 0x69, h, w],          // 0 = normal, 1 = double, ...
    bold: on => [0x1b, on ? 0x45 : 0x46],
    inverse: on => [0x1b, on ? 0x34 : 0x35],
    cut: [0x1b, 0x64, 0x03],                     // feed to cutter, partial cut
  },
  escpos: {
    init: [0x1b, 0x40],
    align: n => [0x1b, 0x61, n],
    size: (h, w) => [0x1d, 0x21, ((w & 7) << 4) | (h & 7)],
    bold: on => [0x1b, 0x45, on ? 1 : 0],
    inverse: on => [0x1d, 0x42, on ? 1 : 0],
    cut: [0x1d, 0x56, 0x42, 0x00],
  },
};

const DEFAULTS = { emulation: 'star', columns: 48, storeName: 'MY TOM YUM THAI', timeZone: 'America/Chicago' };

/** Thermal printers speak ASCII; strip accents/emoji rather than print garbage. */
export function ascii(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e\n]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function wrap(text, width) {
  const out = [];
  for (const para of ascii(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (!word) continue;
      if (word.length > width) {                 // hard-break a single overlong token
        if (line) { out.push(line); line = ''; }
        for (let i = 0; i < word.length; i += width) out.push(word.slice(i, i + width));
        continue;
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ' ' + word;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

export const dollars = cents => '$' + (Number(cents || 0) / 100).toFixed(2);

export function whenText(iso, timeZone) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

class Ticket {
  constructor(opts) {
    this.o = { ...DEFAULTS, ...opts };
    this.p = PROFILES[this.o.emulation] || PROFILES.star;
    this.buf = [...this.p.init];
    this.w = 0; // current width multiplier (0 = normal)
  }
  raw(bytes) { this.buf.push(...bytes); return this; }
  cols() { return Math.floor(this.o.columns / (this.w + 1)); }
  size(h, w) { this.w = w; return this.raw(this.p.size(h, w)); }
  bold(on) { return this.raw(this.p.bold(on)); }
  inverse(on) { return this.raw(this.p.inverse(on)); }
  align(n) { return this.raw(this.p.align(n)); }
  text(s) { for (const ch of ascii(s)) this.buf.push(ch.charCodeAt(0)); return this; }
  nl(n = 1) { for (let i = 0; i < n; i++) this.buf.push(0x0a); return this; }
  /** word-wrapped lines at the current size */
  line(s) { for (const l of wrap(s, this.cols())) this.text(l).nl(); return this; }
  center(s) { this.align(1).line(s); return this.align(0); }
  rule(ch = '-') { return this.text(ch.repeat(this.cols())).nl(); }
  /** label left, value right on one line */
  kv(label, value) {
    const c = this.cols();
    const l = ascii(label), v = ascii(value);
    const gap = Math.max(1, c - l.length - v.length);
    return this.text(l + ' '.repeat(gap) + v).nl();
  }
  /** big block: order code readable from across the kitchen */
  banner(s) {
    this.align(1).bold(true).size(2, 1).line(s).size(0, 0).bold(false);
    return this.align(0);
  }
  cut() { return this.nl(2).raw(this.p.cut); }
  bytes() { return Buffer.from(this.buf); }
}

function itemLines(t, items) {
  for (const it of items) {
    const name = `${it.qty} x ${it.name}${it.size_label ? ` (${it.size_label})` : ''}`;
    t.bold(true).size(1, 0).line(name).size(0, 0).bold(false);
    const detail = [
      it.variant, it.protein,
      it.spice_level ? `SPICE LV ${it.spice_level}` : '',
      it.extras && it.extras.length ? '+' + it.extras.join(', +') : '',
    ].filter(Boolean).join(' - ');
    if (detail) t.line('   ' + detail);
    if (it.exclusions) {
      t.bold(true).size(1, 1).line(`*** ${String(it.exclusions).toUpperCase()} ***`).size(0, 0).bold(false);
    }
    if (it.notes) t.line('   NOTE: ' + it.notes);
  }
}

function header(t, o, opts) {
  t.banner(o.public_code);
  t.align(1).bold(true).size(1, 1).line(o.order_type.toUpperCase()).size(0, 0).bold(false).align(0);
  t.center(whenText(o.created_at, opts.timeZone));
}

/** Customer receipt for the counter printer. */
export function buildReceipt(o, opts = {}) {
  const t = new Ticket(opts);
  t.align(1).bold(true).size(1, 1).line(t.o.storeName).size(0, 0).bold(false).align(0);
  header(t, o, t.o);
  t.rule('=');
  t.bold(true).line(o.customer_name).bold(false);
  if (o.customer_phone) t.line(o.customer_phone);
  if (o.order_type === 'delivery' && o.delivery_address) {
    t.line('DELIVER TO: ' + o.delivery_address);
    if (o.delivery_notes) t.line('   ' + o.delivery_notes);
  }
  t.rule('=');
  itemLines(t, o.items || []);
  t.rule('-');
  t.kv('Subtotal', dollars(o.subtotal_cents - (o.discount_cents || 0)));
  if (o.discount_cents) t.kv(`  (promo ${o.promo_code || ''} applied)`, '-' + dollars(o.discount_cents));
  if (o.delivery_fee_cents) t.kv('Delivery fee', dollars(o.delivery_fee_cents));
  t.kv('Tax', dollars(o.tax_cents));
  t.bold(true).size(1, 0).kv('TOTAL', dollars(o.total_cents)).size(0, 0).bold(false);
  t.center('PAID ONLINE');
  t.nl().center('Thank you!');
  return t.cut().bytes();
}

/** Kitchen tickets, one per station that has items; empty stations are skipped. */
export function buildKitchenTickets(o, opts = {}) {
  const stations = [
    { station: 'second', label: '** CHEF 2 **', items: (o.items || []).filter(it => it.station === 'second') },
    { station: 'main', label: '** MAIN KITCHEN **', items: (o.items || []).filter(it => it.station !== 'second') },
  ];
  return stations.filter(s => s.items.length).map(s => {
    const t = new Ticket(opts);
    t.align(1).inverse(true).bold(true).size(1, 1).line(` ${s.label} `).size(0, 0).bold(false).inverse(false).align(0);
    header(t, o, t.o);
    t.rule('=');
    itemLines(t, s.items);
    t.rule('=');
    t.bold(true).line(o.customer_name).bold(false);
    return { station: s.station, label: s.label, bytes: t.cut().bytes() };
  });
}

export function buildTestTicket(label, opts = {}) {
  const t = new Ticket(opts);
  t.banner('TEST');
  t.center(`${t.o.storeName} print agent`);
  t.center(label);
  t.center(whenText(new Date().toISOString(), t.o.timeZone));
  t.rule('=');
  t.line('If you can read this, the agent can reach this printer.');
  t.size(1, 0).line('Double height').size(0, 0);
  t.size(1, 1).line('Double both').size(0, 0);
  t.bold(true).line('Bold').bold(false);
  t.rule('=');
  return t.cut().bytes();
}
