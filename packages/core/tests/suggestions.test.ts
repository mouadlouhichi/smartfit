import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryIdForSuggestion,
  emptyState,
  exerciseMeasure,
  formatSet,
  formatSetDistance,
  matchExercise,
  measureForExerciseName,
  suggestExercises,
  suggestionGoal,
} from '../src/index.ts';
import type { FitnessState } from '../src/index.ts';

function stateWith(overrides: Partial<FitnessState>): FitnessState {
  return { ...emptyState(), ...overrides };
}

test('pool and running entries log distance, iron logs weight', () => {
  assert.equal(measureForExerciseName('Freestyle Swim'), 'distance');
  assert.equal(measureForExerciseName('swimming'), 'distance'); // alias resolves too
  assert.equal(measureForExerciseName('Easy Run'), 'distance');
  assert.equal(measureForExerciseName('Barbell Squat'), 'weight');
  assert.equal(measureForExerciseName('Some Custom Thing'), 'weight');
  assert.equal(exerciseMeasure(matchExercise('Aqua Jogging')!), 'distance');
});

test('short distances format in metres', () => {
  assert.equal(formatSetDistance(0.4), '400 m');
  assert.equal(formatSetDistance(2.5), '2.5 km');
  assert.equal(formatSet({ distance: 0.4 }), '400 m');
});

test('suggestions always include pool + running with reasons', () => {
  const out = suggestExercises(emptyState());
  assert.equal(out.length, 4);
  const equip = out.map((s) => s.entry.equipment);
  assert.ok(equip.includes('pool'));
  assert.ok(equip.includes('running'));
  for (const s of out) assert.ok(s.reason.length > 10);
});

test('high body fat tilts to conditioning and says so', () => {
  const s = stateWith({
    bodyLogs: [{ id: 'b1', date: '2026-09-01', unit: 'bodyfat', value: 27, createdAt: 1 }],
  });
  assert.equal(suggestionGoal(s), 'cut');
  const out = suggestExercises(s);
  assert.ok(out.some((x) => x.reason.includes('27')));
});

test('recently trained moves are skipped when alternatives exist', () => {
  const today = new Date().toISOString().slice(0, 10);
  const s = stateWith({
    sessions: [
      {
        id: 's1',
        date: today,
        categoryId: 'cat-cardio',
        title: 'Run',
        durationMin: 30,
        intensity: 'moderate',
        calories: 200,
        exercises: [{ name: 'Easy Run', sets: [{ distance: 5 }] }],
        createdAt: 1,
      },
    ],
  });
  const out = suggestExercises(s);
  const runs = out.filter((x) => x.entry.equipment === 'running');
  assert.equal(runs.length, 1);
  assert.notEqual(runs[0].entry.name, 'Easy Run');
});

test('suggestion categories follow the equipment', () => {
  const s = emptyState();
  assert.equal(categoryIdForSuggestion(s, 'pool'), 'cat-cardio');
  assert.equal(categoryIdForSuggestion(s, 'running'), 'cat-cardio');
  assert.equal(categoryIdForSuggestion(s, 'barbell'), 'cat-strength');
});

test('the 10-08 InBody sheet drives a muscle-sparing cut', () => {
  // 29M, 175cm: 87.2 kg, 26.5% fat, 99.7 cm waist, InBody target 75.4 kg.
  const s = stateWith({
    profile: { ...emptyState().profile, targetWeightKg: 75.4 },
    bodyLogs: [
      { id: 'b1', date: '2026-08-10', unit: 'weight', value: 87.2, createdAt: 1 },
      { id: 'b2', date: '2026-08-10', unit: 'bodyfat', value: 26.5, createdAt: 2 },
      { id: 'b3', date: '2026-08-10', unit: 'waist', value: 99.7, createdAt: 3 },
    ],
  });
  assert.equal(suggestionGoal(s), 'cut');
  const out = suggestExercises(s);
  assert.equal(out.length, 4);
  const equip = out.map((x) => x.entry.equipment);
  assert.ok(equip.includes('pool'));
  assert.ok(equip.includes('running'));
  assert.ok(out[0].reason.includes('27')); // rounded 26.5%
  assert.ok(out.some((x) => /compound|metabolism/i.test(x.reason)));
});

test('a high waist alone tilts to conditioning and says so', () => {
  const s = stateWith({
    bodyLogs: [{ id: 'b1', date: '2026-09-01', unit: 'waist', value: 99.7, createdAt: 1 }],
  });
  assert.equal(suggestionGoal(s), 'cut');
  const out = suggestExercises(s);
  assert.ok(out[0].reason.includes('99.7'));
});
