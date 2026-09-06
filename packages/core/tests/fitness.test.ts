import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSeedState,
  emptyState,
  aggregate,
  currentStreak,
  estimateCalories,
  getPlan,
  goalProgress,
  metricValue,
  thisWeek,
  toISODate,
  weekKey,
  weeklySeries,
} from '../src/index.ts';
import type { WorkoutSession } from '../src/index.ts';

function mk(
  partial: Partial<WorkoutSession> & Pick<WorkoutSession, 'date' | 'categoryId'>,
): WorkoutSession {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Session',
    durationMin: 30,
    intensity: 'moderate',
    calories: 210,
    exercises: [],
    createdAt: Date.now(),
    ...partial,
  };
}

test('estimateCalories scales with duration and intensity', () => {
  assert.ok(estimateCalories(60, 'high') > estimateCalories(30, 'high'));
  assert.ok(estimateCalories(30, 'high') > estimateCalories(30, 'low'));
  assert.equal(estimateCalories(0, 'high'), 0);
});

test('aggregate sums volume across sessions', () => {
  const agg = aggregate([
    mk({ date: '2026-01-01', categoryId: 'c', durationMin: 20, calories: 140, distanceKm: 3 }),
    mk({ date: '2026-01-02', categoryId: 'c', durationMin: 40, calories: 280, distanceKm: 2.5 }),
  ]);
  assert.equal(agg.workouts, 2);
  assert.equal(agg.minutes, 60);
  assert.equal(agg.calories, 420);
  assert.equal(agg.distance, 5.5);
});

test('metricValue maps each goal metric', () => {
  const sessions = [mk({ date: '2026-01-01', categoryId: 'c', durationMin: 30, calories: 210, distanceKm: 4 })];
  assert.equal(metricValue(sessions, 'workouts'), 1);
  assert.equal(metricValue(sessions, 'minutes'), 30);
  assert.equal(metricValue(sessions, 'calories'), 210);
  assert.equal(metricValue(sessions, 'distance'), 4);
});

test('weeklySeries returns 8 buckets ordered oldest-first', () => {
  const state = buildSeedState();
  const series = weeklySeries(state, 8);
  assert.equal(series.length, 8);
  assert.ok(series[0].key <= series[7].key);
  assert.equal(series[7].key, thisWeek(state).key);
});

test('seed state has volume and the expected plan', () => {
  const state = buildSeedState();
  assert.ok(currentStreak(state) >= 0);
  assert.ok(state.sessions.length > 20);
  assert.equal(getPlan(state.profile.planId).sessionsPerWeek, 6);
});

test('goalProgress clamps percentage at 100 and flags done', () => {
  const state = emptyState();
  const goal = { metric: 'workouts' as const, cadence: 'weekly' as const, target: 2 };
  assert.equal(goalProgress(state, goal).pct, 0);
  assert.equal(goalProgress(state, goal).done, false);

  const today = new Date();
  state.sessions.push(
    mk({ date: toISODate(today), categoryId: 'c' }),
    mk({ date: toISODate(today), categoryId: 'c' }),
    mk({ date: toISODate(today), categoryId: 'c' }),
  );
  const p2 = goalProgress(state, goal);
  assert.equal(p2.pct, 100);
  assert.equal(p2.done, true);
  assert.equal(p2.current, 3);
});

test('weekKey groups same-week dates together', () => {
  assert.equal(weekKey('2026-09-06'), weekKey('2026-09-07'));
  assert.notEqual(weekKey('2026-09-06'), weekKey('2026-09-14'));
});
