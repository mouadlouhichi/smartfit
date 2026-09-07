import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerCoach,
  coachGreeting,
  COACH_QUICK_REPLIES,
  emptyState,
  toISODate,
} from '../src/index.ts';
import type { FitnessState, WorkoutSession } from '../src/index.ts';

function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function session(extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: Math.random().toString(36).slice(2),
    date: daysAgo(0),
    categoryId: 'cat-strength',
    title: 'Session',
    durationMin: 45,
    intensity: 'moderate',
    calories: 400,
    exercises: [],
    createdAt: Date.now(),
    ...extra,
  };
}

function trained(): FitnessState {
  const s = emptyState();
  s.profile.name = 'Alex';
  // Both today, so the assertions hold whichever weekday the suite runs on.
  s.sessions = [
    session({ categoryId: 'cat-strength', calories: 400 }),
    session({ categoryId: 'cat-cardio', calories: 200, distanceKm: 5 }),
  ];
  return s;
}

test('every quick reply produces a non-empty answer', () => {
  const state = trained();
  for (const q of COACH_QUICK_REPLIES) {
    const a = answerCoach(q, state);
    assert.ok(a.text.length > 20, `"${q}" should be answered substantively`);
  }
});

test('an empty account is told to log something first', () => {
  const a = answerCoach('how am I doing this week?', emptyState());
  assert.match(a.text, /haven't logged/i);
  assert.equal(a.chips, undefined);
});

test('calorie chips carry real percentages that sum to ~100', () => {
  const a = answerCoach('how many calories did I burn?', trained());
  assert.ok(a.chips && a.chips.length > 0, 'expected category chips');
  const total = a.chips!.reduce((acc, c) => acc + c.pct, 0);
  assert.ok(Math.abs(total - 100) <= 2, `chip percentages should sum to ~100, got ${total}`);
  for (const chip of a.chips!) {
    assert.ok(chip.pct >= 0 && chip.pct <= 100);
    assert.match(chip.value, /kcal/);
  }
});

test('calorie totals reflect the sessions actually logged', () => {
  const a = answerCoach('calories', trained());
  assert.match(a.text, /600 kcal/);
});

test('goal answers report real progress and clamp at 100', () => {
  const state = trained();
  state.goals = [
    {
      id: 'g1',
      name: 'Train 2x',
      metric: 'workouts',
      cadence: 'weekly',
      target: 2,
      startDate: daysAgo(7),
      createdAt: Date.now(),
    },
  ];
  const a = answerCoach('am I on track for my goals?', state);
  assert.match(a.text, /Train 2x/);
  assert.ok(a.chips?.[0]);
  assert.ok(a.chips![0].pct <= 100);
});

test('with no goals the coach says so rather than inventing one', () => {
  const a = answerCoach('am I on track for my goals?', trained());
  assert.match(a.text, /haven't set a goal/i);
});

test('today answers surface the scheduled slot and its completion', () => {
  const now = new Date();
  const state = trained();
  state.schedule = [
    {
      id: 'sch1',
      title: 'Push day',
      categoryId: 'cat-strength',
      weekday: now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      timeOfDay: '07:00',
      durationMin: 45,
      intensity: 'high',
      active: true,
      createdAt: Date.now(),
    },
  ];

  const pending = answerCoach('what should I train today?', state, now);
  assert.match(pending.text, /Push day/);

  state.sessions.unshift(session({ scheduleId: 'sch1' }));
  const done = answerCoach('what should I train today?', state, now);
  assert.match(done.text, /already logged/i);
});

test('the coach never claims features that do not exist', () => {
  const state = trained();
  const answers = [
    ...COACH_QUICK_REPLIES.map((q) => answerCoach(q, state).text),
    answerCoach('log water', state).text,
    answerCoach('how did I sleep?', state).text,
    answerCoach('something completely unrelated', state).text,
  ];
  for (const text of answers) {
    assert.doesNotMatch(text, /roadmap/i, 'must not advertise unbuilt features');
    assert.doesNotMatch(text, /hydration logging/i);
  }
});

test('unrecognised questions fall back to a weekly summary', () => {
  const a = answerCoach('what is the airspeed velocity of a swallow?', trained());
  assert.match(a.text, /week/i);
});

test('the coach is deterministic for the same inputs', () => {
  const state = trained();
  const now = new Date();
  assert.deepEqual(answerCoach('calories', state, now), answerCoach('calories', state, now));
});

test('greeting adapts to the time of day and uses the name', () => {
  const morning = coachGreeting('Alex', new Date(2026, 0, 1, 9));
  const evening = coachGreeting('Alex', new Date(2026, 0, 1, 20));
  assert.match(morning, /Good morning, Alex/);
  assert.match(evening, /Good evening, Alex/);
  assert.match(coachGreeting(undefined, new Date(2026, 0, 1, 9)), /Good morning!/);
});
