/**
 * SmartFit exercise catalog.
 *
 * A curated, shared library of common gym movements — the bridge between
 * "a string the user typed" and a movement that can be searched, filtered
 * and illustrated. Each entry maps to the open free-exercise-db dataset
 * (Unlicense), whose per-exercise demonstration photos are served from a
 * public CDN: two frames per movement (start & end position) that the apps
 * crossfade for a GIF-like preview.
 *
 * Every id below has been verified to exist upstream, so the CDN URLs are
 * safe to build at runtime. Extend by adding entries whose id matches an
 * upstream folder (see https://github.com/yuhonas/free-exercise-db).
 *
 * On top of the photos, most entries also carry a curated `gif` reference to
 * an animated ExerciseDB-style demonstration (illustrated figure with the
 * target muscle highlighted in red), served from the ExerciseGymGifsDB CDN
 * mirror. Those GIFs are ExerciseDB artwork — fine for personal use, but
 * commercial redistribution needs a license from exercisedb.com. Entries
 * without a `gif` keep the two-frame photo preview.
 */

export type ExerciseEquipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'body'
  | 'kettlebell'
  | 'band'
  | 'ez-bar'
  | 'pool'
  | 'running'
  | 'other';

export type ExerciseMuscle =
  | 'chest'
  | 'lats'
  | 'middle back'
  | 'lower back'
  | 'traps'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abdominals'
  | 'glutes'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves';

export interface ExerciseCatalogEntry {
  /** free-exercise-db id — also the folder its demo frames live in. */
  id: string;
  /** Canonical display name. */
  name: string;
  /** Alternative spellings people actually type; matched by the picker. */
  aliases?: string[];
  /** Primary muscle first, then synergists. */
  muscles: ExerciseMuscle[];
  equipment: ExerciseEquipment;
  /**
   * What a set of this movement logs: load × reps (default) or a distance
   * in metres (pool + running). The runner swaps its weight input for a
   * metres input when `exerciseMeasure` resolves to 'distance'.
   */
  measure?: 'weight' | 'distance';
  /** Marquee lifts surfaced when the picker is opened without a query. */
  popular?: boolean;
  /** Browse section in the exercise library (chips on /plan, mobile plan tab). */
  group: ExerciseGroup;
  /**
   * Curated animated demo (ExerciseDB-style GIF): muscle folder + slug on the
   * ExerciseGymGifsDB CDN mirror. Optional — entries without one fall back to
   * the two-frame demo photos.
   */
  gif?: { muscle: string; slug: string };
  /**
   * Curated step-by-step how-to, preferred over fetching the upstream
   * dataset — covers movements with no upstream page (pool/running) and
   * works offline.
   */
  instructions?: string[];
  /** True for runtime-loaded entries from the full ExerciseGymGifsDB catalog. */
  extended?: true;
}

/** CDN base for the demonstration frames (jsDelivr mirrors the GitHub repo). */
export const EXERCISE_IMAGE_BASE =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';

/**
 * The subset of the upstream per-exercise JSON the apps consume. Fetched
 * lazily (same CDN as the demo frames) when a user asks "how do I do this?".
 */
export interface ExerciseUpstream {
  instructions?: string[];
  level?: 'beginner' | 'intermediate' | 'advanced' | string;
  mechanic?: 'compound' | 'isolation' | string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
}

/**
 * URL of the upstream per-exercise JSON (instructions, level, muscles…).
 * Extended entries are documented by the gif database itself.
 */
export function exerciseInstructionsUrl(entry: ExerciseCatalogEntry): string {
  if (entry.extended && entry.gif) {
    return `${EXERCISE_GIF_BASE}/api/en/exercises/${entry.gif.muscle}/${entry.gif.slug}.json`;
  }
  return `${EXERCISE_IMAGE_BASE}/${entry.id}.json`;
}

/** Demo frame URLs for an entry: [start, end] — null for extended entries. */
export function exerciseImages(entry: ExerciseCatalogEntry): [string, string] | null {
  if (entry.extended) return null; // gif-database entries have no photo frames
  return [`${EXERCISE_IMAGE_BASE}/${entry.id}/0.jpg`, `${EXERCISE_IMAGE_BASE}/${entry.id}/1.jpg`];
}

/**
 * CDN base for the curated animated demos (jsDelivr mirrors the
 * ExerciseGymGifsDB repo — 1,323 ExerciseDB-style GIFs with `.thumb.webp`
 * animated 128px variants). ExerciseDB artwork: personal use only.
 */
export const EXERCISE_GIF_BASE =
  'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.2.0';

/** Size of the animated demo: light tile thumb or the full-size GIF. */
export type ExerciseGifVariant = 'thumb' | 'full';

/**
 * Animated looping GIF URL for an entry, when one is curated.
 *
 * - `thumb` — 128px animated WebP (~18KB): grids, pickers, session rows.
 * - `full` — full-size GIF (~275KB): the how-to dialog.
 *
 * Returns null when the entry has no curated gif; callers then fall back to
 * the two-frame photos from exerciseImages().
 */
export function exerciseGifUrl(
  entry: ExerciseCatalogEntry,
  variant: ExerciseGifVariant = 'thumb',
): string | null {
  if (!entry.gif) return null;
  const file = variant === 'thumb' ? `${entry.gif.slug}.thumb.webp` : `${entry.gif.slug}.gif`;
  return `${EXERCISE_GIF_BASE}/${entry.gif.muscle}/${file}`;
}

export const EXERCISE_MUSCLE_LABELS: Record<ExerciseMuscle, string> = {
  chest: 'Chest',
  lats: 'Lats',
  'middle back': 'Mid Back',
  'lower back': 'Lower Back',
  traps: 'Traps',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abdominals: 'Core',
  glutes: 'Glutes',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
};

/** Browse grouping used by the exercise library UIs (web & mobile). */
export type ExerciseGroup =
  'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'conditioning' | 'mobility';

export const EXERCISE_GROUPS: { id: ExerciseGroup; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'mobility', label: 'Mobility' },
];

export const EXERCISE_EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  body: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  'ez-bar': 'EZ-Bar',
  pool: 'Pool',
  running: 'Running',
  other: 'Other',
};

/**
 * The catalog. Ordered canonically within each muscle group — the first
 * entry of a family ("Bench Press", "Squat", "Row"…) is the variant a
 * plain-typed history entry should resolve to.
 */
