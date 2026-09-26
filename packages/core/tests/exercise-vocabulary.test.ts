import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_GROUPS,
  EXERCISE_MUSCLE_LABELS,
  MESSAGES,
  createTranslator,
  exerciseGroupLabel,
  exerciseEquipmentLabel,
  exerciseMuscleLabel,
  exerciseVocabulary,
} from '../src/index.ts';

/**
 * The exercise library, the focus-workout builder and the body map all render
 * muscle, group and equipment names. Those come from the label maps in
 * `exercises.ts`, and the UI translates them by id — so an id without a
 * catalogue key renders `library.muscle.shin` to the athlete.
 *
 * `catalogGaps` cannot see this: the key is built at runtime, so nothing in
 * the source ever names it literally.
 */

const LOCALES = ['en', 'fr'] as const;

/** Same normalisation the helpers use: ids carry spaces and dots. */
function key(id: string): string {
  return id.replace(/[\s.]+/g, '-');
}

test('every exercise group has copy in both locales', () => {
  for (const locale of LOCALES) {
    for (const group of EXERCISE_GROUPS) {
      const message = MESSAGES[locale][`library.group.${key(group.id)}`];
      assert.ok(message, `${locale} is missing library.group.${key(group.id)}`);
    }
  }
});

test('every muscle has copy in both locales', () => {
  for (const locale of LOCALES) {
    for (const muscle of Object.keys(EXERCISE_MUSCLE_LABELS)) {
      const message = MESSAGES[locale][`library.muscle.${key(muscle)}`];
      assert.ok(message, `${locale} is missing library.muscle.${key(muscle)}`);
    }
  }
});

test('every equipment kind has copy in both locales', () => {
  for (const locale of LOCALES) {
    for (const equipment of Object.keys(EXERCISE_EQUIPMENT_LABELS)) {
      const message = MESSAGES[locale][`library.equipment.${key(equipment)}`];
      assert.ok(message, `${locale} is missing library.equipment.${key(equipment)}`);
    }
  }
});

test('the helpers resolve ids to copy, never to a key', () => {
  const french = createTranslator('fr');
  for (const group of EXERCISE_GROUPS) {
    const label = exerciseGroupLabel(group.id, french);
    assert.ok(!label.startsWith('library.'), `group ${group.id} rendered its key: ${label}`);
  }
  for (const muscle of Object.keys(EXERCISE_MUSCLE_LABELS)) {
    const label = exerciseMuscleLabel(muscle as never, french);
    assert.ok(!label.startsWith('library.'), `muscle ${muscle} rendered its key: ${label}`);
  }
  for (const equipment of Object.keys(EXERCISE_EQUIPMENT_LABELS)) {
    const label = exerciseEquipmentLabel(equipment as never, french);
    assert.ok(!label.startsWith('library.'), `equipment ${equipment} rendered its key: ${label}`);
  }
});

test('spaces and dots in ids become hyphens in keys', () => {
  const french = createTranslator('fr');
  assert.equal(exerciseMuscleLabel('middle back', french), 'Milieu du dos');
  assert.equal(exerciseEquipmentLabel('ez-bar', french), 'Barre EZ');
});

test('the vocabulary bundle matches the individual helpers', () => {
  const english = createTranslator('en');
  const vocab = exerciseVocabulary(english);
  assert.equal(vocab.group('legs'), 'Legs');
  assert.equal(vocab.muscle('quadriceps'), 'Quads');
  assert.equal(vocab.equipment('body'), 'Bodyweight');
  // And the English copy still matches the reference maps the mobile app reads,
  // so the two clients cannot drift apart silently.
  for (const group of EXERCISE_GROUPS) {
    assert.equal(vocab.group(group.id), group.label, `group ${group.id} drifted`);
  }
  for (const [muscle, label] of Object.entries(EXERCISE_MUSCLE_LABELS)) {
    assert.equal(vocab.muscle(muscle as never), label, `muscle ${muscle} drifted`);
  }
  for (const [equipment, label] of Object.entries(EXERCISE_EQUIPMENT_LABELS)) {
    assert.equal(vocab.equipment(equipment as never), label, `equipment ${equipment} drifted`);
  }
});
