import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, parseState, parseStateJSON } from '../src/index';

/**
 * The new persisted fields are untrusted input, like every other field.
 * These cover the round-trip plus the specific ways an old build, a synced
 * client from another version, or a hand-edited export can get them wrong.
 */

const base = () => JSON.parse(JSON.stringify(emptyState()));

test('a state from before these fields existed still parses', () => {
  const legacy = {
    profile: { name: 'Sam', weightUnit: 'kg', distanceUnit: 'km' },
    categories: [],
    sessions: [],
    goals: [
      {
        id: 'g1',
        name: 'Train',
        metric: 'workouts',
        cadence: 'weekly',
        target: 4,
        startDate: '2026-01-01',
        createdAt: 1,
      },
    ],
    bodyLogs: [],
    meals: [
      {
        id: 'm1',
        date: '2026-01-02',
        name: 'Lunch',
        slot: 'lunch',
        calories: 500,
        protein: 30,
        scanned: true,
        createdAt: 2,
      },
    ],
  };
  const state = parseState(legacy);
  assert.equal(state.goals.length, 1);
  assert.equal(state.goals[0].deadline, undefined, 'no deadline invented for an old goal');
  assert.deepEqual(state.checkIns, []);
  assert.equal(state.meals[0].source, undefined);
  assert.deepEqual(state.meals[0].items, undefined);
  assert.equal(state.meals[0].scanned, true, 'the old scan flag survives');
});

test('a good goal deadline round-trips', () => {
  const raw = base();
  raw.goals = [
    {
      id: 'g1',
      name: 'Cut to 75',
      metric: 'weight',
      cadence: 'monthly',
      target: 75,
      startDate: '2026-09-01',
      deadline: '2026-12-01',
      createdAt: 1,
    },
  ];
  // `weight` is not a goal metric — the parser must fall back, not crash.
  const state = parseState(raw);
  assert.equal(state.goals[0].deadline, '2026-12-01');
  assert.equal(state.goals[0].metric, 'workouts');
});

test('a deadline before the start date is dropped, not kept as a negative window', () => {
  const raw = base();
  raw.goals = [
    {
      id: 'g1',
      name: 'Impossible',
      metric: 'minutes',
      cadence: 'weekly',
      target: 100,
      startDate: '2026-09-01',
      deadline: '2026-08-01',
      createdAt: 1,
    },
  ];
  assert.equal(parseState(raw).goals[0].deadline, undefined);
});

test('a malformed deadline is dropped', () => {
  for (const deadline of ['soon', '', '2026/12/01', 42, null, {}]) {
    const raw = base();
    raw.goals = [
      {
        id: 'g1',
        name: 'Goal',
        metric: 'workouts',
        cadence: 'weekly',
        target: 4,
        startDate: '2026-09-01',
        deadline,
        createdAt: 1,
      },
    ];
    assert.equal(parseState(raw).goals[0].deadline, undefined, `kept ${String(deadline)}`);
  }
});

test('check-ins round-trip, de-duplicate on id and sort oldest first', () => {
  const raw = base();
  const check = (id: string, weekOf: string) => ({
    id,
    date: weekOf,
    weekOf,
    feeling: 4,
    workouts: 3,
    minutes: 120,
    weightKg: 78.5,
    notes: 'solid week',
    createdAt: 10,
  });
  raw.checkIns = [
    check('c2', '2026-09-07'),
    check('c1', '2026-08-31'),
    check('c2', '2026-09-07'), // duplicate id
  ];
  const state = parseState(raw);
  assert.equal(state.checkIns!.length, 2);
  assert.deepEqual(
    state.checkIns!.map((c) => c.weekOf),
    ['2026-08-31', '2026-09-07'],
  );
  assert.equal(state.checkIns![1].notes, 'solid week');
  assert.equal(state.checkIns![1].weightKg, 78.5);
});

test('a check-in without a week is dropped; a silly feeling is normalised', () => {
  const raw = base();
  raw.checkIns = [
    { id: 'bad', date: '2026-09-07', feeling: 4, workouts: 1, minutes: 10, createdAt: 1 },
    { id: 'worse', weekOf: '2026-09-07', feeling: 99, workouts: 'lots', minutes: -5, createdAt: 1 },
  ];
  const state = parseState(raw);
  assert.equal(state.checkIns!.length, 1, 'the entry with no week cannot be placed');
  assert.equal(state.checkIns![0].feeling, 3, 'an out-of-range feeling becomes the neutral middle');
  assert.equal(state.checkIns![0].workouts, 0);
  assert.equal(state.checkIns![0].minutes, 0);
  assert.equal(state.checkIns![0].date, '2026-09-07', 'the date falls back to the week');
});

