import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  parseState,
  parseStateJSON,
  isEmptyState,
  DEFAULT_CATEGORIES,
} from '../src/index.ts';

test('parseState returns a usable state for garbage input', () => {
  for (const junk of [null, undefined, 42, 'nope', [], true]) {
    const s = parseState(junk);
    assert.equal(s.sessions.length, 0);
    assert.equal(s.profile.planId, 'full-body');
    assert.ok(s.categories.length > 0);
  }
});

test('parseState drops unrepairable records but keeps good ones', () => {
  const s = parseState({
    sessions: [
      { id: 'ok', date: '2026-01-02', categoryId: 'cat-strength', durationMin: 45 },
      { id: 'no-date', categoryId: 'cat-strength' },
      { date: '2026-01-03' }, // no id
      'not an object',
      null,
    ],
  });
  assert.equal(s.sessions.length, 1);
  assert.equal(s.sessions[0].id, 'ok');
});

test('parseState coerces out-of-range and wrong-typed fields', () => {
  const s = parseState({
    profile: {
      name: 42,
      weightUnit: 'stone',
      distanceUnit: 'parsec',
      weeklyRestDays: 99,
      weekStartsOn: 5,
      planId: 'made-up',
      onboardingDone: 'yes',
    },
    sessions: [
      {
        id: 'a',
        date: '2026-01-02',
        durationMin: '30',
        calories: -100,
        intensity: 'nuclear',
        distanceKm: 'abc',
      },
    ],
  });
  assert.equal(s.profile.name, '');
  assert.equal(s.profile.weightUnit, 'kg');
  assert.equal(s.profile.distanceUnit, 'km');
  assert.equal(s.profile.weeklyRestDays, 6);
  assert.equal(s.profile.weekStartsOn, 1);
  assert.equal(s.profile.planId, 'full-body');
  assert.equal(s.profile.onboardingDone, false);

  assert.equal(s.sessions[0].durationMin, 30);
  assert.equal(s.sessions[0].calories, 0);
  assert.equal(s.sessions[0].intensity, 'moderate');
  assert.equal(s.sessions[0].distanceKm, undefined);
});

test('parseState restores missing built-in categories', () => {
  const s = parseState({ categories: [] });
  for (const def of DEFAULT_CATEGORIES) {
    assert.ok(
      s.categories.some((c) => c.id === def.id),
      `${def.id} restored`,
    );
  }
});

test('parseState keeps custom categories alongside built-ins', () => {
  const s = parseState({
    categories: [{ id: 'cat-custom', name: 'Climbing', icon: 'activity', color: '#123456' }],
  });
  assert.ok(s.categories.some((c) => c.id === 'cat-custom'));
  assert.ok(s.categories.length > DEFAULT_CATEGORIES.length - 1);
});

test('parseState de-duplicates records sharing an id', () => {
  const s = parseState({
    goals: [
      {
        id: 'g',
        name: 'First',
        metric: 'workouts',
        cadence: 'weekly',
        target: 3,
        startDate: '2026-01-01',
      },
      {
        id: 'g',
        name: 'Duplicate',
        metric: 'workouts',
        cadence: 'weekly',
        target: 9,
        startDate: '2026-01-01',
      },
    ],
  });
  assert.equal(s.goals.length, 1);
  assert.equal(s.goals[0].name, 'First');
});

test('parseState sorts sessions newest-first', () => {
  const s = parseState({
    sessions: [
      { id: 'old', date: '2026-01-01', categoryId: 'c' },
      { id: 'new', date: '2026-03-01', categoryId: 'c' },
      { id: 'mid', date: '2026-02-01', categoryId: 'c' },
    ],
  });
  assert.deepEqual(
    s.sessions.map((x) => x.id),
    ['new', 'mid', 'old'],
  );
});

test('parseState keeps only well-formed exercises', () => {
  const s = parseState({
    sessions: [
      {
        id: 'a',
        date: '2026-01-02',
        categoryId: 'c',
        exercises: [
          { name: 'Squat', sets: [{ reps: 5, weight: 100 }, 'junk'] },
          { name: '   ' },
          null,
        ],
      },
    ],
  });
  assert.equal(s.sessions[0].exercises.length, 1);
  assert.equal(s.sessions[0].exercises[0].name, 'Squat');
  assert.equal(s.sessions[0].exercises[0].sets.length, 1);
});

test('parseStateJSON survives malformed JSON', () => {
  assert.equal(parseStateJSON('{ not json'), null);
  assert.equal(parseStateJSON(null), null);
  assert.equal(parseStateJSON(''), null);
  const ok = parseStateJSON(JSON.stringify(emptyState()));
  assert.ok(ok);
  assert.equal(ok?.profile.planId, 'full-body');
});

test('a round-trip through JSON is lossless for real state', () => {
  const original = emptyState();
  original.profile.name = 'Alex';
  original.profile.weightUnit = 'lb';
  original.profile.weekStartsOn = 0;
  original.sessions = [
    {
      id: 's1',
      date: '2026-02-02',
      categoryId: 'cat-cardio',
      title: 'Run',
      durationMin: 40,
      intensity: 'moderate',
      calories: 420,
      distanceKm: 8.2,
      exercises: [],
      notes: 'felt good',
      createdAt: 1,
    },
  ];
  // Compare through JSON so absent optional keys and explicit `undefined`
  // (which parseState normalises to) are treated the same way.
  const restored = parseState(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(
    JSON.parse(JSON.stringify(restored.profile)),
    JSON.parse(JSON.stringify(original.profile)),
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(restored.sessions)),
    JSON.parse(JSON.stringify(original.sessions)),
  );
});

test('isEmptyState only reports true for a genuinely blank account', () => {
  const s = emptyState();
  assert.equal(isEmptyState(s), true);
  s.profile.name = 'Alex'; // a name alone is not data worth migrating
  assert.equal(isEmptyState(s), true);
  s.sessions = [
    {
      id: 'a',
      date: '2026-01-01',
      categoryId: 'c',
      title: 'x',
      durationMin: 1,
      intensity: 'low',
      calories: 1,
      exercises: [],
      createdAt: 1,
    },
  ];
  assert.equal(isEmptyState(s), false);
});
