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

export function closedMessage(reason) {
  switch (reason) {
    case 'closing_soon': return 'The kitchen is closing soon — online ordering has stopped for today. Please call (214) 703-0391.';
    case 'before_open': return "We're not open yet — online ordering starts when the kitchen opens.";
    case 'closed_today':
    case 'closed_now':
    default: return "We're closed right now. See our hours below — come back soon!";
  }
}
