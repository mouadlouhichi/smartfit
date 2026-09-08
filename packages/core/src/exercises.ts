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
  /** Marquee lifts surfaced when the picker is opened without a query. */
  popular?: boolean;
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

/** URL of the upstream per-exercise JSON (instructions, level, muscles…). */
export function exerciseInstructionsUrl(entry: ExerciseCatalogEntry): string {
  return `${EXERCISE_IMAGE_BASE}/${entry.id}.json`;
}

/** Demo frame URLs for an entry: [start, end] — crossfade them for a loop. */
export function exerciseImages(entry: ExerciseCatalogEntry): [string, string] {
  return [`${EXERCISE_IMAGE_BASE}/${entry.id}/0.jpg`, `${EXERCISE_IMAGE_BASE}/${entry.id}/1.jpg`];
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

export const EXERCISE_EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  body: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  'ez-bar': 'EZ-Bar',
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
    name: 'Barbell Bench Press',
    aliases: ['bench press', 'flat bench press', 'barbell bench'],
    muscles: ['chest', 'triceps', 'shoulders'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Dumbbell_Bench_Press',
    name: 'Dumbbell Bench Press',
    aliases: ['db bench press'],
    muscles: ['chest', 'triceps', 'shoulders'],
    equipment: 'dumbbell',
    popular: true,
  },
  {
    id: 'Incline_Dumbbell_Press',
    name: 'Incline Dumbbell Press',
    aliases: ['incline db press', 'incline dumbbell bench press'],
    muscles: ['chest', 'shoulders', 'triceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    name: 'Incline Barbell Bench Press',
    aliases: ['incline bench press'],
    muscles: ['chest', 'shoulders', 'triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Decline_Barbell_Bench_Press',
    name: 'Decline Barbell Bench Press',
    aliases: ['decline bench press'],
    muscles: ['chest', 'triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Flyes',
    name: 'Dumbbell Flyes',
    aliases: ['dumbbell fly', 'db flyes', 'flat dumbbell flyes'],
    muscles: ['chest'],
    equipment: 'dumbbell',
  },
  {
    id: 'Incline_Dumbbell_Flyes',
    name: 'Incline Dumbbell Flyes',
    aliases: ['incline flyes'],
    muscles: ['chest'],
    equipment: 'dumbbell',
  },
  {
    id: 'Cable_Crossover',
    name: 'Cable Crossover',
    aliases: ['cable cross over', 'cable flyes'],
    muscles: ['chest'],
    equipment: 'cable',
  },
  {
    id: 'Machine_Bench_Press',
    name: 'Machine Bench Press',
    aliases: ['chest press machine', 'seated chest press'],
    muscles: ['chest', 'triceps'],
    equipment: 'machine',
  },
  {
    id: 'Dips_-_Chest_Version',
    name: 'Chest Dips',
    aliases: ['dips', 'dips chest version', 'gymnastic dips'],
    muscles: ['chest', 'triceps'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Pushups',
    name: 'Pushups',
    aliases: ['push-up', 'push up', 'press up', 'press-ups'],
    muscles: ['chest', 'triceps'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Bodyweight_Flyes',
    name: 'Bodyweight Flyes',
    muscles: ['chest'],
    equipment: 'body',
  },

  // ── Back ─────────────────────────────────────────────────────────────────
  {
    id: 'Barbell_Deadlift',
    name: 'Deadlift',
    aliases: ['barbell deadlift', 'conventional deadlift', 'deadlifts'],
    muscles: ['lower back', 'hamstrings', 'glutes', 'traps'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Romanian_Deadlift',
    name: 'Romanian Deadlift',
    aliases: ['rdl', 'rumanian deadlift'],
    muscles: ['hamstrings', 'glutes', 'lower back'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Sumo_Deadlift',
    name: 'Sumo Deadlift',
    muscles: ['lower back', 'glutes', 'quadriceps'],
    equipment: 'barbell',
  },
  {
    id: 'Good_Morning',
    name: 'Good Morning',
    muscles: ['lower back', 'hamstrings', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Pullups',
    name: 'Pull-Ups',
    aliases: ['pull-up', 'pull up', 'pullups', 'pull ups'],
    muscles: ['lats', 'biceps', 'middle back'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Chin-Up',
    name: 'Chin-Ups',
    aliases: ['chin up', 'chin ups', 'chinups'],
    muscles: ['lats', 'biceps'],
    equipment: 'body',
  },
  {
    id: 'Band_Assisted_Pull-Up',
    name: 'Band-Assisted Pull-Up',
    aliases: ['assisted pull-up', 'assisted pull up'],
    muscles: ['lats', 'biceps'],
    equipment: 'band',
  },
  {
    id: 'Close-Grip_Front_Lat_Pulldown',
    name: 'Lat Pulldown',
    aliases: ['close grip lat pulldown', 'front lat pulldown', 'lat pull down'],
    muscles: ['lats', 'biceps'],
    equipment: 'cable',
    popular: true,
  },
  {
    id: 'Wide-Grip_Lat_Pulldown',
    name: 'Wide-Grip Lat Pulldown',
    aliases: ['wide lat pulldown'],
    muscles: ['lats', 'biceps'],
    equipment: 'cable',
  },
  {
    id: 'V-Bar_Pulldown',
    name: 'V-Bar Pulldown',
    muscles: ['lats', 'biceps'],
    equipment: 'cable',
  },
  {
    id: 'Straight-Arm_Pulldown',
    name: 'Straight-Arm Pulldown',
    muscles: ['lats'],
    equipment: 'cable',
  },
  {
    id: 'Bent_Over_Barbell_Row',
    name: 'Barbell Row',
    aliases: ['bent over row', 'bent over barbell row', 'barbell bent over row'],
    muscles: ['middle back', 'lats', 'biceps'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Bent_Over_Two-Dumbbell_Row',
    name: 'Dumbbell Row',
    aliases: ['bent over dumbbell row', 'two dumbbell row', 'db row'],
    muscles: ['middle back', 'lats', 'biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'One-Arm_Dumbbell_Row',
    name: 'One-Arm Dumbbell Row',
    aliases: ['single arm dumbbell row', 'one arm row'],
    muscles: ['lats', 'middle back', 'biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Seated_Cable_Rows',
    name: 'Seated Cable Row',
    aliases: ['seated row', 'cable row', 'seated cable rows'],
    muscles: ['middle back', 'lats', 'biceps'],
    equipment: 'cable',
  },
  {
    id: 'Bent-Arm_Dumbbell_Pullover',
    name: 'Dumbbell Pullover',
    aliases: ['db pullover', 'bent arm dumbbell pullover'],
    muscles: ['chest', 'lats'],
    equipment: 'dumbbell',
  },
  {
    id: 'Face_Pull',
    name: 'Face Pull',
    muscles: ['shoulders', 'traps'],
    equipment: 'cable',
  },

  // ── Quads & legs ─────────────────────────────────────────────────────────
  {
    id: 'Barbell_Squat',
    name: 'Barbell Squat',
    aliases: ['squat', 'back squat', 'barbell back squat', 'squats'],
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Barbell_Full_Squat',
    name: 'Full Squat',
    aliases: ['olympic squat', 'deep squat'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Goblet_Squat',
    name: 'Goblet Squat',
    muscles: ['quadriceps', 'glutes'],
    equipment: 'dumbbell',
  },
  {
    id: 'Hack_Squat',
    name: 'Hack Squat',
    muscles: ['quadriceps'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Hack_Squat',
    name: 'Barbell Hack Squat',
    muscles: ['quadriceps'],
    equipment: 'barbell',
  },
  {
    id: 'Leg_Press',
    name: 'Leg Press',
    muscles: ['quadriceps', 'glutes'],
    equipment: 'machine',
  },
  {
    id: 'Leg_Extensions',
    name: 'Leg Extension',
    aliases: ['leg extensions', 'leg extensions machine'],
    muscles: ['quadriceps'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Lunge',
    name: 'Barbell Lunge',
    aliases: ['lunge', 'lunges', 'barbell lunges'],
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Lunges',
    name: 'Dumbbell Lunge',
    aliases: ['dumbbell lunges', 'db lunge'],
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: 'dumbbell',
  },
  {
    id: 'Barbell_Walking_Lunge',
    name: 'Barbell Walking Lunge',
    aliases: ['walking lunge', 'walking lunges'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Bodyweight_Walking_Lunge',
    name: 'Bodyweight Walking Lunge',
    muscles: ['quadriceps', 'glutes'],
    equipment: 'body',
  },
  {
    id: 'Bodyweight_Squat',
    name: 'Bodyweight Squat',
    aliases: ['air squat', 'air squats', 'bw squat'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'body',
  },
  {
    id: 'Barbell_Step_Ups',
    name: 'Barbell Step-Ups',
    aliases: ['barbell step up', 'step ups barbell'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Step_Ups',
    name: 'Dumbbell Step-Ups',
    aliases: ['dumbbell step up', 'step ups'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'dumbbell',
  },

  // ── Hamstrings, glutes & calves ──────────────────────────────────────────
  {
    id: 'Lying_Leg_Curls',
    name: 'Lying Leg Curl',
    aliases: ['lying leg curls', 'leg curl', 'hamstring curl'],
    muscles: ['hamstrings'],
    equipment: 'machine',
  },
  {
    id: 'Seated_Leg_Curl',
    name: 'Seated Leg Curl',
    muscles: ['hamstrings'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Glute_Bridge',
    name: 'Barbell Glute Bridge',
    aliases: ['glute bridge', 'barbell bridge'],
    muscles: ['glutes', 'hamstrings'],
    equipment: 'barbell',
  },
  {
    id: 'Barbell_Hip_Thrust',
    name: 'Hip Thrust',
    aliases: ['barbell hip thrust', 'hip thrusts'],
    muscles: ['glutes', 'hamstrings'],
    equipment: 'barbell',
  },
  {
    id: 'Glute_Kickback',
    name: 'Cable Glute Kickback',
    aliases: ['glute kickback', 'cable kickback'],
    muscles: ['glutes'],
    equipment: 'cable',
  },
  {
    id: 'Standing_Calf_Raises',
    name: 'Standing Calf Raise',
    aliases: ['standing calf raises', 'calf raise', 'calf raises'],
    muscles: ['calves'],
    equipment: 'machine',
  },
  {
    id: 'Seated_Calf_Raise',
    name: 'Seated Calf Raise',
    muscles: ['calves'],
    equipment: 'machine',
  },
  {
    id: 'Barbell_Seated_Calf_Raise',
    name: 'Barbell Seated Calf Raise',
    muscles: ['calves'],
    equipment: 'barbell',
  },
  {
    id: 'Calf_Press',
    name: 'Calf Press',
    aliases: ['calf press on leg press'],
    muscles: ['calves'],
    equipment: 'machine',
  },

  // ── Shoulders & traps ────────────────────────────────────────────────────
  {
    id: 'Barbell_Shoulder_Press',
    name: 'Barbell Shoulder Press',
    aliases: ['overhead press', 'ohp', 'standing barbell press'],
    muscles: ['shoulders', 'triceps'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'Standing_Military_Press',
    name: 'Military Press',
    aliases: ['standing military press', 'strict press'],
    muscles: ['shoulders', 'triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Shoulder_Press',
    name: 'Dumbbell Shoulder Press',
    aliases: ['db shoulder press', 'seated dumbbell press'],
    muscles: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
    popular: true,
  },
  {
    id: 'Standing_Dumbbell_Press',
    name: 'Standing Dumbbell Press',
    muscles: ['shoulders', 'triceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Arnold_Dumbbell_Press',
    name: 'Arnold Press',
    aliases: ['arnold dumbbell press'],
    muscles: ['shoulders'],
    equipment: 'dumbbell',
  },
  {
    id: 'Side_Lateral_Raise',
    name: 'Lateral Raise',
    aliases: ['side lateral raise', 'dumbbell lateral raise', 'lat raise'],
    muscles: ['shoulders'],
    equipment: 'dumbbell',
    popular: true,
  },
  {
    id: 'Front_Dumbbell_Raise',
    name: 'Front Raise',
    aliases: ['front dumbbell raise', 'dumbbell front raise'],
    muscles: ['shoulders'],
    equipment: 'dumbbell',
  },
  {
    id: 'Reverse_Flyes',
    name: 'Reverse Flyes',
    aliases: ['rear delt fly', 'rear delt flyes', 'reverse fly'],
    muscles: ['shoulders', 'middle back'],
    equipment: 'dumbbell',
  },
  {
    id: 'Barbell_Shrug',
    name: 'Barbell Shrug',
    aliases: ['shrug', 'shrugs', 'barbell shrugs'],
    muscles: ['traps'],
    equipment: 'barbell',
  },
  {
    id: 'Dumbbell_Shrug',
    name: 'Dumbbell Shrug',
    aliases: ['dumbbell shrugs', 'db shrug'],
    muscles: ['traps'],
    equipment: 'dumbbell',
  },

  // ── Biceps & forearms ────────────────────────────────────────────────────
  {
    id: 'Barbell_Curl',
    name: 'Barbell Curl',
    aliases: ['barbell bicep curl', 'standing barbell curl', 'bicep curl'],
    muscles: ['biceps', 'forearms'],
    equipment: 'barbell',
    popular: true,
  },
  {
    id: 'EZ-Bar_Curl',
    name: 'EZ-Bar Curl',
    aliases: ['ez bar curl', 'ez curl'],
    muscles: ['biceps', 'forearms'],
    equipment: 'ez-bar',
  },
  {
    id: 'Wide-Grip_Standing_Barbell_Curl',
    name: 'Wide-Grip Barbell Curl',
    muscles: ['biceps'],
    equipment: 'barbell',
  },
  {
    id: 'Alternate_Dumbbell_Curl',
    name: 'Alternating Dumbbell Curl',
    aliases: ['alternate dumbbell curl', 'alternating db curl'],
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Seated_Dumbbell_Curl',
    name: 'Seated Dumbbell Curl',
    aliases: ['dumbbell curl', 'db curl', 'seated db curl'],
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Incline_Dumbbell_Curl',
    name: 'Incline Dumbbell Curl',
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },
  {
    id: 'Alternate_Hammer_Curl',
    name: 'Hammer Curl',
    aliases: ['hammer curls', 'alternate hammer curl', 'neutral grip curl'],
    muscles: ['biceps', 'forearms'],
    equipment: 'dumbbell',
  },
  {
    id: 'Preacher_Curl',
    name: 'Preacher Curl',
    aliases: ['preacher curls'],
    muscles: ['biceps'],
    equipment: 'ez-bar',
  },
  {
    id: 'Concentration_Curls',
    name: 'Concentration Curl',
    aliases: ['concentration curls'],
    muscles: ['biceps'],
    equipment: 'dumbbell',
  },

  // ── Triceps ──────────────────────────────────────────────────────────────
  {
    id: 'Close-Grip_Barbell_Bench_Press',
    name: 'Close-Grip Bench Press',
    aliases: ['close grip bench', 'close grip bench press', 'cg bench'],
    muscles: ['triceps', 'chest'],
    equipment: 'barbell',
  },
  {
    id: 'Dips_-_Triceps_Version',
    name: 'Triceps Dips',
    aliases: ['tricep dips', 'dips triceps version'],
    muscles: ['triceps', 'chest'],
    equipment: 'body',
  },
  {
    id: 'Bench_Dips',
    name: 'Bench Dips',
    muscles: ['triceps'],
    equipment: 'body',
  },
  {
    id: 'Triceps_Pushdown',
    name: 'Triceps Pushdown',
    aliases: ['tricep pushdown', 'cable pushdown', 'triceps pushdowns', 'pushdown'],
    muscles: ['triceps'],
    equipment: 'cable',
    popular: true,
  },
  {
    id: 'EZ-Bar_Skullcrusher',
    name: 'Skullcrusher',
    aliases: ['skull crusher', 'skull crushers', 'ez bar skullcrusher', 'lying extension'],
    muscles: ['triceps'],
    equipment: 'ez-bar',
  },
  {
    id: 'Lying_Triceps_Press',
    name: 'Lying Triceps Extension',
    aliases: ['lying triceps press'],
    muscles: ['triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Standing_Overhead_Barbell_Triceps_Extension',
    name: 'Overhead Barbell Extension',
    aliases: ['standing overhead barbell triceps extension', 'french press'],
    muscles: ['triceps'],
    equipment: 'barbell',
  },
  {
    id: 'Standing_Dumbbell_Triceps_Extension',
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
    name: 'Seated Triceps Press',
    muscles: ['triceps'],
    equipment: 'dumbbell',
  },

  // ── Core ─────────────────────────────────────────────────────────────────
  {
    id: 'Plank',
    name: 'Plank',
    aliases: ['front plank', 'planking'],
    muscles: ['abdominals'],
    equipment: 'body',
    popular: true,
  },
  {
    id: 'Crunches',
    name: 'Crunches',
    aliases: ['crunch', 'ab crunch', 'sit up', 'sit-ups'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Hanging_Leg_Raise',
    name: 'Hanging Leg Raise',
    aliases: ['hanging leg raises', 'hanging knee raise'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Russian_Twist',
    name: 'Russian Twist',
    aliases: ['russian twists'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Air_Bike',
    name: 'Bicycle Crunch',
    aliases: ['air bike', 'bicycle crunches', 'criss cross'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Cable_Crunch',
    name: 'Cable Crunch',
    aliases: ['rope crunch', 'cable crunches'],
    muscles: ['abdominals'],
    equipment: 'cable',
  },
  {
    id: 'Exercise_Ball_Crunch',
    name: 'Exercise Ball Crunch',
    aliases: ['swiss ball crunch', 'stability ball crunch'],
    muscles: ['abdominals'],
    equipment: 'other',
  },
  {
    id: 'Ab_Crunch_Machine',
    name: 'Ab Crunch Machine',
    muscles: ['abdominals'],
    equipment: 'machine',
  },
  {
    id: 'Ab_Roller',
    name: 'Ab Roller',
    aliases: ['ab wheel', 'ab wheel rollout'],
    muscles: ['abdominals'],
    equipment: 'other',
  },
  {
    id: 'Barbell_Ab_Rollout',
    name: 'Barbell Ab Rollout',
    aliases: ['barbell rollout', 'ab rollout'],
    muscles: ['abdominals'],
    equipment: 'barbell',
  },
  {
    id: '3_4_Sit-Up',
    name: '3/4 Sit-Up',
    aliases: ['sit up', 'situps'],
    muscles: ['abdominals'],
    equipment: 'body',
  },
  {
    id: 'Barbell_Side_Bend',
    name: 'Barbell Side Bend',
    aliases: ['side bend', 'side bends'],
    muscles: ['abdominals'],
    equipment: 'barbell',
  },

  // ── Conditioning & machines ──────────────────────────────────────────────
  {
    id: 'Kettlebell_Swing',
    name: 'Kettlebell Swing',
    aliases: ['kb swing', 'kettlebell swings'],
    muscles: ['glutes', 'hamstrings', 'shoulders'],
    equipment: 'kettlebell',
    popular: true,
  },
  {
    id: 'Battling_Ropes',
    name: 'Battle Ropes',
    aliases: ['battling ropes', 'battle rope'],
    muscles: ['shoulders', 'abdominals'],
    equipment: 'other',
  },
  {
    id: 'Mountain_Climbers',
    name: 'Mountain Climbers',
    aliases: ['mountain climber'],
    muscles: ['abdominals', 'quadriceps'],
    equipment: 'body',
  },
  {
    id: 'Box_Jump_Multiple_Response',
    name: 'Box Jump',
    aliases: ['box jumps', 'box jump multiple response'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'body',
  },
  {
    id: 'Clean_and_Jerk',
    name: 'Clean & Jerk',
    aliases: ['clean and jerk'],
    muscles: ['quadriceps', 'shoulders', 'lower back'],
    equipment: 'barbell',
  },
  {
    id: 'Power_Clean',
    name: 'Power Clean',
    aliases: ['power cleans'],
    muscles: ['quadriceps', 'shoulders', 'lower back'],
    equipment: 'barbell',
  },
  {
    id: 'Bicycling',
    name: 'Cycling',
    aliases: ['bicycling', 'bike', 'biking'],
    muscles: ['quadriceps'],
    equipment: 'body',
  },
  {
    id: 'Bicycling_Stationary',
    name: 'Stationary Bike',
    aliases: ['bicycling stationary', 'exercise bike', 'spin bike'],
    muscles: ['quadriceps'],
    equipment: 'machine',
  },
  {
    id: 'Elliptical_Trainer',
    name: 'Elliptical',
    aliases: ['elliptical trainer', 'cross trainer'],
    muscles: ['quadriceps'],
    equipment: 'machine',
  },
  {
    id: 'Stairmaster',
    name: 'Stairmaster',
    aliases: ['stair master', 'stair climber', 'stepper'],
    muscles: ['quadriceps', 'glutes'],
    equipment: 'machine',
  },

  // ── Mobility ─────────────────────────────────────────────────────────────
  {
    id: 'Cat_Stretch',
    name: 'Cat Stretch',
    aliases: ['cat cow', 'cat-camel stretch'],
    muscles: ['lower back'],
    equipment: 'body',
  },
];

// ── Matching & search ────────────────────────────────────────────────────────

/** Lowercase, strip punctuation, collapse whitespace. */
function normalize(value: string): string {
  return value
    .toLowerCase()
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
 * Ranked search for the picker. Empty queries return the popular lifts
 * first, then the rest of the catalog in order. Non-empty queries score
 * name/alias exact > prefix > whole-token > substring, with a popularity
 * bump so canonical lifts surface above niche names that merely start with
 * the same letters (typing "bench" wants the bench press, not bench dips).
 */
export function searchExercises(query: string, limit = 8): ExerciseCatalogEntry[] {
  const q = normalize(query);
  if (!q) {
    return [...EXERCISES]
      .sort((a, b) => Number(b.popular ?? 0) - Number(a.popular ?? 0))
      .slice(0, limit);
  }

  const scored: { entry: ExerciseCatalogEntry; index: number; score: number }[] = [];
  for (let index = 0; index < EXERCISES.length; index++) {
    const entry = EXERCISES[index];
    let score = scoreCandidate(entry.name, q);
    for (const alias of entry.aliases ?? []) {
      score = Math.max(score, scoreCandidate(alias, q) - 5);
    }
    if (score === 0) {
      const haystack = [...entry.muscles, entry.equipment].map(normalize).join(' ');
      if (` ${haystack} `.includes(` ${q} `)) score = 12;
    }
    if (score > 0) {
      scored.push({ entry, index, score: score + (entry.popular ? 15 : 0) });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.entry);
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
