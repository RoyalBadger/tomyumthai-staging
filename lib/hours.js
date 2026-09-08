// Business-hours logic. All times America/Chicago; hours come from settings.business_hours
// as { "0".."6": [["HH:MM","HH:MM"], ...] } with 0=Sunday.

const TZ = 'America/Chicago';

export function chicagoNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = t => parts.find(p => p.type === t)?.value;
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { weekday: weekdayIndex, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMin = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * @returns {{open: boolean, reason: 'open'|'before_open'|'closed_now'|'closing_soon'|'closed_today'}}
 * `open` means: accepting NEW orders now (closing buffer applied).
 */
export function orderingWindow(businessHours, bufferMinutes = 0, date = new Date()) {
  const { weekday, minutes } = chicagoNow(date);
  const ranges = (businessHours?.[String(weekday)] || []).map(([a, b]) => [toMin(a), toMin(b)]);
  if (ranges.length === 0) return { open: false, reason: 'closed_today' };
  for (const [start, end] of ranges) {
    if (minutes >= start && minutes < end) {
      if (minutes >= end - bufferMinutes) return { open: false, reason: 'closing_soon' };
      return { open: true, reason: 'open' };
    }
  }
  const opensLater = ranges.some(([start]) => minutes < start);
  return { open: false, reason: opensLater ? 'before_open' : 'closed_now' };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt12 = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * The next time online ordering opens, searching up to 14 days ahead and skipping
 * holiday dates (YYYY-MM-DD). Customers may fill a cart while closed and check out then.
 * @returns {{day_offset:number, weekday:number, time:string, label:string}|null}
 *   label reads "today at 5:00 PM", "tomorrow at 11:00 AM", or "Tuesday at 5:00 PM".
 */
export function nextOpening(businessHours, holidays = [], date = new Date()) {
  const { weekday, minutes } = chicagoNow(date);
  const todayStr = date.toLocaleDateString('en-CA', { timeZone: TZ });
  const holidaySet = new Set((holidays || []).map(d => new Date(d).toISOString().slice(0, 10)));
  for (let d = 0; d < 14; d++) {
    const dayStr = new Date(Date.parse(todayStr + 'T12:00:00Z') + d * 86_400_000).toISOString().slice(0, 10);
    if (holidaySet.has(dayStr)) continue;
    const wd = (weekday + d) % 7;
    const starts = (businessHours?.[String(wd)] || []).map(([a]) => a).filter(a => d > 0 || toMin(a) > minutes)
      .sort((a, b) => toMin(a) - toMin(b));
    if (!starts.length) continue;
    const when = d === 0 ? 'today' : d === 1 ? 'tomorrow' : DAY_NAMES[wd];
    return { day_offset: d, weekday: wd, time: starts[0], label: `${when} at ${fmt12(starts[0])}` };
  }
  return null;
}

export function closedMessage(reason) {
  switch (reason) {
    case 'closing_soon': return 'The kitchen is closing soon — online ordering has stopped for today. Please call (214) 703-0391.';
    case 'before_open': return "We're not open yet — online ordering starts when the kitchen opens.";
    case 'closed_today':
    case 'closed_now':
    default: return "We're closed right now. See our hours below — come back soon!";
  }
}
