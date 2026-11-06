import { EPOCH, TIMEZONE } from '../config';

const DAY_MS = 86_400_000;

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** YYYY-MM-DD in Europe/Amsterdam. */
export function toDateKey(d: Date): string {
  const parts = dateFmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function utcMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from epoch to dateKey; negative before the epoch. */
export function dayIndex(dateKey: string, epoch: string = EPOCH): number {
  return Math.round((utcMs(dateKey) - utcMs(epoch)) / DAY_MS);
}

/** Anything before EPOCH becomes EPOCH. */
export function normalizeDateKey(dateKey: string): string {
  return dayIndex(dateKey) < 0 ? EPOCH : dateKey;
}

export function puzzleNumber(dateKey: string): number {
  return Math.max(0, dayIndex(dateKey)) + 1;
}

/** Milliseconds until midnight Amsterdam time (DST change days may be off by an hour). */
export function msUntilNextPuzzle(now: Date): number {
  const parts = timeFmt.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const h = get('hour');
  const m = get('minute');
  const s = get('second');
  return ((24 - h) * 3600 - m * 60 - s) * 1000;
}

export function addDays(dateKey: string, n: number): string {
  return new Date(utcMs(dateKey) + n * DAY_MS).toISOString().slice(0, 10);
}

/** True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-31). */
export function isValidDateKey(k: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(k) && addDays(k, 0) === k;
}

/** True when the (normalised) current day differs from the puzzle's day. */
export function isNewDay(puzzleKey: string, now: Date): boolean {
  return normalizeDateKey(toDateKey(now)) !== puzzleKey;
}
