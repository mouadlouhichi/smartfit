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
  allExercises,
  matchExercise,
  measureForExerciseName,
  searchExercises,
  type ExerciseEquipment,
  type ExerciseGroup,
  type ExerciseMuscle,
} from '../src/exercises.ts';
import {
  applyExtendedCatalog,
  extendedExerciseCount,
  extendedExercises,
  isExtendedCatalogLoaded,
  subscribeExtendedCatalog,
  type GifDbItem,
} from '../src/extended-catalog.ts';

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
  const [start, end] = exerciseImages(squat) ?? [];
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

test('extended catalog maps gifdb items, dedupes, and joins matching + search', () => {
  const before = allExercises().length;
  const items: GifDbItem[] = [
    {
      id: 'abs/dead-bug',
      slug: 'dead-bug',
      name: 'Dead Bug',
      muscle: 'abs',
      bodyPart: 'core',
      equipment: 'bodyweight',
      category: 'strength',
      secondaryMuscles: [],
    },
    {
      id: 'hamstrings/runners-stretch',
      slug: 'runners-stretch',
      name: 'Runners Stretch',
      muscle: 'hamstrings',
      equipment: 'bodyweight',
      category: 'stretching',
    },
    {
      id: 'cardio/jump-rope',
      slug: 'jump-rope',
      name: 'Jump Rope',
      muscle: 'cardio',
      equipment: 'bodyweight',
      category: 'cardio',
      secondaryMuscles: ['calves'],
    },
    {
      // Same gif as the curated entry → skipped.
      id: 'quads/lever-leg-extension',
      slug: 'lever-leg-extension',
      name: 'Lever Leg Extension',
      muscle: 'quads',
      equipment: 'lever',
      category: 'strength',
    },
    {
      // Same name as a curated exercise → skipped.
      id: 'biceps/barbell-curl',
      slug: 'barbell-curl',
      name: 'Barbell Curl',
      muscle: 'biceps',
      equipment: 'barbell',
      category: 'strength',
    },
  ];

  const added = applyExtendedCatalog(items);
  assert.equal(added.length, 3, 'curated duplicates must be dropped');
  assert.equal(allExercises().length, before + 3);
  assert.equal(extendedExercises(), added);
  assert.ok(isExtendedCatalogLoaded());

  // Taxonomy mapping: group, equipment, muscles, gif reference.
  const deadBug = added.find((e) => e.id === 'abs/dead-bug')!;
  assert.equal(deadBug.group, 'core');
  assert.equal(deadBug.equipment, 'body');
  assert.deepEqual(deadBug.muscles, ['abdominals']);
  assert.ok(deadBug.extended);
  assert.equal(exerciseGifUrl(deadBug, 'full'), `${EXERCISE_GIF_BASE}/abs/dead-bug.gif`);
  assert.equal(
    added.find((e) => e.name === 'Runners Stretch')!.group,
    'mobility',
    'stretching category overrides the muscle group',
  );
  const jumpRope = added.find((e) => e.name === 'Jump Rope')!;
  assert.equal(jumpRope.group, 'conditioning');
  assert.deepEqual(jumpRope.muscles, ['quadriceps', 'calves'], 'secondary muscles mapped on');

  // Matching and search cover extended entries, curated names still win.
  assert.equal(matchExercise('Dead Bug')?.id, 'abs/dead-bug');
  assert.equal(matchExercise('deadbug')?.id, 'abs/dead-bug', 'compact match');
  assert.ok(searchExercises('dead bug', 10).some((e) => e.id === 'abs/dead-bug'));
  assert.ok(searchExercises('stretch', 10).some((e) => e.id === 'hamstrings/runners-stretch'));
  assert.equal(
    matchExercise('Barbell Curl')?.id,
    'Barbell_Curl',
    'curated beats extended on names',
  );
  assert.equal(matchExercise('Lever Leg Extension'), null, 'deduped item is not registered');

  // Extended entries: no photo frames, how-tos come from the gif database.
  assert.equal(exerciseImages(deadBug), null);
  assert.equal(
    exerciseInstructionsUrl(deadBug),
    `${EXERCISE_GIF_BASE}/api/en/exercises/abs/dead-bug.json`,
  );
});

test('extended catalog subscriptions fire and can unsubscribe', () => {
  let calls = 0;
  const unsubscribe = subscribeExtendedCatalog(() => {
    calls += 1;
  });
  applyExtendedCatalog([]);
  assert.equal(calls, 1);
  applyExtendedCatalog([]);
  assert.equal(calls, 2);
  unsubscribe();
  applyExtendedCatalog([]);
  assert.equal(calls, 2, 'no notifications after unsubscribe');
  assert.equal(extendedExerciseCount(), 0);
});

test('search tolerates typos below exact matches', () => {
  const bech = searchExercises('bech press');
  assert.ok(
    bech.some((e) => e.id === 'Barbell_Bench_Press_-_Medium_Grip'),
    'bech press still finds the bench press',
  );
  const dumbel = searchExercises('dumbel curl');
  assert.ok(
    dumbel.some((e) => e.name.toLowerCase().includes('dumbbell')),
    'dumbel curl finds a dumbbell curl',
  );
  // Exact text still outranks fuzzy text.
  assert.equal(searchExercises('bench press')[0]?.id, 'Barbell_Bench_Press_-_Medium_Grip');
});

test('search understands gym slang and cross-field queries', () => {
  const quads = searchExercises('quads');
  assert.ok(quads.length > 0);
  assert.ok(
    quads.every((e) => e.muscles.includes('quadriceps' as ExerciseMuscle)),
    'quads only returns quad movements',
  );
  const cardio = searchExercises('cardio', 20);
  assert.ok(cardio.length > 0);
  assert.ok(
    cardio.every(
      (e) => e.group === 'conditioning' || e.equipment === 'pool' || e.equipment === 'running',
    ),
    'cardio only returns conditioning movements',
  );
  const cross = searchExercises('dumbbell chest');
  assert.ok(
    cross.some((e) => e.id === 'Dumbbell_Bench_Press'),
    'dumbbell chest finds the dumbbell bench press',
  );
});

test('search leads with recent lifts when provided', () => {
  const withRecents = searchExercises('', 8, { recentNames: ['Lat Pulldown', 'Deadlift'] });
  assert.equal(withRecents[0]?.name, 'Lat Pulldown');
  assert.equal(withRecents[1]?.name, 'Deadlift');
  // Unknown recent names are skipped, not fatal.
  const unknown = searchExercises('', 8, { recentNames: ['Not A Lift'] });
  assert.ok(unknown.every((e) => e.popular));
});

test('cardio machines log distance, not load', () => {
  assert.equal(measureForExerciseName('Cycling'), 'distance');
  assert.equal(measureForExerciseName('Stationary Bike'), 'distance');
  assert.equal(measureForExerciseName('Elliptical'), 'distance');
  assert.equal(measureForExerciseName('Stairmaster'), 'distance');
  assert.equal(measureForExerciseName('Morning run'), 'distance');
  assert.equal(measureForExerciseName('Barbell Row'), 'weight');
  assert.equal(measureForExerciseName("Farmer's Walk"), 'weight');
});
