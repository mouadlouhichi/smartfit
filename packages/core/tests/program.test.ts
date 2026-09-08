import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_CATEGORY,
  GYM_PROGRAMS,
  ZONE_FIGHT,
  emptyState,
  getGymProgram,
  kgToTarget,
  parseStateJSON,
  suggestProgram,
  suggestedToSchedule,
  suggestSummary,
  weeklyMix,
} from '../src/index.ts';
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

test('ZONE_FIGHT timetable is internally consistent', () => {
  assert.ok(ZONE_FIGHT.week.length >= 40);
  for (const slot of ZONE_FIGHT.week) {
    assert.ok(ZONE_FIGHT.classes[slot.classId], `unknown class ${slot.classId}`);
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
  const suggested = suggestProgram(state);
  assert.equal(suggested.length, 3); // full-body = 3×/week by default

  for (const s of suggested) {
    const slot = ZONE_FIGHT.week.find(
      (w) => w.weekday === s.weekday && w.time === s.time && w.classId === s.gymClass.id,
    );
    assert.ok(slot, `${s.gymClass.name} ${s.weekday} ${s.time} is not on the timetable`);
  }

  // No two suggestions occupy the same timetable slot.
  const keys = suggested.map((s) => `${s.weekday}-${s.time}-${s.gymClass.id}`);
  assert.equal(new Set(keys).size, keys.length);

  // Deterministic: identical state → identical week.
  assert.deepEqual(suggestProgram(state), suggested);
});

test('suggestProgram days follow the plan split and adapt with the plan', () => {
  const state = stateWith({ planId: 'ppl', targetWeightKg: 78 }, [weightLog(84.5)]);
  const suggested = suggestProgram(state);
  assert.equal(suggested.length, 6); // ppl = 6×/week
  const days = suggested.map((s) => s.weekday);
  assert.equal(new Set(days).size, days.length, 'one session per day');
});

test('a big gap biases the suggested week toward burn classes', () => {
  const state = stateWith({ planId: 'ppl', targetWeightKg: 78 }, [weightLog(90)]);
  const burns = suggestProgram(state).filter(
    (s) =>
      s.gymClass.focus === 'hiit' || s.gymClass.focus === 'cardio' || s.gymClass.focus === 'combat',
  );
  assert.ok(burns.length >= 4, `expected burn-heavy week, got ${burns.length}`);
});

test('suggestedToSchedule maps onto schedule rows with built-in categories', () => {
  const state = stateWith({ targetWeightKg: 78 }, [weightLog(84.5)]);
  const rows = suggestedToSchedule(suggestProgram(state));
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.ok(Object.values(FOCUS_CATEGORY).includes(row.categoryId));
    assert.equal(row.active, true);
    assert.match(row.timeOfDay, /^\d{2}:\d{2}$/);
    assert.ok(row.durationMin > 0);
    assert.ok(row.title.length > 0);
  }
});

test('gym registry resolves selections and rejects unknown ids', () => {
  assert.equal(GYM_PROGRAMS.length, 1);
  assert.equal(getGymProgram('zone-fight')?.id, 'zone-fight');
  assert.equal(getGymProgram(''), null);
  assert.equal(getGymProgram(undefined), null);
  assert.equal(getGymProgram('gym-that-does-not-exist'), null);
});

test('profile gymId survives parsing and junk is dropped', () => {
  const withGym = parseStateJSON(
    JSON.stringify({ profile: { gymId: 'zone-fight', targetWeightKg: 78 } }),
  );
  assert.equal(withGym.profile.gymId, 'zone-fight');
  assert.equal(withGym.profile.targetWeightKg, 78);

  const junk = parseStateJSON(JSON.stringify({ profile: { gymId: '   ' } }));
  assert.equal('gymId' in junk.profile, false);

  const plain = parseStateJSON(JSON.stringify({ profile: {} }));
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
