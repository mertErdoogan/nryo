export type ScoreFormat = 'points' | 'ms' | 'time' | 'strokes' | 'level';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat('en');

export function formatNumber(n: number): string {
  return grouped.format(Math.round(n));
}

/** 1.2K, 3.4M … for large incremental numbers. */
export function formatCompact(n: number): string {
  if (Math.abs(n) < 10_000) return formatNumber(n);
  return compact.format(n);
}

/** Formats a duration in seconds as m:ss (or m:ss.t when `tenths`). */
export function formatClock(seconds: number, tenths = false): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  if (tenths) {
    const whole = Math.floor(s);
    const t = Math.floor((s - whole) * 10);
    return `${m}:${String(whole).padStart(2, '0')}.${t}`;
  }
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

export function formatScore(value: number, format: ScoreFormat = 'points'): string {
  switch (format) {
    case 'ms':
      return `${Math.round(value)} ms`;
    case 'time':
      return formatClock(value / 1000, true);
    case 'strokes':
      return `${Math.round(value)} ${Math.round(value) === 1 ? 'stroke' : 'strokes'}`;
    case 'level':
      return `Lv ${Math.round(value)}`;
    default:
      return formatCompact(value);
  }
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
