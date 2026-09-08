import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISES,
  EXERCISE_EQUIPMENT_LABELS,
  EXERCISE_GIF_BASE,
  EXERCISE_GROUPS,
  EXERCISE_IMAGE_BASE,
  EXERCISE_MUSCLE_LABELS,
  exerciseGifUrl,
  exerciseImages,
  exerciseInstructionsUrl,
  matchExercise,
  searchExercises,
  type ExerciseEquipment,
  type ExerciseGroup,
  type ExerciseMuscle,
} from '../src/exercises.ts';

/**
 * The exercise catalog backs two user-facing promises:
 *   1. every entry resolves to a real, verifiable demo image on the CDN;
 *   2. anything a user free-typed into old logs still resolves to an entry
 *      whenever a reasonable match exists.
 * These tests defend both.
 */

const MUSCLES = new Set(Object.keys(EXERCISE_MUSCLE_LABELS));
const EQUIPMENT = new Set(Object.keys(EXERCISE_EQUIPMENT_LABELS));
const GROUPS = new Set(EXERCISE_GROUPS.map((g) => g.id));

test('the catalog is internally consistent', () => {
  assert.ok(EXERCISES.length >= 100, 'a useful picker needs a full menu');

  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of EXERCISES) {
    assert.ok(!ids.has(entry.id), `duplicate id: ${entry.id}`);
    assert.ok(!names.has(entry.name), `duplicate name: ${entry.name}`);
    ids.add(entry.id);
    names.add(entry.name);

    // The id is the upstream folder name — it must be path-safe and the
    // exercise must have at least one muscle and known equipment.
    assert.match(entry.id, /^[A-Za-z0-9][A-Za-z0-9._-]*$/, `unsafe id: ${entry.id}`);
    assert.ok(entry.muscles.length >= 1, `${entry.id} has no muscles`);
    for (const m of entry.muscles) {
      assert.ok(MUSCLES.has(m), `${entry.id} has unknown muscle: ${m}`);
    }
    assert.ok(
      EQUIPMENT.has(entry.equipment as ExerciseEquipment),
      `${entry.id} has unknown equipment: ${entry.equipment}`,
    );
    assert.ok(
      GROUPS.has(entry.group as ExerciseGroup),
      `${entry.id} has unknown group: ${entry.group}`,
    );
  }

  // Every browse group is populated — an empty chip would be a dead end.
  for (const g of GROUPS) {
    assert.ok(
      EXERCISES.some((e) => e.group === g),
      `group "${g}" has no exercises`,
    );
  }
});

test('demo image URLs point at the CDN with both frames', () => {
  const squat = matchExercise('Barbell Squat');
  assert.ok(squat);
  const [start, end] = exerciseImages(squat);
  assert.equal(start, `${EXERCISE_IMAGE_BASE}/Barbell_Squat/0.jpg`);
  assert.equal(end, `${EXERCISE_IMAGE_BASE}/Barbell_Squat/1.jpg`);
});

test('instruction URLs point at the per-exercise JSON next to the frames', () => {
  const bench = matchExercise('bench press');
  assert.ok(bench);
  assert.equal(
    exerciseInstructionsUrl(bench),
    `${EXERCISE_IMAGE_BASE}/Barbell_Bench_Press_-_Medium_Grip.json`,
  );
});

test('exact names and aliases match, case and punctuation insensitive', () => {
  const cases: [string, string][] = [
    ['Barbell Bench Press', 'Barbell_Bench_Press_-_Medium_Grip'],
    ['bench press', 'Barbell_Bench_Press_-_Medium_Grip'],
    ['BENCH PRESS', 'Barbell_Bench_Press_-_Medium_Grip'],
    ['Benchpress', 'Barbell_Bench_Press_-_Medium_Grip'],
    ['deadlift', 'Barbell_Deadlift'],
    ['RDL', 'Romanian_Deadlift'],
    ['ohp', 'Barbell_Shoulder_Press'],
    ['push-ups', 'Pushups'],
    ['press ups', 'Pushups'],
    ['lat pulldown', 'Close-Grip_Front_Lat_Pulldown'],
    ['seated row', 'Seated_Cable_Rows'],
    ['hip thrust', 'Barbell_Hip_Thrust'],
    ['skull crushers', 'EZ-Bar_Skullcrusher'],
    ['air squat', 'Bodyweight_Squat'],
    ['bicycle crunch', 'Air_Bike'],
    ['dumbbell curl', 'Seated_Dumbbell_Curl'],
  ];
  for (const [input, expectedId] of cases) {
    const hit = matchExercise(input);
    assert.ok(hit, `expected a match for "${input}"`);
    assert.equal(hit.id, expectedId, `"${input}" should resolve to ${expectedId}`);
  }
});

