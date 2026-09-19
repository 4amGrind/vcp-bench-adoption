import { PARK } from './config';

// All dates in this app are plain "YYYY-MM-DD" strings.
// We never use local time zones for date math, so results are the same on every server.

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidYmd(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = YMD.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtc(s: string): Date {
  const m = YMD.exec(s);
  if (!m) throw new Error(`Bad date: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** Today's date in the park's time zone. "Today" must not depend on where the server runs. */
export function todayInNewYork(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PARK.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(s: string, n: number): string {
  const dt = toUtc(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fmt(dt);
}

/** Adds whole months. If the day does not exist in the new month, it snaps to the last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(s: string, months: number): string {
  const dt = toUtc(s);
  const total = dt.getUTCFullYear() * 12 + dt.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(year, month, Math.min(dt.getUTCDate(), lastDay))));
}

/** An adoption that starts on `start` and lasts `months` months ends the day before the anniversary. */
export function endDateForTerm(start: string, months: number): string {
  return addDays(addMonths(start, months), -1);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

export function formatLong(s: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(toUtc(s));
}

export function formatTerm(months: number): string {
  if (months % 12 === 0) {
    const y = months / 12;
    return `${y} ${y === 1 ? 'year' : 'years'}`;
  }
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

/** Accepts 2026-09-19 or spreadsheet style 9/19/2026. Returns null if it is not a real date. */
export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (isValidYmd(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const iso = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return isValidYmd(iso) ? iso : null;
  }
  return null;
}
