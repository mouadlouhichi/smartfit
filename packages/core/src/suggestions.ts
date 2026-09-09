/**
 * Suggested exercises ("For you").
 *
 * A small rules engine that turns body-composition signals the app already
 * holds — latest body-fat %, body weight vs target, training strategy, and
 * what was trained recently — into a starter set of movements with a
 * one-line reason each. Every round always includes one pool and one running
 * option (low-impact cardio pairs with any goal), logged in metres rather
 * than kilograms.
 *
 * When the athlete logs InBody-style measurements (weight + body-fat %) via
 * the Body tab, the suggestions adapt automatically: higher body fat tilts
 * toward conditioning, a surplus target toward compounds.
 */
import type { BodyUnit, FitnessState } from './types';
import { matchExercise, type ExerciseCatalogEntry, type ExerciseEquipment } from './exercises';

export interface ExerciseSuggestion {
  entry: ExerciseCatalogEntry;
  reason: string;
}

const DAY_MS = 86_400_000;
const RECENT_DAYS = 10;
/** Body-fat % above which conditioning leads the mix (InBody "high" band). */
const HIGH_BODY_FAT = 24;
/** Waist (canonical cm) at/above which trunk fat leads the mix. */
const HIGH_WAIST_CM = 95;

function latestBodyValue(state: FitnessState, unit: BodyUnit): number | null {
  let best: { date: string; value: number } | null = null;
  for (const log of state.bodyLogs) {
    if (log.unit !== unit) continue;
    if (!best || log.date > best.date) best = { date: log.date, value: log.value };
  }
  return best?.value ?? null;
}

/** Lower-cased names trained in the last `RECENT_DAYS` (variety filter). */
function recentExerciseNames(state: FitnessState, now = Date.now()): Set<string> {
  const cutoff = new Date(now - RECENT_DAYS * DAY_MS).toISOString().slice(0, 10);
  const names = new Set<string>();
  for (const s of state.sessions) {
    if (s.date < cutoff) continue;
    for (const ex of s.exercises) names.add(ex.name.trim().toLowerCase());
  }
  return names;
}

function resolve(name: string): ExerciseCatalogEntry | null {
  return matchExercise(name);
}

export type SuggestionGoal = 'cut' | 'build' | 'maintain';

/** Which way the athlete is headed: deficit, surplus, or neither. */
export function suggestionGoal(state: FitnessState): SuggestionGoal {
  const weight = latestBodyValue(state, 'weight');
  const bodyfat = latestBodyValue(state, 'bodyfat');
  const waist = latestBodyValue(state, 'waist');
  const target = state.profile.targetWeightKg;
  if (bodyfat != null && bodyfat > HIGH_BODY_FAT) return 'cut';
  if (waist != null && waist >= HIGH_WAIST_CM) return 'cut';
  if (weight != null && target != null) {
    if (target < weight - 0.5) return 'cut';
    if (target > weight + 0.5) return 'build';
  }
  if (state.profile.planId === 'cardio-focus') return 'cut';
  return 'maintain';
}

const POOL_ORDER = ['Freestyle Swim', 'Breaststroke Swim', 'Backstroke Swim', 'Aqua Jogging'];
const RUN_ORDER = ['Easy Run', 'Treadmill Walk', 'Interval Run', 'Trail Run'];
const LIFT_ORDER = [
  'Goblet Squat',
  'Romanian Deadlift',
  'Barbell Bench Press',
  'Barbell Row',
  'Pull-Ups',
  'Barbell Squat',
  'Deadlift',
  'Plank',
  'Pushups',
  'Chest Dips',
  'Barbell Lunge',
];

function firstFresh(names: string[], recent: Set<string>): string {
  return names.find((n) => !recent.has(n.toLowerCase())) ?? names[0];
}

/**
 * Four suggestions: one pool, one running, two lifts — skipping whatever
 * was trained in the last 10 days when an alternative exists. Reasons name
 * the signal so the card reads as coaching, not a random list.
 */
export function suggestExercises(state: FitnessState, limit = 4): ExerciseSuggestion[] {
  const recent = recentExerciseNames(state);
  const goal = suggestionGoal(state);
  const bodyfat = latestBodyValue(state, 'bodyfat');
  const waist = latestBodyValue(state, 'waist');
  const out: ExerciseSuggestion[] = [];

  const pool = resolve(firstFresh(POOL_ORDER, recent));
  if (pool) {
    out.push({
      entry: pool,
      reason:
        goal === 'cut'
          ? bodyfat != null
            ? `Body fat ${Math.round(bodyfat)}% — low-impact laps burn without joint stress`
            : waist != null && waist >= HIGH_WAIST_CM
              ? `Waist ${Math.round(waist * 10) / 10} cm — trunk fat responds to steady conditioning`
              : 'Low-impact laps that burn while your joints recover'
          : 'Full-body cardio that spares your joints for lifting days',
    });
  }

  const run = resolve(firstFresh(RUN_ORDER, recent));
  if (run) {
    out.push({
      entry: run,
      reason:
        goal === 'cut'
          ? 'Easy aerobic base miles — the deficit does the rest'
          : 'Aerobic base work to recover faster between lifts',
    });
  }

  const liftReasons: Record<SuggestionGoal, string[]> = {
    cut: [
      'Keep muscle while you lean out — full-body compound',
      'Muscle protects your metabolism in a deficit',
    ],
    build: [
      'Progressive compound for your surplus — add load weekly',
      'Heavy hinge pattern for total-body mass',
    ],
    maintain: ['Strength anchor for the week', 'Balanced push/pull pairing'],
  };
  const used = new Set(out.map((s) => s.entry.name.toLowerCase()));
  const reasons = liftReasons[goal];
  let ri = 0;
  for (const name of LIFT_ORDER) {
    if (out.length >= limit) break;
    if (used.has(name.toLowerCase()) || recent.has(name.toLowerCase())) continue;
    const entry = resolve(name);
    if (!entry) continue;
    out.push({ entry, reason: reasons[ri % reasons.length] });
    ri += 1;
    used.add(name.toLowerCase());
  }
  // Small catalog or a busy fortnight: allow repeats rather than a short list.
  for (const name of LIFT_ORDER) {
    if (out.length >= limit) break;
    if (used.has(name.toLowerCase())) continue;
    const entry = resolve(name);
    if (!entry) continue;
    out.push({ entry, reason: reasons[ri % reasons.length] });
    ri += 1;
    used.add(name.toLowerCase());
  }

  return out.slice(0, limit);
}

/**
 * Which activity category a suggestion should start under: pool/running go
 * to Cardio, lifts to Strength — matched by name so renamed categories still
 * work, falling back to the first category.
 */
export function categoryIdForSuggestion(state: FitnessState, equipment: ExerciseEquipment): string {
  const cardio = equipment === 'pool' || equipment === 'running';
  const re = cardio ? /cardio|condition|swim|run/i : /strength|lift|gym|weight/i;
  return state.categories.find((c) => re.test(c.name))?.id ?? state.categories[0]?.id ?? 'general';
}
