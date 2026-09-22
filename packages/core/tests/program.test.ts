import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_CATEGORY,
  emptyState,
  findGymProgram,
  kgToTarget,
  parseStateJSON,
  suggestProgram,
  suggestedToSchedule,
  suggestSummary,
  weeklyMix,
} from '../src/index.ts';
import type { GymProgram } from '../src/index.ts';

/*
 * Test fixture: a synthetic gym with a dense weekly grid — every day offers
 * every focus, so the engine's day/focus matching always has a slot to find.
 * The real app feeds `suggestProgram` GymPrograms built from live tenants
 * (see src/lib/tenant-server.ts); the engine itself is tenant-agnostic.
 */
const FIXTURE_CLASSES = [
  { id: 'cardio-burn', name: 'Cardio Burn', focus: 'cardio', intensity: 'high', minutes: 45 },
  { id: 'hiit-45', name: 'HIIT 45', focus: 'hiit', intensity: 'high', minutes: 45 },
  {
    id: 'strength-f',
    name: 'Strength Foundations',
    focus: 'strength',
    intensity: 'moderate',
    minutes: 50,
  },
  { id: 'boxing-f', name: 'Boxing Fundamentals', focus: 'combat', intensity: 'high', minutes: 60 },
  { id: 'mobility', name: 'Mobility & Recovery', focus: 'mind', intensity: 'low', minutes: 40 },
  { id: 'aqua-fit', name: 'Aqua Fitness', focus: 'aqua', intensity: 'moderate', minutes: 45 },
] as const;

const TEST_GYM: GymProgram = {
  id: 'test-gym',
  name: 'Test Gym',
  hours: 'Mon–Sat 06:30–22:30',
  classes: Object.fromEntries(FIXTURE_CLASSES.map((c) => [c.id, c])),
  week: FIXTURE_CLASSES.flatMap((c, i) =>
    [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      time: ['06:30', '12:00', '18:00', '19:00', '20:00', '21:00'][i],
      classId: c.id,
    })),
  ),
};
import type { BodyLog, FitnessState } from '../src/index.ts';

function weightLog(kg: number, daysAgo = 0, createdAt = Date.now()): BodyLog {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `body-${kg}-${daysAgo}-${createdAt}`,
    date: d.toISOString().slice(0, 10),
    unit: 'weight',
    value: kg,
    createdAt,
  };
}

function stateWith(extra: Partial<FitnessState['profile']> = {}, logs: BodyLog[] = []) {
  const state = emptyState();
  return { ...state, profile: { ...state.profile, ...extra }, bodyLogs: logs };
}

test('a gym program timetable is internally consistent', () => {
  assert.ok(TEST_GYM.week.length >= 36);
  for (const slot of TEST_GYM.week) {
    assert.ok(TEST_GYM.classes[slot.classId], `unknown class ${slot.classId}`);
    assert.match(slot.time, /^\d{2}:\d{2}$/);
    assert.ok(slot.weekday >= 0 && slot.weekday <= 6);
  }
});

test('weeklyMix leans into burn while far from target', () => {
  const mix = weeklyMix(6.5, 4);
  assert.equal(mix.length, 4);
  const burns = mix.filter((f) => f === 'hiit' || f === 'cardio' || f === 'combat').length;
  assert.equal(burns, 3);
  assert.ok(mix.includes('strength'));
});

test('weeklyMix flips to maintenance at or past the target', () => {
  const atTarget = weeklyMix(0, 4);
  assert.equal(atTarget.filter((f) => f === 'strength').length, 2);
  const past = weeklyMix(-2, 4);
  assert.equal(past.length, 4);
  assert.ok(past.includes('mind') || past.includes('aqua'));
});

test('weeklyMix without a target stays balanced and always sums to n', () => {
  for (let n = 2; n <= 7; n++) {
    assert.equal(weeklyMix(null, n).length, n);
  }
  assert.equal(weeklyMix(null, 4).filter((f) => f === 'strength').length, 1);
});

test('kgToTarget is null unless both weight log and target exist', () => {
  assert.equal(kgToTarget(stateWith({}, [weightLog(84.5)])), null);
  assert.equal(kgToTarget(stateWith({ targetWeightKg: 78 })), null);
});

test('kgToTarget uses the latest weight log', () => {
  const state = stateWith({ targetWeightKg: 78 }, [
    weightLog(85, 10, Date.now() - 1000),
    weightLog(84.5, 1, Date.now()),
    weightLog(84.2, 1, Date.now() + 1000), // same day, newer wins
  ]);
  assert.equal(kgToTarget(state), 6.2);
});