export const EXERCISES: ExerciseCatalogEntry[] = [
  // ── Chest ────────────────────────────────────────────────────────────────
  {
    id: 'Barbell_Bench_Press_-_Medium_Grip',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'barbell-bench-press' },
    name: 'Barbell Bench Press',
    aliases: ['bench press', 'flat bench press', 'barbell bench'],
    muscles: ['chest', 'triceps', 'shoulders'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Dumbbell_Bench_Press',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'dumbbell-bench-press' },
    name: 'Dumbbell Bench Press',
    aliases: ['db bench press'],
    muscles: ['chest', 'triceps', 'shoulders'],
    equipment: 'dumbbell',
    popular: true,
  },
  {
    id: 'Incline_Dumbbell_Press',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'dumbbell-incline-bench-press' },
    name: 'Incline Dumbbell Press',
    aliases: ['incline db press', 'incline dumbbell bench press'],
    muscles: ['chest', 'shoulders', 'triceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'barbell-incline-bench-press' },
    name: 'Incline Barbell Bench Press',
    aliases: ['incline bench press'],
    muscles: ['chest', 'shoulders', 'triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Decline_Barbell_Bench_Press',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'barbell-decline-bench-press' },
    name: 'Decline Barbell Bench Press',
    aliases: ['decline bench press'],
    muscles: ['chest', 'triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Flyes',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'dumbbell-fly' },
    name: 'Dumbbell Flyes',
    aliases: ['dumbbell fly', 'db flyes', 'flat dumbbell flyes'],
    muscles: ['chest'],
    equipment: 'dumbbell',
  },
  {
    id: 'Incline_Dumbbell_Flyes',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'dumbbell-incline-fly' },
    name: 'Incline Dumbbell Flyes',
    aliases: ['incline flyes'],
    muscles: ['chest'],
    equipment: 'dumbbell',
  },
  {
    id: 'Cable_Crossover',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'cable-standing-up-straight-crossovers' },
    name: 'Cable Crossover',
    aliases: ['cable cross over', 'cable flyes'],
    muscles: ['chest'],
    equipment: 'cable',
  },
  {
    id: 'Machine_Bench_Press',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'lever-chest-press' },
    name: 'Machine Bench Press',
    aliases: ['chest press machine', 'seated chest press'],
    muscles: ['chest', 'triceps'],
    equipment: 'machine',
  },
  {
    id: 'Dips_-_Chest_Version',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'chest-dip' },
    name: 'Chest Dips',
    aliases: ['dips', 'dips chest version', 'gymnastic dips'],
    muscles: ['chest', 'triceps'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Pushups',
    group: 'chest',
    gif: { muscle: 'pectorals', slug: 'push-up' },
    name: 'Pushups',
    aliases: ['push-up', 'push up', 'press up', 'press-ups'],
    muscles: ['chest', 'triceps'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Bodyweight_Flyes',
    group: 'chest',
    name: 'Bodyweight Flyes',
    muscles: ['chest'],
    equipment: 'body',
  },

  // ── Back ─────────────────────────────────────────────────────────────────
  {
    id: 'Barbell_Deadlift',
    group: 'back',
    gif: { muscle: 'glutes', slug: 'barbell-deadlift' },
    name: 'Deadlift',
    aliases: ['barbell deadlift', 'conventional deadlift', 'deadlifts'],
    muscles: ['lower back', 'hamstrings', 'glutes', 'traps'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Romanian_Deadlift',
    group: 'back',
    gif: { muscle: 'glutes', slug: 'barbell-romanian-deadlift' },
    name: 'Romanian Deadlift',
    aliases: ['rdl', 'rumanian deadlift'],
    muscles: ['hamstrings', 'glutes', 'lower back'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Sumo_Deadlift',
    group: 'back',
    gif: { muscle: 'glutes', slug: 'barbell-sumo-deadlift' },
    name: 'Sumo Deadlift',
    muscles: ['lower back', 'glutes', 'quadriceps'],
    equipment: 'barbell',
  },
  {
    id: 'Good_Morning',
    group: 'back',
    gif: { muscle: 'glutes', slug: 'barbell-stiff-leg-good-morning' },
    name: 'Good Morning',
    muscles: ['lower back', 'hamstrings', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Pullups',
    group: 'back',
    gif: { muscle: 'lats', slug: 'pull-up' },
    name: 'Pull-Ups',
    aliases: ['pull-up', 'pull up', 'pullups', 'pull ups'],
    muscles: ['lats', 'biceps', 'middle back'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Chin-Up',
    group: 'back',
    gif: { muscle: 'lats', slug: 'chin-up' },
    name: 'Chin-Ups',
    aliases: ['chin up', 'chin ups', 'chinups'],
    muscles: ['lats', 'biceps'],
    equipment: 'body',
  },
  {
    id: 'Band_Assisted_Pull-Up',
    group: 'back',
    gif: { muscle: 'lats', slug: 'band-assisted-pull-up' },
    name: 'Band-Assisted Pull-Up',
    aliases: ['assisted pull-up', 'assisted pull up'],
    muscles: ['lats', 'biceps'],
    equipment: 'band',
  },
  {
    id: 'Close-Grip_Front_Lat_Pulldown',
    group: 'back',
    gif: { muscle: 'lats', slug: 'cable-lat-pulldown-full-range-of-motion' },
    name: 'Lat Pulldown',
    aliases: ['close grip lat pulldown', 'front lat pulldown', 'lat pull down'],
    muscles: ['lats', 'biceps'],
    equipment: 'cable',
    popular: true,
  },
  {
    id: 'Wide-Grip_Lat_Pulldown',
    group: 'back',
    gif: { muscle: 'lats', slug: 'cable-pulldown' },
    name: 'Wide-Grip Lat Pulldown',
    aliases: ['wide lat pulldown'],
    muscles: ['lats', 'biceps'],
    equipment: 'cable',
  },
  {
    id: 'V-Bar_Pulldown',
    group: 'back',
    gif: { muscle: 'lats', slug: 'cable-lateral-pulldown-with-v-bar' },
    name: 'V-Bar Pulldown',
    muscles: ['lats', 'biceps'],
    equipment: 'cable',
  },
  {
    id: 'Straight-Arm_Pulldown',
    group: 'back',
    gif: { muscle: 'lats', slug: 'cable-straight-arm-pulldown' },
    name: 'Straight-Arm Pulldown',
    muscles: ['lats'],
    equipment: 'cable',
  },
  {
    id: 'Bent_Over_Barbell_Row',
    group: 'back',
    gif: { muscle: 'upper-back', slug: 'barbell-bent-over-row' },
    name: 'Barbell Row',
    aliases: ['bent over row', 'bent over barbell row', 'barbell bent over row'],
    muscles: ['middle back', 'lats', 'biceps'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Bent_Over_Two-Dumbbell_Row',
    group: 'back',
    gif: { muscle: 'upper-back', slug: 'dumbbell-bent-over-row' },
    name: 'Dumbbell Row',
    aliases: ['bent over dumbbell row', 'two dumbbell row', 'db row'],
    muscles: ['middle back', 'lats', 'biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'One-Arm_Dumbbell_Row',
    group: 'back',
    gif: { muscle: 'upper-back', slug: 'dumbbell-one-arm-bent-over-row' },
    name: 'One-Arm Dumbbell Row',
    aliases: ['single arm dumbbell row', 'one arm row'],
    muscles: ['lats', 'middle back', 'biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Seated_Cable_Rows',
    group: 'back',
    gif: { muscle: 'upper-back', slug: 'cable-seated-row' },
    name: 'Seated Cable Row',
    aliases: ['seated row', 'cable row', 'seated cable rows'],
    muscles: ['middle back', 'lats', 'biceps'],
    equipment: 'cable',
  },
  {
    id: 'Bent-Arm_Dumbbell_Pullover',
    group: 'back',
    gif: { muscle: 'lats', slug: 'ez-bar-lying-bent-arms-pullover' },
    name: 'Dumbbell Pullover',
    aliases: ['db pullover', 'bent arm dumbbell pullover'],
    muscles: ['chest', 'lats'],
    equipment: 'dumbbell',
  },
  {
    id: 'Face_Pull',
    group: 'back',
    gif: { muscle: 'delts', slug: 'cable-rear-delt-row-with-rope' },
    name: 'Face Pull',
    muscles: ['shoulders', 'traps'],
    equipment: 'cable',
  },

  // ── Quads & legs ─────────────────────────────────────────────────────────
  {
    id: 'Barbell_Squat',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-high-bar-squat' },
    name: 'Barbell Squat',
    aliases: ['squat', 'back squat', 'barbell back squat', 'squats'],
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Barbell_Full_Squat',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-full-squat' },
    name: 'Full Squat',
    aliases: ['olympic squat', 'deep squat'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Goblet_Squat',
    group: 'legs',
    gif: { muscle: 'quads', slug: 'dumbbell-goblet-squat' },
    name: 'Goblet Squat',
    muscles: ['quadriceps', 'glutes'],
    equipment: 'dumbbell',
  },
  {
    id: 'Hack_Squat',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'sled-hack-squat' },
    name: 'Hack Squat',
    muscles: ['quadriceps'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Hack_Squat',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-hack-squat' },
    name: 'Barbell Hack Squat',
    muscles: ['quadriceps'],
    equipment: 'barbell',
  },
  {
    id: 'Leg_Press',
    group: 'legs',
    gif: { muscle: 'quads', slug: 'lever-alternate-leg-press' },
    name: 'Leg Press',
    muscles: ['quadriceps', 'glutes'],
    equipment: 'machine',
  },
  {
    id: 'Leg_Extensions',
    group: 'legs',
    gif: { muscle: 'quads', slug: 'lever-leg-extension' },
    name: 'Leg Extension',
    aliases: ['leg extensions', 'leg extensions machine'],
    muscles: ['quadriceps'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Lunge',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-lunge' },
    name: 'Barbell Lunge',
    aliases: ['lunge', 'lunges', 'barbell lunges'],
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Lunges',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'dumbbell-lunge' },
    name: 'Dumbbell Lunge',
    aliases: ['dumbbell lunges', 'db lunge'],
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: 'dumbbell',
  },
  {
    id: 'Barbell_Walking_Lunge',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-rear-lunge' },
    name: 'Barbell Walking Lunge',
    aliases: ['walking lunge', 'walking lunges'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Bodyweight_Walking_Lunge',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'walking-lunge' },
    name: 'Bodyweight Walking Lunge',
    muscles: ['quadriceps', 'glutes'],
    equipment: 'body',
  },
  {
    id: 'Bodyweight_Squat',
    group: 'legs',
    name: 'Bodyweight Squat',
    aliases: ['air squat', 'air squats', 'bw squat'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'body',
  },
  {
    id: 'Barbell_Step_Ups',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-step-up' },
    name: 'Barbell Step-Ups',
    aliases: ['barbell step up', 'step ups barbell'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Step_Ups',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'dumbbell-step-up' },
    name: 'Dumbbell Step-Ups',
    aliases: ['dumbbell step up', 'step ups'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'dumbbell',
  },

  // ── Hamstrings, glutes & calves ──────────────────────────────────────────
  {
    id: 'Lying_Leg_Curls',
    group: 'legs',
    gif: { muscle: 'hamstrings', slug: 'lever-lying-leg-curl' },
    name: 'Lying Leg Curl',
    aliases: ['lying leg curls', 'leg curl', 'hamstring curl'],
    muscles: ['hamstrings'],
    equipment: 'machine',
  },
  {
    id: 'Seated_Leg_Curl',
    group: 'legs',
    gif: { muscle: 'hamstrings', slug: 'lever-seated-leg-curl' },
    name: 'Seated Leg Curl',
    muscles: ['hamstrings'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Glute_Bridge',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-glute-bridge' },
    name: 'Barbell Glute Bridge',
    aliases: ['glute bridge', 'barbell bridge'],
    muscles: ['glutes', 'hamstrings'],
    equipment: 'barbell',
  },
  {
    id: 'Barbell_Hip_Thrust',
    group: 'legs',
    gif: { muscle: 'glutes', slug: 'barbell-glute-bridge-two-legs-on-bench-male' },
    name: 'Hip Thrust',
    aliases: ['barbell hip thrust', 'hip thrusts'],
    muscles: ['glutes', 'hamstrings'],
    equipment: 'barbell',
  },
  {
    id: 'Glute_Kickback',
    group: 'legs',
    name: 'Cable Glute Kickback',
    aliases: ['glute kickback', 'cable kickback'],
    muscles: ['glutes'],
    equipment: 'cable',
  },
  {
    id: 'Standing_Calf_Raises',
    group: 'legs',
    gif: { muscle: 'calves', slug: 'lever-standing-calf-raise' },
    name: 'Standing Calf Raise',
    aliases: ['standing calf raises', 'calf raise', 'calf raises'],
    muscles: ['calves'],
    equipment: 'machine',
  },
  {
    id: 'Seated_Calf_Raise',
    group: 'legs',
    gif: { muscle: 'calves', slug: 'lever-seated-calf-raise' },
    name: 'Seated Calf Raise',
    muscles: ['calves'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Seated_Calf_Raise',
    group: 'legs',
    gif: { muscle: 'calves', slug: 'barbell-seated-calf-raise' },
    name: 'Barbell Seated Calf Raise',
    muscles: ['calves'],
    equipment: 'barbell',
  },
  {
    id: 'Calf_Press',
    group: 'legs',
    gif: { muscle: 'calves', slug: 'lever-calf-press' },
    name: 'Calf Press',
    aliases: ['calf press on leg press'],
    muscles: ['calves'],
    equipment: 'machine',
  },

  // ── Shoulders & traps ────────────────────────────────────────────────────
  {
    id: 'Barbell_Shoulder_Press',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'barbell-seated-overhead-press' },
    name: 'Barbell Shoulder Press',
    aliases: ['overhead press', 'ohp', 'standing barbell press'],
    muscles: ['shoulders', 'triceps'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Standing_Military_Press',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'barbell-standing-close-grip-military-press' },
    name: 'Military Press',
    aliases: ['standing military press', 'strict press'],
    muscles: ['shoulders', 'triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Shoulder_Press',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'dumbbell-seated-shoulder-press' },
    name: 'Dumbbell Shoulder Press',
    aliases: ['db shoulder press', 'seated dumbbell press'],
    muscles: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
    popular: true,
  },
  {
    id: 'Standing_Dumbbell_Press',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'dumbbell-standing-overhead-press' },
    name: 'Standing Dumbbell Press',
    muscles: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Arnold_Dumbbell_Press',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'dumbbell-arnold-press' },
    name: 'Arnold Press',
    aliases: ['arnold dumbbell press'],
    muscles: ['shoulders'],
    equipment: 'dumbbell',
  },
  {
    id: 'Side_Lateral_Raise',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'dumbbell-lateral-raise' },
    name: 'Lateral Raise',
    aliases: ['side lateral raise', 'dumbbell lateral raise', 'lat raise'],
    muscles: ['shoulders'],
    equipment: 'dumbbell',
    popular: true,
  },
  {
    id: 'Front_Dumbbell_Raise',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'dumbbell-front-raise' },
    name: 'Front Raise',
    aliases: ['front dumbbell raise', 'dumbbell front raise'],
    muscles: ['shoulders'],
    equipment: 'dumbbell',
  },
  {
    id: 'Reverse_Flyes',
    group: 'shoulders',
    gif: { muscle: 'delts', slug: 'dumbbell-rear-lateral-raise' },
    name: 'Reverse Flyes',
    aliases: ['rear delt fly', 'rear delt flyes', 'reverse fly'],
    muscles: ['shoulders', 'middle back'],
    equipment: 'dumbbell',
  },
  {
    id: 'Barbell_Shrug',
    group: 'shoulders',
    gif: { muscle: 'traps', slug: 'barbell-shrug' },
    name: 'Barbell Shrug',
    aliases: ['shrug', 'shrugs', 'barbell shrugs'],
    muscles: ['traps'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Shrug',
    group: 'shoulders',
    gif: { muscle: 'traps', slug: 'dumbbell-shrug' },
    name: 'Dumbbell Shrug',
    aliases: ['dumbbell shrugs', 'db shrug'],
    muscles: ['traps'],
    equipment: 'dumbbell',
  },

  // ── Biceps & forearms ────────────────────────────────────────────────────
  {
    id: 'Barbell_Curl',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'barbell-curl' },
    name: 'Barbell Curl',
    aliases: ['barbell bicep curl', 'standing barbell curl', 'bicep curl'],
    muscles: ['biceps', 'forearms'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'EZ-Bar_Curl',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'ez-barbell-curl' },
    name: 'EZ-Bar Curl',
    aliases: ['ez bar curl', 'ez curl'],
    muscles: ['biceps', 'forearms'],
    equipment: 'ez-bar',
  },
  {
    id: 'Wide-Grip_Standing_Barbell_Curl',
    group: 'arms',
    name: 'Wide-Grip Barbell Curl',
    muscles: ['biceps'],
    equipment: 'barbell',
  },
  {
    id: 'Alternate_Dumbbell_Curl',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'dumbbell-alternate-biceps-curl' },
    name: 'Alternating Dumbbell Curl',
    aliases: ['alternate dumbbell curl', 'alternating db curl'],
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Seated_Dumbbell_Curl',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'dumbbell-seated-bicep-curl' },
    name: 'Seated Dumbbell Curl',
    aliases: ['dumbbell curl', 'db curl', 'seated db curl'],
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Incline_Dumbbell_Curl',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'dumbbell-incline-curl' },
    name: 'Incline Dumbbell Curl',
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Alternate_Hammer_Curl',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'dumbbell-hammer-curl' },
    name: 'Hammer Curl',
    aliases: ['hammer curls', 'alternate hammer curl', 'neutral grip curl'],
    muscles: ['biceps', 'forearms'],
    equipment: 'dumbbell',
  },
  {
    id: 'Preacher_Curl',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'dumbbell-preacher-curl' },
    name: 'Preacher Curl',
    aliases: ['preacher curls'],
    muscles: ['biceps'],
    equipment: 'ez-bar',
  },
  {
    id: 'Concentration_Curls',
    group: 'arms',
    gif: { muscle: 'biceps', slug: 'dumbbell-concentration-curl' },
    name: 'Concentration Curl',
    aliases: ['concentration curls'],
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },

  // ── Triceps ──────────────────────────────────────────────────────────────
  {
    id: 'Close-Grip_Barbell_Bench_Press',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'barbell-close-grip-bench-press' },
    name: 'Close-Grip Bench Press',
    aliases: ['close grip bench', 'close grip bench press', 'cg bench'],
    muscles: ['triceps', 'chest'],
    equipment: 'barbell',
  },
  {
    id: 'Dips_-_Triceps_Version',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'triceps-dip' },
    name: 'Triceps Dips',
    aliases: ['tricep dips', 'dips triceps version'],
    muscles: ['triceps', 'chest'],
    equipment: 'body',
  },
  {
    id: 'Bench_Dips',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'weighted-bench-dip' },
    name: 'Bench Dips',
    muscles: ['triceps'],
    equipment: 'body',
  },
  {
    id: 'Triceps_Pushdown',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'cable-pushdown' },
    name: 'Triceps Pushdown',
    aliases: ['tricep pushdown', 'cable pushdown', 'triceps pushdowns', 'pushdown'],
    muscles: ['triceps'],
    equipment: 'cable',
    popular: true,
  },
  {
    id: 'EZ-Bar_Skullcrusher',
    group: 'arms',
    name: 'Skullcrusher',
    aliases: ['skull crusher', 'skull crushers', 'ez bar skullcrusher', 'lying extension'],
    muscles: ['triceps'],
    equipment: 'ez-bar',
  },
  {
    id: 'Lying_Triceps_Press',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'barbell-lying-triceps-extension' },
    name: 'Lying Triceps Extension',
    aliases: ['lying triceps press'],
    muscles: ['triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Standing_Overhead_Barbell_Triceps_Extension',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'barbell-standing-overhead-triceps-extension' },
    name: 'Overhead Barbell Extension',
    aliases: ['standing overhead barbell triceps extension', 'french press'],
    muscles: ['triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Standing_Dumbbell_Triceps_Extension',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'dumbbell-standing-triceps-extension' },
    name: 'Overhead Dumbbell Extension',
    aliases: [
      'standing dumbbell triceps extension',
      'overhead triceps extension',
      'dumbbell overhead extension',
    ],
    muscles: ['triceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Seated_Triceps_Press',
    group: 'arms',
    gif: { muscle: 'triceps', slug: 'dumbbell-seated-triceps-extension' },
    name: 'Seated Triceps Press',
    muscles: ['triceps'],
    equipment: 'dumbbell',
  },

  // ── Core ─────────────────────────────────────────────────────────────────
  {
    id: 'Plank',
    group: 'core',
    name: 'Plank',
    aliases: ['front plank', 'planking'],
    muscles: ['abdominals'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Crunches',
    group: 'core',
    gif: { muscle: 'abs', slug: 'crunch-floor' },
    name: 'Crunches',
    aliases: ['crunch', 'ab crunch', 'sit up', 'sit-ups'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Hanging_Leg_Raise',
    group: 'core',
    gif: { muscle: 'abs', slug: 'hanging-leg-raise' },
    name: 'Hanging Leg Raise',
    aliases: ['hanging leg raises', 'hanging knee raise'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Russian_Twist',
    group: 'core',
    gif: { muscle: 'abs', slug: 'russian-twist' },
    name: 'Russian Twist',
    aliases: ['russian twists'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Air_Bike',
    group: 'core',
    gif: { muscle: 'abs', slug: 'air-bike' },
    name: 'Bicycle Crunch',
    aliases: ['air bike', 'bicycle crunches', 'criss cross'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Cable_Crunch',
    group: 'core',
    gif: { muscle: 'abs', slug: 'cable-kneeling-crunch' },
    name: 'Cable Crunch',
    aliases: ['rope crunch', 'cable crunches'],
    muscles: ['abdominals'],
    equipment: 'cable',
  },
  {
    id: 'Exercise_Ball_Crunch',
    group: 'core',
    gif: { muscle: 'abs', slug: 'crunch-on-stability-ball' },
    name: 'Exercise Ball Crunch',
    aliases: ['swiss ball crunch', 'stability ball crunch'],
    muscles: ['abdominals'],
    equipment: 'other',
  },
  {
    id: 'Ab_Crunch_Machine',
    group: 'core',
    gif: { muscle: 'abs', slug: 'lever-seated-crunch' },
    name: 'Ab Crunch Machine',
    muscles: ['abdominals'],
    equipment: 'machine',
  },
  {
    id: 'Ab_Roller',
    group: 'core',
    name: 'Ab Roller',
    aliases: ['ab wheel', 'ab wheel rollout'],
    muscles: ['abdominals'],
    equipment: 'other',
  },
  {
    id: 'Barbell_Ab_Rollout',
    group: 'core',
    name: 'Barbell Ab Rollout',
    aliases: ['barbell rollout', 'ab rollout'],
    muscles: ['abdominals'],
    equipment: 'barbell',
  },
  {
    id: '3_4_Sit-Up',
    group: 'core',
    gif: { muscle: 'abs', slug: '3-4-sit-up' },
    name: '3/4 Sit-Up',
    aliases: ['sit up', 'situps'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Barbell_Side_Bend',
    group: 'core',
    gif: { muscle: 'abs', slug: 'dumbbell-side-bend' },
    name: 'Barbell Side Bend',
    aliases: ['side bend', 'side bends'],
    muscles: ['abdominals'],
    equipment: 'barbell',
  },

  // ── Conditioning & machines ──────────────────────────────────────────────
  {
    id: 'Kettlebell_Swing',
    group: 'conditioning',
    gif: { muscle: 'glutes', slug: 'kettlebell-swing' },
    name: 'Kettlebell Swing',
    aliases: ['kb swing', 'kettlebell swings'],
    muscles: ['glutes', 'hamstrings', 'shoulders'],
    equipment: 'kettlebell',
    popular: true,
  },
  {
    id: 'Battling_Ropes',
    group: 'conditioning',
    gif: { muscle: 'delts', slug: 'battling-ropes' },
    name: 'Battle Ropes',
    aliases: ['battling ropes', 'battle rope'],
    muscles: ['shoulders', 'abdominals'],
    equipment: 'other',
  },
  {
    id: 'Mountain_Climbers',
    group: 'conditioning',
    gif: { muscle: 'cardio', slug: 'mountain-climber' },
    name: 'Mountain Climbers',
    aliases: ['mountain climber'],
    muscles: ['abdominals', 'quadriceps'],
    equipment: 'body',
  },
  {
    id: 'Box_Jump_Multiple_Response',
    group: 'conditioning',
    name: 'Box Jump',
    aliases: ['box jumps', 'box jump multiple response'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'body',
  },
  {
    id: 'Clean_and_Jerk',
    group: 'conditioning',
    gif: { muscle: 'quads', slug: 'barbell-clean-and-press' },
    name: 'Clean & Jerk',
    aliases: ['clean and jerk'],
    muscles: ['quadriceps', 'shoulders', 'lower back'],
    equipment: 'barbell',
  },
  {
    id: 'Power_Clean',
    group: 'conditioning',
    gif: { muscle: 'hamstrings', slug: 'power-clean' },
    name: 'Power Clean',
    aliases: ['power cleans'],
    muscles: ['quadriceps', 'shoulders', 'lower back'],
    equipment: 'barbell',
  },
  {
    id: 'Bicycling',
    group: 'conditioning',
    name: 'Cycling',
    aliases: ['bicycling', 'bike', 'biking'],
    muscles: ['quadriceps'],
    equipment: 'body',
    measure: 'distance',
  },
  {
    id: 'Bicycling_Stationary',
    group: 'conditioning',
    gif: { muscle: 'cardio', slug: 'stationary-bike-run-v-3' },
    name: 'Stationary Bike',
    aliases: ['bicycling stationary', 'exercise bike', 'spin bike'],
    muscles: ['quadriceps'],
    equipment: 'machine',
    measure: 'distance',
  },
  {
    id: 'Elliptical_Trainer',
    group: 'conditioning',
    gif: { muscle: 'cardio', slug: 'walk-elliptical-cross-trainer' },
    name: 'Elliptical',
    aliases: ['elliptical trainer', 'cross trainer'],
    muscles: ['quadriceps'],
    equipment: 'machine',
    measure: 'distance',
  },
  {
    id: 'Stairmaster',
    group: 'conditioning',
    gif: { muscle: 'cardio', slug: 'walking-on-stepmill' },
    name: 'Stairmaster',
    aliases: ['stair master', 'stair climber', 'stepper'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'machine',
    measure: 'distance',
  },

  // ── Pool & running: distance-measured conditioning ────────────────────────
  // These have no upstream photo pages, so each carries curated instructions
  // and the tiles fall back to the neutral dumbbell artwork.
  {
    id: 'pool-freestyle-swim',
    group: 'conditioning',
    name: 'Freestyle Swim',
    aliases: ['front crawl', 'swimming', 'freestyle swimming', 'piscine'],
    muscles: ['lats', 'shoulders'],
    equipment: 'pool',
    measure: 'distance',
    popular: true,
    instructions: [
      'Push off the wall face-down, body long and level with the surface.',
      'Alternate long arm strokes, rotating your hips and shoulders with each pull.',
      'Turn your head to the side to breathe every 2–3 strokes; exhale steadily underwater.',
      'Kick a light flutter from the hips — ankles loose, feet just breaking the surface.',
      'Count lengths and log the total metres for the set.',
    ],
  },
  {
    id: 'pool-breaststroke-swim',
    group: 'conditioning',
    name: 'Breaststroke Swim',
    aliases: ['breaststroke', 'breast stroke swimming'],
    muscles: ['chest', 'quadriceps'],
    equipment: 'pool',
    measure: 'distance',
    instructions: [
      'Glide face-down with arms extended and legs together.',
      'Sweep your hands out and around in a heart shape while lifting your head to breathe.',
      'Snap into a frog kick — heels to hips, then whip the legs back together.',
      'Glide for a beat before the next stroke; the glide is the free speed.',
    ],
  },
  {
    id: 'pool-backstroke-swim',
    group: 'conditioning',
    name: 'Backstroke Swim',
    aliases: ['backstroke', 'back crawl'],
    muscles: ['lats', 'shoulders'],
    equipment: 'pool',
    measure: 'distance',
    instructions: [
      'Float on your back with hips high and ears in the water.',
      'Alternate straight-arm pulls past your hips while flutter-kicking steadily.',
      'Keep your head still and breathe rhythmically — one breath per arm cycle.',
      'Spot the ceiling markers so you swim straight without stopping.',
    ],
  },
  {
    id: 'pool-aqua-jogging',
    group: 'conditioning',
    name: 'Aqua Jogging',
    aliases: ['aqua jogging', 'water running', 'pool running'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'pool',
    measure: 'distance',
    instructions: [
      'Wear a flotation belt in the deep end so your feet cannot touch.',
      'Mimic your land running form — high knees, quick cadence, pumping arms.',
      'Stay vertical with a slight forward lean; never bicycle the legs.',
      'Log equivalent metres by time or pool crossings.',
    ],
  },
  {
    id: 'run-easy-run',
    group: 'conditioning',
    name: 'Easy Run',
    aliases: ['running', 'easy run', 'jogging', 'jog'],
    muscles: ['quadriceps', 'calves'],
    equipment: 'running',
    measure: 'distance',
    popular: true,
    instructions: [
      'Warm up with 5 minutes of brisk walking first.',
      'Run at a conversational pace — you should be able to speak full sentences.',
      'Land softly under your hips with a quick, light cadence.',
      'Log the total metres; add no more than 10% per week.',
    ],
  },
  {
    id: 'run-interval-run',
    group: 'conditioning',
    name: 'Interval Run',
    aliases: ['intervals', 'interval running', 'sprint intervals'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'running',
    measure: 'distance',
    instructions: [
      'Warm up with 10 minutes of easy jogging.',
      'Run hard for the interval distance, then walk or jog until breathing settles.',
      'Repeat for the planned number of reps, keeping the last one as fast as the first.',
      'Cool down with 5 minutes of easy jogging and log each interval’s metres.',
    ],
  },
  {
    id: 'run-treadmill-walk',
    group: 'conditioning',
    name: 'Treadmill Walk',
    aliases: ['treadmill', 'treadmill walking', 'incline walk'],
    muscles: ['quadriceps', 'calves'],
    equipment: 'running',
    measure: 'distance',
    instructions: [
      'Set a brisk pace you could hold for 30 minutes.',
      'Add a small incline (2–4%) for glute and calf work without impact.',
      'Pump your arms naturally; never hold the rails.',
      'Log the belt distance in metres at the end.',
    ],
  },
  {
    id: 'run-trail-run',
    group: 'conditioning',
    name: 'Trail Run',
    aliases: ['trail running', 'off-road run'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'running',
    measure: 'distance',
    instructions: [
      'Shorten your stride and lift your feet to clear roots and rocks.',
      'Walk the steep climbs — running them gains little and risks a fall.',
      'Look 3–4 metres ahead, not at your feet.',
      'Log the route distance in metres.',
    ],
  },

  // ── Mobility ─────────────────────────────────────────────────────────────
  {
    id: 'Cat_Stretch',
    group: 'mobility',
    name: 'Cat Stretch',
    aliases: ['cat cow', 'cat-camel stretch'],
    muscles: ['lower back'],
    equipment: 'body',
  },
];

// ── Matching & search ────────────────────────────────────────────────────────

/** Lowercase, strip accents + punctuation, collapse whitespace. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Comparison form that also ignores internal separators ("ez bar" ≡ "ezbar"). */
function compact(value: string): string {
  return normalize(value).replace(/ /g, '');
}

const byName = new Map<string, { entry: ExerciseCatalogEntry; via: string }>();
const byAlias = new Map<string, ExerciseCatalogEntry>();
for (const entry of EXERCISES) {
  byName.set(normalize(entry.name), { entry, via: entry.name });
  for (const alias of entry.aliases ?? []) {
    if (!byAlias.has(normalize(alias))) byAlias.set(normalize(alias), entry);
  }
}

// ── Extended (runtime-loaded) catalog ─────────────────────────────────────────

/**
 * Entries loaded at runtime from the full ExerciseGymGifsDB catalog (1,323
 * exercises). They join matching and search behind the curated catalog but
 * never replace it. Registered by ./extended-catalog.ts once fetched.
 */
let extendedEntries: ExerciseCatalogEntry[] = [];
let extendedByName = new Map<string, ExerciseCatalogEntry>();

/**
 * Replace the runtime-loaded extended entries and rebuild their name index.
 * Only meant to be called by the extended catalog loader.
 */
export function setExtendedExerciseEntries(entries: ExerciseCatalogEntry[]): void {
  extendedEntries = entries;
  extendedByName = new Map(entries.map((entry) => [normalize(entry.name), entry]));
}

/** The curated catalog plus any runtime-loaded extended entries. */
export function allExercises(): ExerciseCatalogEntry[] {
  return [...EXERCISES, ...extendedEntries];
}

/**
 * Resolve a free-text exercise name (from an old log or quick typing) to a
 * catalog entry. Exact name/alias wins, then tolerant prefix and token
 * containment — so "bench press", "Benchpress" and "flat bench" all land on
 * the barbell bench press. Returns null for anything unknown.
 */
export function matchExercise(input: string): ExerciseCatalogEntry | null {
  const n = normalize(input);
  if (!n) return null;

  const aliasHit = byAlias.get(n);
  const exact = byName.get(n) ?? (aliasHit ? { entry: aliasHit } : null);
  if (exact) return exact.entry;

  const c = compact(input);
  for (const [key, hit] of byName) {
    if (compact(key) === c) return hit.entry;
  }

  // Extended entries get exact and compact matches only, so close typos still
  // land on hand-curated movements rather than an arbitrary dataset entry.
  const extendedExact = extendedByName.get(n);
  if (extendedExact) return extendedExact;
  for (const [key, hit] of extendedByName) {
    if (compact(key) === c) return hit;
  }

  // Prefix / containment on names and aliases (≥ 4 chars, so "row" or "ohp"
  // don't grab the first entry containing them — short forms live in aliases).
  let fallback: ExerciseCatalogEntry | null = null;
  for (const entry of EXERCISES) {
    const candidates = [entry.name, ...(entry.aliases ?? [])];
    for (const candidate of candidates) {
      const cn = normalize(candidate);
      if ((n.startsWith(cn) || cn.startsWith(n)) && Math.min(n.length, cn.length) >= 4) {
        return entry;
      }
      // Every query token appears as a prefix of some candidate token.
      const tokens = cn.split(' ');
      if (n.split(' ').every((t) => tokens.some((tok) => tok.startsWith(t) || t.startsWith(tok)))) {
        fallback ??= entry;
      }
    }
  }
  return fallback;
}

/**
 * Gym slang → canonical muscle/equipment/group tokens, so "quads", "delts",
 * "pecs" and "cardio" find the right movements instead of nothing.
 */
const SEARCH_SYNONYMS: Record<string, string> = {
  quad: 'quadriceps',
  quads: 'quadriceps',
  hammie: 'hamstrings',
  hammies: 'hamstrings',
  hams: 'hamstrings',
  hamstring: 'hamstrings',
  glute: 'glutes',
  calf: 'calves',
  pec: 'chest',
  pecs: 'chest',
  delt: 'shoulders',
  delts: 'shoulders',
  lat: 'lats',
  trap: 'traps',
  bi: 'biceps',
  bis: 'biceps',
  tri: 'triceps',
  tris: 'triceps',
  forearm: 'forearms',
  ab: 'abdominals',
  abs: 'abdominals',
  core: 'abdominals',
  back: 'back',
  cardio: 'cardio',
  conditioning: 'conditioning',
  db: 'dumbbell',
  bb: 'barbell',
  bw: 'body',
  bodyweight: 'body',
};

export interface SearchExercisesOptions {
  /**
   * Recently-logged exercise names (most recent first). Empty queries lead
   * with them; non-empty queries bump their score. Omitted = pure ranking.
   */
  recentNames?: readonly string[];
}

/**
 * Ranked search for the picker and the library.
 *
 * Empty queries return recent lifts first (when provided), then the popular
 * lifts. Non-empty queries score name/alias exact > prefix > whole-word >
 * cross-field (name + muscle + equipment, so "dumbbell chest" works) >
 * substring > typo-tolerant fuzzy, with a popularity bump so canonical lifts
 * surface above niche names that merely start with the same letters (typing
 * "bench" wants the bench press, not bench dips). Muscle/equipment keywords
 * ("shoulders", "quads", "cable") intentionally score low so a name match
 * always outranks a keyword match.
 */
export function searchExercises(
  query: string,
  limit = 8,
  opts: SearchExercisesOptions = {},
): ExerciseCatalogEntry[] {
  const q = normalize(query);
  const recents = resolveRecents(opts.recentNames);
  if (!q) {
    const seen = new Set(recents.map((e) => e.id));
    const popular = [...EXERCISES]
      .sort((a, b) => Number(b.popular ?? 0) - Number(a.popular ?? 0))
      .filter((e) => !seen.has(e.id));
    return [...recents, ...popular].slice(0, limit);
  }

  const recentIds = new Set(recents.map((e) => e.id));
  const scored: { entry: ExerciseCatalogEntry; index: number; score: number }[] = [];
  const catalog = allExercises();
  for (let index = 0; index < catalog.length; index++) {
    const entry = catalog[index];
    let score = scoreCandidate(entry.name, q);
    for (const alias of entry.aliases ?? []) {
      score = Math.max(score, scoreCandidate(alias, q) - 5);
    }
    if (score === 0) score = scoreCrossField(entry, q);
    if (score === 0) score = scoreKeyword(entry, q);
    if (score === 0) {
      const fuzzy = scoreFuzzy(entry.name, q);
      score = Math.max(fuzzy, ...(entry.aliases ?? []).map((a) => scoreFuzzy(a, q) - 5));
    }
    if (score > 0) {
      if (recentIds.has(entry.id)) score += 10;
      else if (entry.popular) score += 15;
      scored.push({ entry, index, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Resolve recent names to catalog entries, deduped, most recent first. */
function resolveRecents(recentNames: readonly string[] | undefined): ExerciseCatalogEntry[] {
  if (!recentNames || recentNames.length === 0) return [];
  const out: ExerciseCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const name of recentNames) {
    const entry = matchExercise(name);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

/** Score one name/alias candidate against the query; 0 means no match. */
function scoreCandidate(candidate: string, q: string): number {
  const c = normalize(candidate);
  if (c === q) return 100;
  if (c.startsWith(q)) return 75;
  if (` ${c} `.includes(` ${q} `)) return 60; // query appears as whole words
  const tokens = c.split(' ');
  if (q.split(' ').every((t) => tokens.some((tok) => tok.startsWith(t)))) return 55;
  if (c.includes(q)) return 45;
  return 0;
}

/**
 * Cross-field match: every query token appears as a prefix of a name token,
 * a muscle, the equipment or the group (synonyms expanded) — "dumbbell
 * chest" and "cable back" resolve even though no single field holds both.
 */
function scoreCrossField(entry: ExerciseCatalogEntry, q: string): number {
  // Note: the browse group is deliberately NOT in the pool — otherwise
  // "shoulders" would match trap-only lifts filed under the Shoulders group.
  const pool = [
    ...normalize(entry.name).split(' '),
    ...entry.muscles.flatMap((m) => normalize(m).split(' ')),
    ...normalize(entry.equipment).split(' '),
  ];
  const tokens = q.split(' ').map((t) => SEARCH_SYNONYMS[t] ?? t);
  // "cardio" is a concept, not a field: conditioning + pool/running gear.
  const cardioOk =
    !tokens.includes('cardio') ||
    entry.group === 'conditioning' ||
    entry.equipment === 'pool' ||
    entry.equipment === 'running';
  if (!cardioOk) return 0;
  const rest = tokens.filter((t) => t !== 'cardio');
  if (rest.length === 0) return 12;
  return rest.every((t) => pool.some((tok) => tok.startsWith(t))) ? 40 : 0;
}

/**
 * Low-score keyword fallback for single-token muscle/equipment queries
 * ("shoulders", "quads", "cable") — deliberately below every name tier so a
 * name match always wins. Whole-token only, so "tri" never steals "triceps"
 * work from real names (those live in aliases).
 */
function scoreKeyword(entry: ExerciseCatalogEntry, q: string): number {
  if (q.includes(' ')) return 0;
  const token = SEARCH_SYNONYMS[q] ?? q;
  if (token === 'cardio') {
    return entry.group === 'conditioning' ||
      entry.equipment === 'pool' ||
      entry.equipment === 'running'
      ? 12
      : 0;
  }
  const haystack = [...entry.muscles, entry.equipment].map(normalize).join(' ');
  if (` ${haystack} `.includes(` ${token} `)) return 12;
  return 0;
}

/**
 * Typo-tolerant tier: every query token (≥ 4 chars) lands within a small
 * edit distance of a name token — "bech press" and "dumbel curl" still find
 * their lift. Scores below substring so exact text always wins.
 */
function scoreFuzzy(candidate: string, q: string): number {
  const tokens = normalize(candidate).split(' ');
  const ok = q.split(' ').every((t) => {
    if (t.length < 4) return tokens.some((tok) => tok.startsWith(t));
    const allowance = t.length >= 6 ? 2 : 1;
    return tokens.some((tok) => editDistanceBounded(tok, t, allowance) <= allowance);
  });
  return ok ? 30 : 0;
}

/** Levenshtein distance with an early exit past `limit` (queries are short). */
function editDistanceBounded(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let rowMin = i;
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > limit) return limit + 1;
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Category → the muscle groups a sensible starter session for it would hit.
 * Used to suggest exercises when a guided session opens without a routine, so
 * "start exercise" is never a dead end on a fresh account.
 */
const CATEGORY_GROUPS: Record<string, ExerciseGroup[]> = {
  'cat-strength': ['chest', 'back', 'legs', 'shoulders'],
  'cat-cardio': ['conditioning'],
  'cat-hiit': ['conditioning', 'core'],
  'cat-mobility': ['mobility'],
  'cat-sports': ['conditioning', 'legs'],
  'cat-rest': ['mobility', 'core'],
};

/**
 * A short, curated starter list for a category — popular lifts first, spread
 * across the category's muscle groups so a tap-built session is balanced.
 * Falls back to the overall popular lifts for unknown categories.
 */
export function suggestedExercisesForCategory(
  categoryId: string,
  limit = 6,
): ExerciseCatalogEntry[] {
  const groups = CATEGORY_GROUPS[categoryId] ?? [];
  const pool = EXERCISES.filter((e) => groups.length === 0 || groups.includes(e.group));
  const ranked = [...pool].sort((a, b) => Number(b.popular ?? 0) - Number(a.popular ?? 0));

  // Round-robin across groups so we don't return six chest presses.
  const picked: ExerciseCatalogEntry[] = [];
  const queues = new Map<ExerciseGroup, ExerciseCatalogEntry[]>();
  for (const entry of ranked) {
    const q = queues.get(entry.group) ?? [];
    q.push(entry);
    queues.set(entry.group, q);
  }
  const keys = [...queues.keys()];
  let i = 0;
  while (picked.length < limit && keys.some((k) => (queues.get(k)?.length ?? 0) > 0)) {
    const k = keys[i % keys.length];
    const next = queues.get(k)?.shift();
    if (next) picked.push(next);
    i += 1;
  }
  return picked.slice(0, limit);
}

/**
 * Set-logging mode for an entry: load × reps, or a distance in metres.
 * Explicit `measure` wins; pool + running equipment implies distance.
 */
export function exerciseMeasure(entry: ExerciseCatalogEntry): 'weight' | 'distance' {
  return (
    entry.measure ??
    (entry.equipment === 'pool' || entry.equipment === 'running' ? 'distance' : 'weight')
  );
}

/**
 * The strength entries that train a muscle, in routine order — primary-muscle
 * lifts first, then popular ones, then alphabetical. Distance-measured
 * conditioning (runs, swims) is excluded: a set-based focus routine logs
 * reps × load, so "Easy Run · 4 sets" must never appear in a muscle program.
 */
export function strengthEntriesForMuscle(muscle: ExerciseMuscle): ExerciseCatalogEntry[] {
  return EXERCISES.filter(
    (e) => e.muscles.includes(muscle) && exerciseMeasure(e) !== 'distance',
  ).sort(
    (a, b) =>
      (a.muscles[0] === muscle ? 0 : 1) - (b.muscles[0] === muscle ? 0 : 1) ||
      (b.popular ? 1 : 0) - (a.popular ? 1 : 0) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Cardio verbs for free-typed names no catalog entry covers ("Morning run",
 * "Evening ride"). Deliberately narrow — "row" would catch the barbell row
 * and "walk" the weighted farmer's walk, so those stay load-measured.
 */
const FREE_TEXT_CARDIO_PATTERN =
  /\b(run|runs|running|jog|jogging|sprint|sprinting|treadmill|cycle|cycling|bike|biking|swim|swimming|elliptical|stairmaster|marathon|triathlon)\b/i;

/**
 * `exerciseMeasure` for a free-text log name. Known movements resolve through
 * the catalog; unknown names fall back to a cardio-verb check so a typed
 * "Morning run" still logs metres instead of kilos.
 */
export function measureForExerciseName(name: string): 'weight' | 'distance' {
  const entry = matchExercise(name);
  if (entry) return exerciseMeasure(entry);
  return FREE_TEXT_CARDIO_PATTERN.test(name.trim()) ? 'distance' : 'weight';
}
