import { WEEKDAYS } from '@smartfit/core';

/**
 * Pure date-calendar math behind `components/ui/date-picker.tsx`.
 *
 * Kept out of the component so the tricky parts — week-start offsets, month
 * pages, leap years, min/max bounds — are unit-tested without a DOM (see
 * `tests/date-picker.test.ts`). Everything works on ISO `yyyy-mm-dd` strings
 * and local `Date`s: parsing by hand avoids the UTC shift that
 * `new Date('2026-09-10')` would introduce.
 */

/** Parse an ISO `yyyy-mm-dd` into a local Date (never UTC-shifted). */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Strict `yyyy-mm-dd`: the shape must be right *and* the parts must be real —
 * `new Date(2026, 12, 40)` silently rolls over, so a round-trip comparison is
 * the only way to reject '2026-13-40' or '2026-02-30'.
 */
export function isIsoDate(iso: string): boolean {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = parseIsoDate(iso);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === iso;
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function startOfToday(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return toIsoDate(d);
}

export interface MonthPage {
  y: number;
  m: number; // 0-based, like Date#getMonth()
}

export function shiftMonth(page: MonthPage, delta: number): MonthPage {
  const total = page.y * 12 + page.m + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

export function monthOf(iso: string): MonthPage {
  const d = parseIsoDate(iso);
  return { y: d.getFullYear(), m: d.getMonth() };
}

/**
 * The month's day cells, padded with `null` so the grid always starts on the
 * configured week start and ends on a full week. Returns ISO dates for the
 * days of `year`/`month` only.
 */
export function calendarCells(year: number, month: number, weekStartsOn: 0 | 1): (string | null)[] {
  const lead = (new Date(year, month, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toIsoDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Weekday headers rotated so index 0 is the configured week start. */
export function weekdayHeader(weekStartsOn: 0 | 1): string[] {
  return [...WEEKDAYS.slice(weekStartsOn), ...WEEKDAYS.slice(0, weekStartsOn)];
}

/** Days after `max` (defaults to today) or before `min` cannot be picked. */
export function isDayDisabled(iso: string, opts: { max?: string; min?: string } = {}): boolean {
  const max = opts.max ?? startOfToday();
  return iso > max || (opts.min !== undefined && iso < opts.min);
}

/**
 * Trigger label: "Today" / "Yesterday" for those, else "Sep 10" (the year is
 * appended only when it isn't the current one). Short enough to never clip in
 * the narrow two-column cell of a phone dialog; the full date reaches screen
 * readers through the trigger's aria-label.
 */
export function formatTriggerDate(iso: string, now = new Date()): string {
  if (!isIsoDate(iso)) return 'Select a date';
  const today = startOfToday(now);
  if (iso === today) return 'Today';
  if (iso === addDaysIso(today, -1)) return 'Yesterday';
  if (iso === addDaysIso(today, 1)) return 'Tomorrow';

  const d = parseIsoDate(iso);
  const base = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** Full spoken date for the day buttons and the trigger's aria-label. */
export function longDateLabel(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