test('meal items are filtered to real foods', () => {
  const raw = base();
  raw.meals = [
    {
      id: 'm1',
      date: '2026-09-01',
      name: 'Photo meal',
      slot: 'lunch',
      calories: 600,
      protein: 40,
      source: 'photo',
      items: ['chicken', 'unicorn', 'rice', 42],
      createdAt: 1,
    },
  ];
  const state = parseState(raw);
  assert.deepEqual(state.meals[0].items, ['chicken', 'rice']);
  assert.equal(state.meals[0].source, 'photo');
});

test('an unknown meal source is dropped rather than trusted', () => {
  const raw = base();
  raw.meals = [
    {
      id: 'm1',
      date: '2026-09-01',
      name: 'Meal',
      slot: 'lunch',
      calories: 600,
      protein: 40,
      source: 'telepathy',
      createdAt: 1,
    },
  ];
  assert.equal(parseState(raw).meals[0].source, undefined);
});

test('a meal photo is kept only when it is a small local thumbnail', () => {
  const make = (photo: unknown) => {
    const raw = base();
    raw.meals = [
      {
        id: 'm1',
        date: '2026-09-01',
        name: 'Meal',
        slot: 'lunch',
        calories: 600,
        protein: 40,
        photo,
        createdAt: 1,
      },
    ];
    return parseState(raw).meals[0].photo;
  };
  const thumb = `data:image/jpeg;base64,${'A'.repeat(1000)}`;
  assert.equal(make(thumb), thumb);
  assert.equal(
    make('https://example.com/lunch.jpg'),
    undefined,
    'a remote URL is not a local photo',
  );
  assert.equal(
    make(`data:image/jpeg;base64,${'A'.repeat(200_000)}`),
    undefined,
    'too big to persist',
  );
  assert.equal(make(42), undefined);
});

test('dietary preferences are filtered against the known tables', () => {
  const raw = base();
  raw.profile.dietary = {
    restrictions: ['vegan', 'invented-restriction', 'halal'],
    favorites: ['chicken', 'not-a-food'],
    dislikes: ['pizza'],
  };
  const dietary = parseState(raw).profile.dietary!;
  assert.deepEqual(dietary.restrictions, ['vegan', 'halal']);
  assert.deepEqual(dietary.favorites, ['chicken']);
  assert.deepEqual(dietary.dislikes, ['pizza']);
});

test('a dietary block with nothing valid becomes an empty restriction list', () => {
  const raw = base();
  raw.profile.dietary = { restrictions: 'vegan' };
  assert.deepEqual(parseState(raw).profile.dietary, { restrictions: [] });
  const raw2 = base();
  raw2.profile.dietary = { restrictions: [] };
  assert.deepEqual(parseState(raw2).profile.dietary, { restrictions: [] });
});

test('the locale is kept only when it looks like one', () => {
  const withLocale = (locale: unknown) => {
    const raw = base();
    raw.profile.locale = locale;
    return parseState(raw).profile.locale;
  };
  assert.equal(withLocale('fr'), 'fr');
  assert.equal(withLocale('fr-MA'), 'fr-ma', 'normalised to lower case');
  assert.equal(withLocale('EN'), 'en');
  assert.equal(withLocale('french'), undefined);
  assert.equal(withLocale('f'), undefined);
  assert.equal(withLocale(42), undefined);
  assert.equal(withLocale('x'.repeat(60)), undefined);
});

test('the whole new surface survives a JSON round-trip', () => {
  const raw = base();
  raw.profile.locale = 'fr';
  raw.profile.dietary = { restrictions: ['halal'], favorites: ['chicken'] };
  raw.goals = [
    {
      id: 'g1',
      name: 'Run 40 km',
      metric: 'distance',
      cadence: 'monthly',
      target: 40,
      startDate: '2026-09-01',
      deadline: '2026-10-01',
      createdAt: 1,
    },
  ];
  raw.checkIns = [
    {
      id: 'c1',
      date: '2026-09-07',
      weekOf: '2026-08-31',
      feeling: 5,
      workouts: 5,
      minutes: 300,
      createdAt: 2,
    },
  ];
  raw.meals = [
    {
      id: 'm1',
      date: '2026-09-01',
      name: 'Poulet et riz',
      slot: 'lunch',
      calories: 604,
      protein: 71,
      carbs: 30,
      fat: 7,
      source: 'vote+scan',
      items: ['chicken', 'rice'],
      createdAt: 3,
    },
  ];

  const once = parseState(raw);
  const twice = parseStateJSON(JSON.stringify(once))!;
  assert.deepEqual(twice, once, 'parsing is idempotent');
  assert.equal(twice.profile.locale, 'fr');
  assert.equal(twice.goals[0].deadline, '2026-10-01');
  assert.equal(twice.checkIns![0].feeling, 5);
  assert.equal(twice.meals[0].source, undefined, 'an unknown source is dropped both times');
});
