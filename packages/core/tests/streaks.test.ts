import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentStreak,
  weeklyStreak,
  daysSinceLastSession,
  categoryBreakdown,
  categoryUsage,
  todaysAgenda,
  emptyState,
  toISODate,
  UNKNOWN_CATEGORY,
} from '../src/index.ts';
import type { FitnessState, WorkoutSession } from '../src/index.ts';

function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function session(date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s_${date}_${Math.random().toString(36).slice(2, 7)}`,
    date,
    categoryId: 'cat-strength',
    title: 'Session',
    durationMin: 45,
    intensity: 'moderate',
    calories: 350,
    exercises: [],
    createdAt: Date.now(),
    ...extra,
  };
}

function stateWith(dates: string[], restDays = 2): FitnessState {
  const s = emptyState();
  s.profile.weeklyRestDays = restDays;
  s.sessions = dates.map((d) => session(d));
  return s;
}

// ── streaks ─────────────────────────────────────────────────────────────

test('currentStreak tolerates planned rest days', () => {
  // Trained today, 2 days ago and 4 days ago: gaps of one rest day each.
  const s = stateWith([daysAgo(0), daysAgo(2), daysAgo(4)], 2);
  assert.equal(currentStreak(s), 3);
});

test('currentStreak breaks once the gap exceeds the rest allowance', () => {
  // One rest day allowed, but there is a three-day hole before today.
  const s = stateWith([daysAgo(0), daysAgo(4), daysAgo(5)], 1);
  assert.equal(currentStreak(s), 1);
});

test('currentStreak survives a not-yet-trained today', () => {
  const s = stateWith([daysAgo(1), daysAgo(2)], 0);
  assert.equal(currentStreak(s), 2);
});

test('currentStreak is zero with no sessions', () => {
  assert.equal(currentStreak(emptyState()), 0);
});

test('weeklyStreak counts consecutive weeks that hit the target', () => {
  const s = emptyState();
  s.goals = [
    {
      id: 'g1',
      name: 'Train weekly',
      metric: 'workouts',
      cadence: 'weekly',
      target: 2,
      startDate: daysAgo(30),
      createdAt: Date.now(),
    },
  ];
  // Two sessions in each of the last three weeks.
  s.sessions = [0, 1, 7, 8, 14, 15].map((n) => session(daysAgo(n)));
  assert.ok(weeklyStreak(s) >= 2, 'at least the two completed prior weeks count');
});

test('weeklyStreak does not punish an incomplete current week', () => {
  const s = emptyState();
  s.goals = [
    {
      id: 'g1',
      name: 'Train weekly',
      metric: 'workouts',
      cadence: 'weekly',
      target: 5,
      startDate: daysAgo(30),
      createdAt: Date.now(),
    },
  ];
  s.sessions = [];
  assert.equal(weeklyStreak(s), 0);
});

test('daysSinceLastSession reports the gap', () => {
  assert.equal(daysSinceLastSession(stateWith([daysAgo(3)])), 3);
  assert.equal(daysSinceLastSession(emptyState()), null);
});

// ── category breakdown ──────────────────────────────────────────────────

test('categoryBreakdown keeps minutes from deleted activity types', () => {
  const s = emptyState();
  s.sessions = [
    session(daysAgo(1), { categoryId: 'cat-strength', durationMin: 60 }),
    session(daysAgo(1), { categoryId: 'cat-deleted', durationMin: 30 }),
  ];
  const rows = categoryBreakdown(s);
  const total = rows.reduce((a, r) => a + r.minutes, 0);
  assert.equal(total, 90, 'no minutes may be silently dropped');
  assert.ok(rows.some((r) => r.category.id === UNKNOWN_CATEGORY.id));
});

test('categoryUsage counts sessions and scheduled slots', () => {
  const s = emptyState();
  s.sessions = [session(daysAgo(1), { categoryId: 'cat-cardio' })];
  s.schedule = [
    {
      id: 'sch1',
      title: 'Run',
      categoryId: 'cat-cardio',
      weekday: 3,
      timeOfDay: '07:00',
      durationMin: 40,
      intensity: 'moderate',
      active: true,
      createdAt: Date.now(),
    },
  ];
  assert.equal(categoryUsage(s, 'cat-cardio'), 2);
  assert.equal(categoryUsage(s, 'cat-hiit'), 0);
});

// ── plan <-> log bridge ─────────────────────────────────────────────────

test('todaysAgenda marks a scheduled slot as done once logged', () => {
  const now = new Date();
  const s = emptyState();
  s.schedule = [
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

  const before = todaysAgenda(s, now);
  assert.equal(before.length, 1);
  assert.equal(before[0].done, null);

  s.sessions = [session(toISODate(now), { scheduleId: 'sch1' })];
  const after = todaysAgenda(s, now);
  assert.ok(after[0].done, 'logging against the slot marks it complete');
});

test('todaysAgenda ignores inactive slots', () => {
  const now = new Date();
  const s = emptyState();
  s.schedule = [
    {
      id: 'sch1',
      title: 'Off',
      categoryId: 'cat-strength',
      weekday: now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      timeOfDay: '07:00',
      durationMin: 45,
      intensity: 'high',
      active: false,
      createdAt: Date.now(),
    },
  ];
  assert.equal(todaysAgenda(s, now).length, 0);
});