test('partial and messy input resolves to the canonical family head', () => {
  // A family head is the entry ordered first among its siblings.
  assert.equal(matchExercise('incline bench')?.id, 'Barbell_Incline_Bench_Press_-_Medium_Grip');
  assert.equal(matchExercise('cable row')?.id, 'Seated_Cable_Rows');
  assert.equal(matchExercise('calf raises')?.id, 'Standing_Calf_Raises');
  assert.equal(matchExercise('leg press machine')?.id, 'Leg_Press');
});

test('unknown input returns null instead of a wrong exercise', () => {
  assert.equal(matchExercise(''), null);
  assert.equal(matchExercise('   '), null);
  assert.equal(matchExercise('underwater basket weaving'), null);
  assert.equal(matchExercise('flurg blorp 9000'), null);
});

test('search ranks name and alias hits above keyword noise', () => {
  const press = searchExercises('press');
  assert.ok(press.length > 0);
  assert.ok(press.length <= 8, 'respects the default limit');
  // "Bench Press"-style entries outrank a mere muscle keyword like shoulders.
  const bench = searchExercises('bench');
  assert.equal(bench[0]?.id, 'Barbell_Bench_Press_-_Medium_Grip');

  const rdl = searchExercises('rdl');
  assert.equal(rdl[0]?.id, 'Romanian_Deadlift');

  const shoulder = searchExercises('shoulders');
  assert.ok(shoulder.length > 0);
  assert.ok(
    shoulder.every((e) => e.muscles.includes('shoulders' as ExerciseMuscle)),
    'muscle keyword only returns exercises that hit that muscle',
  );
});

test('an empty query surfaces popular lifts first', () => {
  const suggested = searchExercises('');
  assert.ok(suggested.length > 0);
  assert.ok(
    suggested.every((e) => e.popular),
    'defaults are the popular set',
  );
  const popularCount = EXERCISES.filter((e) => e.popular).length;
  assert.ok(suggested.length <= popularCount);
});

test('curated gif references build valid ExerciseGymGifsDB urls', () => {
  const withGif = EXERCISES.filter((e) => e.gif);
  // Broad coverage of the catalog — extend the mapping rather than lowering this.
  assert.ok(withGif.length >= 85, `expected broad gif coverage, found ${withGif.length}`);

  const seen = new Set<string>();
  for (const entry of withGif) {
    const muscle = entry.gif?.muscle ?? '';
    const slug = entry.gif?.slug ?? '';
    assert.match(muscle, /^[a-z-]+$/, `${entry.id}: muscle folder must be a slug`);
    assert.match(slug, /^[a-z0-9-]+$/, `${entry.id}: slug must be a slug`);
    const key = `${muscle}/${slug}`;
    assert.ok(!seen.has(key), `duplicate gif reference ${key}`);
    seen.add(key);

    const thumb = exerciseGifUrl(entry, 'thumb');
    const full = exerciseGifUrl(entry, 'full');
    assert.equal(thumb, `${EXERCISE_GIF_BASE}/${muscle}/${slug}.thumb.webp`);
    assert.equal(full, `${EXERCISE_GIF_BASE}/${muscle}/${slug}.gif`);
    assert.equal(exerciseGifUrl(entry), thumb, 'defaults to the light thumb');
  }

  const without = EXERCISES.find((e) => !e.gif);
  assert.ok(without, 'catalog should contain at least one photo-only entry');
  assert.equal(exerciseGifUrl(without!, 'full'), null);
  assert.equal(exerciseGifUrl(without!, 'thumb'), null);
});
