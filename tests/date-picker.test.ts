import { test } from 'node:test';
import assert from 'assert/strict';
import {
  addDaysIso,
  calendarCells,
  formatTriggerDate,
  isDayDisabled,
  isIsoDate,
  longDateLabel,
  monthOf,
  parseIsoDate,
  shiftMonth,
  startOfToday,
  toIsoDate,
  weekdayHeader,
} from '../src/lib/date-picker.ts';

/**
 * The custom date picker replaced `<input type="date">` in the log modals.
 * Its math is the risky part: week-start offsets, leap years, month pages and
 * the no-future-dates bound. These tests run without a DOM.
 */

test('ISO parsing never shifts the day across time zones', () => {
  const d = parseIsoDate('2026-01-01');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 0);
  assert.equal(d.getDate(), 1);
  assert.equal(toIsoDate(d), '2026-01-01');
  // A naive new Date('2026-01-01') is UTC midnight, i.e. the previous day in
  // negative-offset zones — that class of bug must not come back.
  assert.equal(parseIsoDate('2026-12-31').getDate(), 31);
});

test('isIsoDate rejects empty, malformed and impossible dates', () => {
  assert.equal(isIsoDate('2026-09-10'), true);
  assert.equal(isIsoDate(''), false);
  assert.equal(isIsoDate('2026-9-10'), false);
  assert.equal(isIsoDate('10/09/2026'), false);
  assert.equal(isIsoDate('not a date'), false);
  // Out-of-range parts must not silently roll over into the next month/year.
  assert.equal(isIsoDate('2026-13-01'), false);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2027-02-29'), false); // 2027 is not a leap year
  assert.equal(isIsoDate('2028-02-29'), true);
});

test('calendarCells pads to full weeks and respects the week start', () => {
  // September 2026 starts on a Tuesday (Sep 1) and has 30 days.
  const mondayFirst = calendarCells(2026, 8, 1);
  assert.equal(mondayFirst[0], null); // Mon Aug 31 slot
  assert.equal(mondayFirst[1], '2026-09-01');
  assert.equal(mondayFirst.filter(Boolean).length, 30);
  assert.equal(mondayFirst.length % 7, 0);

  const sundayFirst = calendarCells(2026, 8, 0);
  assert.equal(sundayFirst[0], null); // Sun Aug 30
  assert.equal(sundayFirst[1], null); // Mon Aug 31
  assert.equal(sundayFirst[2], '2026-09-01');
  assert.equal(sundayFirst.filter(Boolean).length, 30);
  assert.equal(sundayFirst.length % 7, 0);
});

test('calendarCells handles February in leap and non-leap years', () => {
  assert.equal(calendarCells(2026, 1, 1).filter(Boolean).length, 28);
  assert.equal(calendarCells(2028, 1, 1).filter(Boolean).length, 29); // leap
  assert.equal(calendarCells(2100, 1, 1).filter(Boolean).length, 28); // century rule
});

test('weekdayHeader rotates the shared WEEKDAYS to the week start', () => {
  assert.deepEqual(weekdayHeader(0), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.deepEqual(weekdayHeader(1), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('shiftMonth crosses year boundaries in both directions', () => {
  assert.deepEqual(shiftMonth({ y: 2026, m: 0 }, -1), { y: 2025, m: 11 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 11 }, 1), { y: 2027, m: 0 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 5 }, -18), { y: 2024, m: 11 });
  assert.deepEqual(monthOf('2026-09-10'), { y: 2026, m: 8 });
});

test('addDaysIso steps across months and years', () => {
  assert.equal(addDaysIso('2026-09-01', -1), '2026-08-31');
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysIso('2028-02-28', 1), '2028-02-29');
});

test('future dates are disabled by default, bounds are inclusive', () => {
  const today = startOfToday();
  assert.equal(isDayDisabled(today), false);
  assert.equal(isDayDisabled(addDaysIso(today, 1)), true);
  assert.equal(isDayDisabled(addDaysIso(today, -1)), false);
  // Explicit max in the past disables everything after it.
  assert.equal(isDayDisabled('2026-03-11', { max: '2026-03-10' }), true);
  assert.equal(isDayDisabled('2026-03-10', { max: '2026-03-10' }), false);
  // min blocks earlier days.
  assert.equal(isDayDisabled('2026-03-09', { max: '2026-03-10', min: '2026-03-10' }), true);
});

test('trigger labels read Today / Yesterday / Tomorrow, else a short date', () => {
  const now = new Date(2026, 8, 10, 14, 0, 0); // local Sep 10 2026
  assert.equal(formatTriggerDate('2026-09-10', now), 'Today');
  assert.equal(formatTriggerDate('2026-09-09', now), 'Yesterday');
  assert.equal(formatTriggerDate('2026-09-11', now), 'Tomorrow');
  const older = formatTriggerDate('2026-09-01', now);
  assert.notEqual(older, 'Today');
  assert.match(older, /1/); // day number present
  assert.doesNotMatch(older, /2026/); // same year → no year suffix
  assert.match(formatTriggerDate('2024-09-01', now), /2024/); // other year → suffixed
  assert.equal(formatTriggerDate('', now), 'Select a date');
  assert.equal(formatTriggerDate('2026-13-40', now), 'Select a date');
});

test('longDateLabel spells the full date for screen readers', () => {
  const label = longDateLabel('2026-09-10');
  assert.match(label, /2026/);
  assert.match(label, /10/);
  // Weekday and month names are locale-formatted but never numeric-only.
  assert.ok(label.split(',').length >= 2);
});
