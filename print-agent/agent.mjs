// TYT print agent — runs on the restaurant PC, prints every paid order automatically.
//
//   node agent.mjs          poll the ordering server forever (installed as a scheduled task)
//   node agent.mjs test     print a test ticket on both printers, then exit
//   node agent.mjs once     one poll cycle, then exit
//
// Flow per order: receipt -> counter printer, CHEF 2 + MAIN KITCHEN tickets -> kitchen
// printer, then PATCH {printed:true} so the server stops offering it. Partial progress is
// kept in state.json so a printer outage never double-prints the half that succeeded.
// Config: config.json next to this file (see config.example.json), or TYT_PRINT_CONFIG=path.
import net from 'node:net';
import { readFileSync, writeFileSync, appendFileSync, statSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReceipt, buildKitchenTickets, buildTestTicket } from './tickets.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = process.env.TYT_PRINT_CONFIG || join(here, 'config.json');
const statePath = join(here, 'state.json');
const logPath = join(here, 'agent.log');

// --- config ------------------------------------------------------------------
function loadConfig() {
  if (!existsSync(configPath)) {
    console.error(`No config at ${configPath}. Copy config.example.json to config.json and fill it in.`);
    process.exit(2);
  }
  const c = JSON.parse(readFileSync(configPath, 'utf8'));
  const missing = ['server', 'token', 'printers'].filter(k => !c[k]);
  if (missing.length) { console.error(`config.json missing: ${missing.join(', ')}`); process.exit(2); }
  if (!c.printers.kitchen) { console.error('config.json: printers.kitchen is required'); process.exit(2); }
  return {
    port: 9100,
    pollSeconds: 4,
    receipt: 'all',            // all | pickup | delivery | none
    kitchenCopies: 1,
    emulation: 'star',
    columns: 48,
    storeName: 'MY TOM YUM THAI',
    timeZone: 'America/Chicago',
    ...c,
    server: String(c.server).replace(/\/+$/, ''),
  };
}
const cfg = loadConfig();
const fmt = { emulation: cfg.emulation, columns: cfg.columns, storeName: cfg.storeName, timeZone: cfg.timeZone };

// --- logging -----------------------------------------------------------------
function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.join(' ')}`;
  console.log(line);
  try {
    if (existsSync(logPath) && statSync(logPath).size > 5_000_000) renameSync(logPath, logPath + '.1');
    appendFileSync(logPath, line + '\n');
  } catch { /* logging must never take the agent down */ }
}

// --- state (partial-print memory) --------------------------------------------
function loadState() {
  try { return JSON.parse(readFileSync(statePath, 'utf8')); } catch { return {}; }
}
function saveState(s) {
  try { writeFileSync(statePath, JSON.stringify(s)); } catch (e) { log('state save failed:', e.message); }
}

// --- printer I/O -------------------------------------------------------------
export function sendToPrinter(host, port, bytes, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    let done = false;
    const finish = err => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sock.destroy();
      err ? reject(err) : resolve();
    };
    const timer = setTimeout(() => finish(new Error(`timeout talking to ${host}:${port}`)), timeoutMs);
    sock.on('error', e => finish(new Error(`${host}:${port} ${e.message}`)));
    sock.on('connect', () => {
      sock.end(bytes, () => {
        // Star printers keep the socket open; give the buffer a moment to flush, then close.
        setTimeout(() => finish(), 400);
      });
    });
  });
}

// --- server I/O --------------------------------------------------------------
async function serverFetch(path, init = {}) {
  const res = await fetch(cfg.server + path, {
    ...init,
    headers: { 'x-print-token': cfg.token, 'content-type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`server ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const wantsReceipt = o => cfg.receipt === 'all' || cfg.receipt === o.order_type;

// --- one order ---------------------------------------------------------------
async function printOrder(o, state) {
  const key = `${o.id}:${o.print_requested_at || ''}`;
  const st = state[key] || {};
  const jobs = [];

  if (wantsReceipt(o) && cfg.printers.counter && !st.receipt) {
    jobs.push(sendToPrinter(cfg.printers.counter, cfg.port, buildReceipt(o, fmt))
      .then(() => { st.receipt = Date.now(); log(`${o.public_code} receipt -> counter`); }));
  }
  if (!st.kitchen) {
    const tickets = buildKitchenTickets(o, fmt);
    const chunks = [];
    for (let i = 0; i < cfg.kitchenCopies; i++) for (const t of tickets) chunks.push(t.bytes);
    if (chunks.length) {
      jobs.push(sendToPrinter(cfg.printers.kitchen, cfg.port, Buffer.concat(chunks))
        .then(() => { st.kitchen = Date.now(); log(`${o.public_code} ${tickets.map(t => t.label).join(' + ')} -> kitchen`); }));
    } else {
      st.kitchen = Date.now(); // nothing to print for the kitchen (should not happen)
    }
  }

  const results = await Promise.allSettled(jobs);
  state[key] = st;
  saveState(state);
  const failed = results.filter(r => r.status === 'rejected');
  for (const f of failed) log(`${o.public_code} PRINT FAILED: ${f.reason.message}`);
  if (failed.length) return false;

  await serverFetch('/api/admin/orders', { method: 'PATCH', body: JSON.stringify({ id: o.id, printed: true }) });
  delete state[key];
  saveState(state);
  return true;
}

// --- poll loop ---------------------------------------------------------------
let backoff = 0;
async function cycle() {
  const state = loadState();
  const data = await serverFetch('/api/admin/orders?printer=1');
  for (const o of data.orders) {
    try { await printOrder(o, state); }
    catch (e) { log(`${o.public_code} error: ${e.message}`); }
  }
  return data.orders.length;
}

async function loop() {
  try {
    await cycle();
    backoff = 0;
  } catch (e) {
    backoff = Math.min(60, backoff ? backoff * 2 : 5);
    log(`poll error: ${e.message} (retry in ${backoff}s)`);
  }
  setTimeout(loop, (backoff || cfg.pollSeconds) * 1000);
}

// --- entry -------------------------------------------------------------------
const mode = process.argv[2] || 'run';
if (mode === 'test') {
  const targets = Object.entries(cfg.printers).filter(([, ip]) => ip);
  for (const [name, ip] of targets) {
    try {
      await sendToPrinter(ip, cfg.port, buildTestTicket(`${name.toUpperCase()} printer ${ip}`, fmt));
      log(`test ticket -> ${name} (${ip}) OK`);
    } catch (e) { log(`test ticket -> ${name} (${ip}) FAILED: ${e.message}`); process.exitCode = 1; }
  }
  try {
    const d = await serverFetch('/api/admin/orders?printer=1');
    log(`server OK, ${d.orders.length} order(s) waiting`);
  } catch (e) { log(`server check FAILED: ${e.message}`); process.exitCode = 1; }
} else if (mode === 'once') {
  log(`printed/checked ${await cycle()} order(s)`);
} else {
  log(`print agent starting: server=${cfg.server} counter=${cfg.printers.counter || '(none)'} kitchen=${cfg.printers.kitchen} receipt=${cfg.receipt}`);
  loop();
}
