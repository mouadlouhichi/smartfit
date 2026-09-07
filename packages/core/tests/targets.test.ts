import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  targetsForDays,
  weeklyTargets,
  ASSUMED_SESSION_MIN,
  getPlan,
} from '../src/index.ts';
import type { FitnessGoal, FitnessState } from '../src/index.ts';

function goal(partial: Partial<FitnessGoal>): FitnessGoal {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Goal',
    metric: 'workouts',
    cadence: 'weekly',
    target: 5,
    startDate: '2026-01-01',
    createdAt: Date.now(),
    ...partial,
  };
}

function withGoals(goals: FitnessGoal[], planId = 'full-body'): FitnessState {
  const s = emptyState();
  return { ...s, profile: { ...s.profile, planId }, goals };
}

test('targets fall back to the training plan when no goals exist', () => {
  const state = withGoals([], 'ppl');
  const plan = getPlan('ppl');
  const t = weeklyTargets(state);

  assert.equal(t.workouts, plan.sessionsPerWeek);
  assert.equal(t.minutes, plan.sessionsPerWeek * ASSUMED_SESSION_MIN);
  assert.equal(t.fromGoals, false, 'nothing came from a user goal');
});

test("a user's weekly goal overrides the plan default", () => {
  const state = withGoals([goal({ metric: 'workouts', target: 2 })], 'ppl');
  const t = weeklyTargets(state);

  assert.equal(t.workouts, 2, 'the goal wins over the plan’s 6×/week');
  assert.equal(t.minutes, 2 * ASSUMED_SESSION_MIN, 'minutes derive from the goal');
  assert.equal(t.fromGoals, true);
});

test('an explicit minutes goal is used verbatim', () => {
  const state = withGoals([goal({ metric: 'minutes', target: 210 })]);
  assert.equal(weeklyTargets(state).minutes, 210);
});

test('monthly goals are scaled down to a week', () => {
  const state = withGoals([goal({ metric: 'workouts', cadence: 'monthly', target: 20 })]);
  const t = weeklyTargets(state);
  // 20 per 30 days ≈ 4.67/week -> rounds to 5.
  assert.equal(t.workouts, 5);
  assert.equal(t.fromGoals, true);
});

test('targets scale with the window and never fall below a usable floor', () => {
  const state = withGoals([goal({ metric: 'workouts', target: 7 })]);

  assert.equal(targetsForDays(state, 7).workouts, 7);
  assert.equal(targetsForDays(state, 1).workouts, 1, 'one session a day');
  assert.equal(targetsForDays(state, 30).workouts, 30);

  // A tiny weekly goal must still produce a target of at least 1 for a day.
  const light = withGoals([goal({ metric: 'workouts', target: 2 })]);
  assert.equal(targetsForDays(light, 1).workouts, 1);
  assert.ok(targetsForDays(light, 1).minutes >= 10);
});

test('calorie and distance targets stay at zero unless the user set one', () => {
  const none = weeklyTargets(withGoals([]));
  assert.equal(none.calories, 0);
  assert.equal(none.distanceKm, 0);

  const set = weeklyTargets(withGoals([goal({ metric: 'distance', target: 20 })]));
  assert.equal(set.distanceKm, 20);
  assert.equal(set.fromGoals, true);
});
