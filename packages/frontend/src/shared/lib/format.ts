const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function timeAgo(input?: string | Date) {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '—';
  const diff = (d.getTime() - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
    [Infinity, 'year']
  ];
  const divisors = [1, 60, 3600, 86400, 604800, 2629800, 31557600];
  for (let i = 0; i < steps.length; i++) {
    if (Math.abs(diff) < steps[i][0]) {
      return rtf.format(Math.round(diff / divisors[i]), steps[i][1]);
    }
  }
  return d.toLocaleDateString();
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(name?: string) {
  return (name || '').trim().split(/\s+/)[0] || 'there';
}

// local calendar day key (toISOString would shift days across UTC)
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Builds a GitHub-style activity grid (weeks × 7 days) from a list of timestamps.
export function activityGrid(timestamps: (string | undefined)[], weeks = 20) {
  const counts = new Map<string, number>();
  for (const t of timestamps) {
    if (!t) continue;
    const key = dayKey(new Date(t));
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  // align to the Sunday that starts the first column
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);

  const days: { date: string; count: number }[] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    days.push({ date: key, count: counts.get(key) || 0 });
  }

  // current streak counts back from today (or yesterday if nothing yet today)
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else if (i === days.length - 1) continue;
    else break;
  }

  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  const total = days.reduce((s, d) => s + d.count, 0);
  const columns: { date: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  return { columns, total, streak, longest };
}
