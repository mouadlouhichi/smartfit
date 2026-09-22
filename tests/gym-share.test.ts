/**
 * Progress-share aggregates.
 *
 * These three numbers are the only training data that ever crosses the
 * member→gym boundary, so each is pinned: the month count is local-time (the
 * member's "this month", not UTC's), the streak is the same rest-day-aware
 * count the dashboard shows, and attendance ignores unmarked bookings instead
 * of quietly failing you for classes that have not happened yet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGymShareAggregates } from '../src/lib/gym-share';
import type { BookingStatus, FitnessState, WorkoutSession } from '@smartfit/core';

const NOW = Date.parse('2026-09-20T12:00:00Z');
const DAY = 86_400_000;

const session = (id: string, date: string): WorkoutSession => ({
  id,
  date,
  categoryId: 'cat-strength',
  title: 'Session',
  durationMin: 45,
  intensity: 'moderate',
  calories: 300,
  exercises: [],
  createdAt: NOW,
});

const state = (dates: string[]): Pick<FitnessState, 'sessions' | 'profile'> => ({
  sessions: dates.map((d, i) => session(`s${i}`, d)),
  profile: {
    name: 'Amina',
    weightUnit: 'kg',
    distanceUnit: 'km',
    weeklyRestDays: 2,
    weekStartsOn: 1,
    planId: 'ppl',
    onboardingDone: true,
  },
});

test('counts sessions in the current local month only', () => {
  const agg = computeGymShareAggregates(
    state(['2026-09-01', '2026-09-19', '2026-08-31', '2026-09-20']),
    [],
    NOW,
  );
  assert.equal(agg.sessionsThisMonth, 3);
});

test('an empty tracker shares honest zeros', () => {
  const agg = computeGymShareAggregates(state([]), [], NOW);
  assert.equal(agg.sessionsThisMonth, 0);
  assert.equal(agg.streakDays, 0);
  assert.equal(agg.attendancePct, 0);
});

test('the streak tolerates the planned rest days, like the dashboard', () => {
  // Trained 4 of the last 5 days with rest days allowed: streak 4, not 1.
  const agg = computeGymShareAggregates(
    state(['2026-09-20', '2026-09-19', '2026-09-18', '2026-09-16']),
    [],
    NOW,
  );
  assert.equal(agg.streakDays, 4);
});

test('attendance counts marked bookings only — upcoming ones do not fail you', () => {
  const agg = computeGymShareAggregates(
    state([]),
    ['attended', 'attended', 'no_show', 'booked', 'waitlist', 'cancelled'],
    NOW,
  );
  assert.equal(agg.attendancePct, 67); // 2 of 3 marked
});

test('no marked bookings means zero, not a division error', () => {
  const agg = computeGymShareAggregates(state([]), ['booked', 'waitlist'], NOW);
  assert.equal(agg.attendancePct, 0);
});

test('the aggregates map straight onto the share document', () => {
  const agg = computeGymShareAggregates(state(['2026-09-05']), ['attended'], NOW);
  assert.deepEqual(Object.keys(agg).sort(), ['attendancePct', 'sessionsThisMonth', 'streakDays']);
  assert.equal(typeof agg.streakDays, 'number');
  // The timestamp is the caller's business — a share doc adds sharedAt itself.
  assert.equal('sharedAt' in agg, false);
});