test('suggestProgram returns one real class per planned session', () => {
  const state = stateWith({ targetWeightKg: 78 }, [weightLog(84.5)]);
  const suggested = suggestProgram(state, TEST_GYM);
  assert.equal(suggested.length, 3); // full-body = 3×/week by default

  for (const s of suggested) {
    const slot = TEST_GYM.week.find(
      (w) => w.weekday === s.weekday && w.time === s.time && w.classId === s.gymClass.id,
    );
    assert.ok(slot, `${s.gymClass.name} ${s.weekday} ${s.time} is not on the timetable`);
  }

  // No two suggestions occupy the same timetable slot.
  const keys = suggested.map((s) => `${s.weekday}-${s.time}-${s.gymClass.id}`);
  assert.equal(new Set(keys).size, keys.length);

  // Deterministic: identical state → identical week.
  assert.deepEqual(suggestProgram(state, TEST_GYM), suggested);
});

test('suggestProgram days follow the plan split and adapt with the plan', () => {
  const state = stateWith({ planId: 'ppl', targetWeightKg: 78 }, [weightLog(84.5)]);
  const suggested = suggestProgram(state, TEST_GYM);
  assert.equal(suggested.length, 6); // ppl = 6×/week
  const days = suggested.map((s) => s.weekday);
  assert.equal(new Set(days).size, days.length, 'one session per day');
});

test('a big gap biases the suggested week toward burn classes', () => {
  const state = stateWith({ planId: 'ppl', targetWeightKg: 78 }, [weightLog(90)]);
  const burns = suggestProgram(state, TEST_GYM).filter(
    (s) =>
      s.gymClass.focus === 'hiit' || s.gymClass.focus === 'cardio' || s.gymClass.focus === 'combat',
  );
  assert.ok(burns.length >= 4, `expected burn-heavy week, got ${burns.length}`);
});

test('suggestedToSchedule maps onto schedule rows with built-in categories', () => {
  const state = stateWith({ targetWeightKg: 78 }, [weightLog(84.5)]);
  const rows = suggestedToSchedule(suggestProgram(state, TEST_GYM));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.ok(Object.values(FOCUS_CATEGORY).includes(row.categoryId));
    assert.equal(row.active, true);
    assert.match(row.timeOfDay, /^\d{2}:\d{2}$/);
    assert.ok(row.durationMin > 0);
    assert.ok(row.title.length > 0);
  }
});

test('findGymProgram resolves selections and rejects unknown ids', () => {
  const programs = [TEST_GYM];
  assert.equal(findGymProgram(programs, 'test-gym')?.id, 'test-gym');
  assert.equal(findGymProgram(programs, ''), null);
  assert.equal(findGymProgram(programs, undefined), null);
  assert.equal(findGymProgram(programs, 'gym-that-does-not-exist'), null);
  // The list is the source of truth: a gym missing from it stops resolving.
  assert.equal(findGymProgram([], 'test-gym'), null);
});

test('profile gymId survives parsing and junk is dropped', () => {
  const withGym = parseStateJSON(
    JSON.stringify({ profile: { gymId: 'zone-fight', targetWeightKg: 78 } }),
  );
  assert.ok(withGym, 'valid state parses');
  assert.equal(withGym.profile.gymId, 'zone-fight');
  assert.equal(withGym.profile.targetWeightKg, 78);

  const junk = parseStateJSON(JSON.stringify({ profile: { gymId: '   ' } }));
  assert.ok(junk, 'state still parses');
  assert.equal('gymId' in junk.profile, false);

  const plain = parseStateJSON(JSON.stringify({ profile: {} }));
  assert.ok(plain, 'state still parses');
  assert.equal('gymId' in plain.profile, false);
  assert.equal('targetWeightKg' in plain.profile, false);
});

test('suggestSummary tells the target story in display units', () => {
  assert.match(suggestSummary(stateWith({}, [])), /Set a target weight/);
  assert.match(
    suggestSummary(stateWith({ targetWeightKg: 78 }, [weightLog(84.5)])),
    /6\.5 kg to your 78 kg/,
  );
  assert.match(
    suggestSummary(stateWith({ targetWeightKg: 78 }, [weightLog(77)])),
    /Target reached/,
  );
  const lb = stateWith({ targetWeightKg: 78, weightUnit: 'lb' }, [weightLog(84.5)]);
  assert.match(suggestSummary(lb), /lb/);
});
