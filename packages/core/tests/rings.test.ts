import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestStreak,
  dayRings,
  emptyState,
  ringsHistory,
  startOfWeek,
  streakStats,
  targetsForDays,
  toISODate,
} from '../src/index.ts';
import type { FitnessState, WorkoutSession } from '../src/index.ts';

function iso(offsetDays: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function session(
  offsetDays: number,
  minutes = 120,
  calories = 900,
  id = `s${offsetDays}`,
): WorkoutSession {
  return {
    id,
    date: iso(offsetDays),
    title: 'Session',
    categoryId: 'cat-strength',
    durationMin: minutes,
    intensity: 'moderate',
    calories,
    createdAt: Date.now(),
    exercises: [],
  };
}

function stateWith(sessions: WorkoutSession[], weeklyRestDays = 1): FitnessState {
  const s = emptyState();
  s.profile.weeklyRestDays = weeklyRestDays;
  s.sessions = sessions;
  return s;
}

test('dayRings: an empty day is three open rings, never "closed"', () => {
  const rings = dayRings(stateWith([]), iso(0));
  assert.equal(rings.closed, false);
  assert.equal(rings.minutes.pct, 0);
  assert.equal(rings.showedUp.pct, 0);
});

test('dayRings close when the day meets the daily targets', () => {
  const state = stateWith([session(0)]);
  const daily = targetsForDays(state, 1);
  const rings = dayRings(state, iso(0));
  assert.equal(rings.showedUp.pct, 100);
  assert.ok(daily.minutes > 0);
  assert.equal(rings.minutes.pct, 100, 'a 120-minute session clears the daily minute target');
  assert.equal(rings.closed, true);
});

test('dayRings are strictly daily — yesterday does not leak into today', () => {
  const state = stateWith([session(-1)]);
  assert.equal(dayRings(state, iso(0)).showedUp.pct, 0);
  assert.equal(dayRings(state, iso(-1)).showedUp.pct, 100);
});

test('ringsHistory returns oldest-first days ending today', () => {
  const history = ringsHistory(stateWith([]), 7);
  assert.equal(history.length, 7);
  assert.equal(history[6].date, iso(0));
  assert.equal(history[0].date, iso(-6));
});

test('bestStreak tolerates planned rest days but not long gaps', () => {
  // Three days in a row, then a 2-day gap (<= 1 rest day? no: gap of 2 calendar
  // days between training days = 1 rest day) keeps the run alive.
  const run = [session(0, 30, 100, 'a'), session(-1, 30, 100, 'b'), session(-3, 30, 100, 'c')];
  assert.equal(bestStreak(stateWith(run, 1)), 3);
  // A 6-day hole (5 rest days > 1 allowed) splits the history.
  const split = [session(0, 30, 100, 'a'), session(-8, 30, 100, 'b')];
  assert.equal(bestStreak(stateWith(split, 1)), 1);
});

test('streakStats: an unfinished today never breaks the ring run', () => {
  // Rings closed yesterday and the day before; today still open.
  const state = stateWith([session(-1), session(-2)]);
  const stats = streakStats(state);
  assert.equal(stats.ringStreak, 2);
  assert.equal(stats.daysClosedLast7, 2);
  assert.equal(stats.current, 2);
});

test('streakStats counts finished weeks that hit the workout target', () => {
  const weekly = targetsForDays(stateWith([]), 7).workouts;
  const sessions: WorkoutSession[] = [];
  // Fill two complete past weeks (week-aligned, Monday start) with exactly the
  // target number of sessions; every other week stays empty.
  const start = startOfWeek(new Date(), 1);
  for (let w = 1; w <= 2; w++) {
    for (let d = 0; d < weekly; d++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() - w * 7 + d);
      sessions.push({ ...session(0, 30, 100, `w${w}-${d}`), date: toISODate(dt) });
    }
  }
  const stats = streakStats(stateWith(sessions));
  assert.equal(stats.weeksOnTarget, 2);
  assert.equal(stats.weeksChecked, 8);
  assert.ok(stats.best >= weekly);
});
