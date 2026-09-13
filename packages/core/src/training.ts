/**
 * In-session training engine.
 *
 * Everything a *guided* workout needs that the log-only model did not have:
 *
 *  - **Progressive overload** — `lastPerformance` returns what you lifted last
 *    time so the runner can pre-fill it (the single feature every serious
 *    tracker ships: Hevy, Strong, Jefit, Fitbod, Boostcamp).
 *  - **Personal records** — best set per exercise, scored with an Epley
 *    estimated one-rep max so a heavier single and a lighter high-rep set are
 *    comparable.
 *  - **Volume / tonnage** — weight × reps, rolled up per exercise, session and
 *    muscle group.
 *  - **Rest prescription** — intensity-aware defaults instead of one hard 60 s.
 *  - **Achievements** — a deterministic badge engine (no server, no surprises).
 *  - **Rings & heatmap** — the two retention visualisations the category
 *    converged on (Apple's closing rings, GitHub-style consistency grid).
 *
 * All functions are pure: they take state and return data, so the web app,
 * the mobile app and the unit tests all see identical numbers.
 */
import { matchExercise, EXERCISE_MUSCLE_LABELS, type ExerciseMuscle } from './exercises';
import { sessionsInRange, toISODate, weekStartOf, startOfWeek } from './fitness';
import type { FitnessState, Intensity, WorkoutExercise, WorkoutSession, WorkoutSet } from './types';

// ── one-rep max ──────────────────────────────────────────────────────────

/**
 * Epley estimated one-rep max: `w × (1 + reps/30)`.
 *
 * Chosen over Brzycki/Lombardi because it degrades gracefully past 10 reps
 * (Brzycki goes negative at 30) and it is what Hevy/Strong display. Returns
 * the raw weight for a single, and 0 for anything nonsensical.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0;
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  if (reps > 30) return 0; // the formula stops being meaningful; don't invent a PR
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

// ── volume ───────────────────────────────────────────────────────────────

/** Tonnage of one set: weight × reps. Warm-ups are excluded from
 * coaching volume so a ramp-up does not masquerade as working load. */
export function setVolume(set: WorkoutSet): number {
  if (set.kind === 'warmup') return 0;
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  if (w <= 0 || r <= 0) return 0;
  return w * r;
}

/** Total tonnage moved for one exercise entry. */
export function exerciseVolume(ex: WorkoutExercise): number {
  return ex.sets.reduce((sum, s) => sum + setVolume(s), 0);
}

/** Total tonnage of a session. */
export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);
}

/** Total tonnage across a list of sessions, in kg. */
export function totalVolume(sessions: WorkoutSession[]): number {
  return sessions.reduce((sum, s) => sum + sessionVolume(s), 0);
}

/** True when a working/failure/drop set carries a meaningful load. */
export function isLoadedSet(set: WorkoutSet): boolean {
  return set.kind !== 'warmup' && (set.weight ?? 0) > 0 && (set.reps ?? 0) > 0;
}

/** Total coaching sets recorded for an exercise entry (warm-ups excluded). */
export function setCount(ex: WorkoutExercise): number {
  return ex.sets.filter((set) => set.kind !== 'warmup').length;
}

// ── progressive overload ─────────────────────────────────────────────────

export interface LastPerformance {
  /** ISO date of the session it came from. */
  date: string;
  /** The sets exactly as logged, in order. */
  sets: WorkoutSet[];
  /** Heaviest weight moved, kg. */
  bestWeight: number;
  /** Most reps at that heaviest weight. */
  bestReps: number;
  /** Tonnage of that session's entry for this exercise. */
  volume: number;
  /** How many sessions ago (0 = most recent, 1 = the one before…). */
  sessionsAgo: number;
}

/**
 * What you did the last time you trained `exerciseName`.
 *
 * Matching is deliberately forgiving: the name is resolved through the shared
 * exercise catalog (so "bench press", "Bench Press" and "barbell bench press"
 * agree) and falls back to a normalised string compare for custom names the
 * catalog has never heard of. Sessions dated today are skipped — otherwise a
 * second session on the same day would pre-fill from itself.
 */
export function lastPerformance(
  state: FitnessState,
  exerciseName: string,
  now = new Date(),
): LastPerformance | null {
  const target = exerciseName.trim().toLowerCase();
  if (!target) return null;
  const matched = matchExercise(exerciseName);
  const today = toISODate(now);

  // `state.sessions` is kept newest-first by the store/parser.
  const history = state.sessions.filter((s) => s.date < today);
  let index = -1;
  for (const session of history) {
    index += 1;
    const entry = session.exercises.find((e) => sameExercise(e.name, target, matched));
    if (!entry || setCount(entry) === 0) continue;

    let bestWeight = 0;
    let bestReps = 0;
    for (const s of entry.sets) {
      if (!isLoadedSet(s)) continue;
      const w = s.weight ?? 0;
      if (w > bestWeight || (w === bestWeight && (s.reps ?? 0) > bestReps)) {
        bestWeight = w;
        bestReps = s.reps ?? 0;
      }
    }
    return {
      date: session.date,
      sets: entry.sets.map((s) => ({ ...s })),
      bestWeight,
      bestReps,
      volume: exerciseVolume(entry),
      sessionsAgo: index,
    };
  }
  return null;
}

/** Loose exercise-name equality: catalog identity first, then normalised text. */
function sameExercise(
  name: string,
  targetLower: string,
  matched: ReturnType<typeof matchExercise>,
): boolean {
  const other = matchExercise(name);
  if (matched && other && matched.id === other.id) return true;
  return normalise(name) === targetLower || normalise(name) === normalise(matched?.name ?? '');
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ── personal records ─────────────────────────────────────────────────────

export interface ExerciseRecord {
  /** Canonical display name (from the catalog when the name matches one). */
  name: string;
  /** Heaviest single set, kg. */
  bestWeight: number;
  /** Reps on that heaviest set. */
  bestReps: number;
  /** Epley e1RM of the best set — the comparable score across rep ranges. */
  bestE1rm: number;
  /** The set that produced the highest e1RM (may differ from the heaviest). */
  topSet: WorkoutSet;
  /** ISO date the record was set. */
  date: string;
  /** Total sets ever logged for this exercise. */
  totalSets: number;
}

/**
 * Personal records, best-first by e1RM.
 *
 * Only *loaded* sets (weight + reps) can hold a record — a bodyweight or
 * timed set has no comparable score. Exercises with no loaded sets are
 * omitted rather than listed at zero.
 */
export function personalRecords(state: FitnessState): ExerciseRecord[] {
  const best = new Map<string, ExerciseRecord>();

  for (const session of state.sessions) {
    for (const entry of session.exercises) {
      const name = entry.name.trim();
      if (!name) continue;
      const key = normalise(matchExercise(name)?.name ?? name);
      const label = matchExercise(name)?.name ?? name;

      for (const set of entry.sets) {
        if (!isLoadedSet(set)) continue;
        const e1rm = estimatedOneRepMax(set.weight ?? 0, set.reps ?? 0);
        const prev = best.get(key);
        const beats =
          !prev ||
          e1rm > prev.bestE1rm ||
          (e1rm === prev.bestE1rm && (set.weight ?? 0) > prev.bestWeight);
        if (beats) {
          best.set(key, {
            name: label,
            bestWeight: set.weight ?? 0,
            bestReps: set.reps ?? 0,
            bestE1rm: e1rm,
            topSet: { ...set },
            date: session.date,
            totalSets: (prev?.totalSets ?? 0) + 1,
          });
        } else if (prev) {
          prev.totalSets += 1;
        }
      }
    }
  }

  return [...best.values()].sort((a, b) => b.bestE1rm - a.bestE1rm);
}

/** True when `weight`/`reps` beats the athlete's stored record for that lift. */
export function isPersonalRecord(
  state: FitnessState,
  exerciseName: string,
  weight: number,
  reps: number,
): boolean {
  if (!isLoadedSet({ weight, reps })) return false;
  const e1rm = estimatedOneRepMax(weight, reps);
  if (e1rm <= 0) return false;
  const records = personalRecords(state);
  const key = normalise(matchExercise(exerciseName)?.name ?? exerciseName);
  const prev = records.find((r) => normalise(r.name) === key);
  return e1rm > (prev?.bestE1rm ?? 0);
}

/** Count of distinct exercises with at least one recorded PR. */
export function recordCount(state: FitnessState): number {
  return personalRecords(state).length;
}

// ── muscle-group volume ──────────────────────────────────────────────────

export interface MuscleVolume {
  muscle: ExerciseMuscle;
  label: string;
  /** Tonnage in kg. */
  volume: number;
  /** Sets that touched this muscle. */
  sets: number;
}

/**
 * Tonnage and set count per muscle group over a window.
 *
 * Exercises are attributed through the shared catalog, so an unknown custom
 * name simply contributes nothing rather than inventing a muscle. Useful for
 * the "what am I neglecting?" view and for spotting a lopsided split.
 */
export function muscleVolume(state: FitnessState, days = 30, now = new Date()): MuscleVolume[] {
  const to = new Date(now);
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  const sessions = sessionsInRange(state, toISODate(from), toISODate(to));

  const acc = new Map<ExerciseMuscle, { volume: number; sets: number }>();
  for (const session of sessions) {
    for (const entry of session.exercises) {
      const match = matchExercise(entry.name);
      if (!match) continue;
      const volume = exerciseVolume(entry);
      const sets = setCount(entry);
      if (sets === 0) continue;
      for (const muscle of match.muscles) {
        const cur = acc.get(muscle) ?? { volume: 0, sets: 0 };
        cur.volume += volume;
        cur.sets += sets;
        acc.set(muscle, cur);
      }
    }
  }

  return [...acc.entries()]
    .map(([muscle, v]) => ({
      muscle,
      label: EXERCISE_MUSCLE_LABELS[muscle],
      volume: Math.round(v.volume),
      sets: v.sets,
    }))
    .sort((a, b) => b.volume - a.volume);
}

// ── rest prescription ────────────────────────────────────────────────────

export interface RestPreset {
  seconds: number;
  label: string;
  /** When to pick it. */
  hint: string;
}

/**
 * Rest presets, shortest first. 60/90/120/180 covers endurance → strength;
 * these are the four every major tracker exposes.
 */
export const REST_PRESETS: RestPreset[] = [
  { seconds: 45, label: '45s', hint: 'Conditioning & circuits' },
  { seconds: 60, label: '60s', hint: 'Endurance / high reps' },
  { seconds: 90, label: '90s', hint: 'Hypertrophy' },
  { seconds: 120, label: '2m', hint: 'Strength' },
  { seconds: 180, label: '3m', hint: 'Heavy singles / max effort' },
];

/** Sensible default rest for an intensity: harder work needs longer recovery. */
export function suggestedRestSeconds(intensity: Intensity): number {
  return intensity === 'high' ? 120 : intensity === 'moderate' ? 90 : 60;
}

/** Seconds to add when the athlete taps "+". */
export const REST_STEP_SECONDS = 15;

// ── achievements ─────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  /** One line of copy shown on the tile and in the celebration toast. */
  description: string;
  /** lucide icon key. */
  icon: string;
  /** Gradient stops for the medallion. */
  tint: string;
  unlocked: boolean;
  /** ISO date it unlocked, when it did. */
  unlockedAt?: string;
  /** 0–100 progress toward the next tier (100 when unlocked). */
  progress: number;
  /** Human-readable progress, e.g. "7 / 10 sessions". */
  progressLabel: string;
  /** How many of these the athlete has collected, for stacking. */
  threshold: number;
}

/** Badge tiers — small enough to reach in week one, big enough to matter. */
const TIERS = { first: 1, streak3: 3, streak7: 7, sessions10: 10, sessions50: 50, prs5: 5 };

/**
 * The achievement wall.
 *
 * Deterministic and derived: nothing is stored, so a badge can never drift out
 * of sync with the log, and re-importing a backup restores the wall exactly.
 */
export function computeAchievements(state: FitnessState, now = new Date()): Achievement[] {
  const sessions = state.sessions;
  const count = sessions.length;
  const streak = currentStreakDays(state, now);
  const records = personalRecords(state);
  const minutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
  const volume = totalVolume(sessions);

  const first = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const earlyBird = sessions.filter((s) => {
    // Sessions store a date only; treat a morning log as the honest signal we
    // actually have — sessions logged before 09:00 device time.
    const d = new Date(s.createdAt);
    return d.getHours() < 9;
  });

  return [
    {
      id: 'first-session',
      name: 'First Blood',
      description: 'Log your very first session.',
      icon: 'flag',
      tint: '#f3ff47',
      unlocked: count >= TIERS.first,
      unlockedAt: first?.date,
      progress: count >= TIERS.first ? 100 : 0,
      progressLabel: `${Math.min(count, TIERS.first)} / ${TIERS.first} session`,
      threshold: TIERS.first,
    },
    {
      id: 'streak-3',
      name: 'Warming Up',
      description: 'Train 3 days in a row.',
      icon: 'flame',
      tint: '#b27f38',
      unlocked: streak >= TIERS.streak3,
      progress: Math.min(100, Math.round((streak / TIERS.streak3) * 100)),
      progressLabel: `${Math.min(streak, TIERS.streak3)} / ${TIERS.streak3} days`,
      threshold: TIERS.streak3,
    },
    {
      id: 'streak-7',
      name: 'Unbreakable Week',
      description: 'A full 7-day training streak.',
      icon: 'calendar-check',
      tint: '#ce64b4',
      unlocked: streak >= TIERS.streak7,
      progress: Math.min(100, Math.round((streak / TIERS.streak7) * 100)),
      progressLabel: `${Math.min(streak, TIERS.streak7)} / ${TIERS.streak7} days`,
      threshold: TIERS.streak7,
    },
    {
      id: 'sessions-10',
      name: 'Double Digits',
      description: 'Complete 10 sessions.',
      icon: 'dumbbell',
      tint: '#d06c6c',
      unlocked: count >= TIERS.sessions10,
      progress: Math.min(100, Math.round((count / TIERS.sessions10) * 100)),
      progressLabel: `${Math.min(count, TIERS.sessions10)} / ${TIERS.sessions10} sessions`,
      threshold: TIERS.sessions10,
    },
    {
      id: 'sessions-50',
      name: 'Half Century',
      description: 'Complete 50 sessions.',
      icon: 'trophy',
      tint: '#548fc9',
      unlocked: count >= TIERS.sessions50,
      progress: Math.min(100, Math.round((count / TIERS.sessions50) * 100)),
      progressLabel: `${Math.min(count, TIERS.sessions50)} / ${TIERS.sessions50} sessions`,
      threshold: TIERS.sessions50,
    },
    {
      id: 'records-5',
      name: 'Record Breaker',
      description: 'Set personal records on 5 lifts.',
      icon: 'trending-up',
      tint: '#8a9a0f',
      unlocked: records.length >= TIERS.prs5,
      progress: Math.min(100, Math.round((records.length / TIERS.prs5) * 100)),
      progressLabel: `${Math.min(records.length, TIERS.prs5)} / ${TIERS.prs5} lifts`,
      threshold: TIERS.prs5,
    },
    {
      id: 'hours-10',
      name: 'Ten Hours In',
      description: 'Accumulate 10 hours of training.',
      icon: 'timer',
      tint: '#8c79c3',
      unlocked: minutes >= 600,
      progress: Math.min(100, Math.round((minutes / 600) * 100)),
      progressLabel: `${Math.floor(minutes / 60)} / 10 hours`,
      threshold: 600,
    },
    {
      id: 'tonnage-10t',
      name: 'Iron Mover',
      description: 'Move 10 tonnes of iron.',
      icon: 'weight',
      tint: '#8a8a8a',
      unlocked: volume >= 10_000,
      progress: Math.min(100, Math.round((volume / 10_000) * 100)),
      progressLabel: `${(volume / 1000).toFixed(1)} / 10 t`,
      threshold: 10_000,
    },
    {
      id: 'early-bird',
      name: 'Early Bird',
      description: 'Finish a session before 9am.',
      icon: 'sunrise',
      tint: '#319b78',
      unlocked: earlyBird.length > 0,
      progress: earlyBird.length > 0 ? 100 : 0,
      progressLabel: earlyBird.length > 0 ? 'Earned' : 'Train before 9am',
      threshold: 1,
    },
  ];
}

/**
 * Consecutive training days ending today (or yesterday, so a streak is not
 * broken before you have had the chance to train today).
 *
 * Rest days planned in the profile are *not* skipped here — this is the raw
 * streak the badges celebrate. The rest-day-aware streak lives in
 * `fitness.ts#currentStreak` and is what the dashboard headline uses.
 */
export function currentStreakDays(state: FitnessState, now = new Date()): number {
  const days = new Set(state.sessions.map((s) => s.date));
  if (days.size === 0) return 0;

  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  const today = toISODate(cursor);
  if (!days.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toISODate(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ── activity rings ───────────────────────────────────────────────────────

export interface ActivityRings {
  /** Active minutes against the day's minute target. */
  minutes: { value: number; target: number; pct: number };
  /** Sessions completed against the week's session target. */
  sessions: { value: number; target: number; pct: number };
  /** Estimated kcal against the day's calorie target (0 target = no ring). */
  calories: { value: number; target: number; pct: number };
  /** True when every ring with a real target is closed. */
  closed: boolean;
}

/**
 * The three-ring daily summary (Apple Fitness+ pattern).
 *
 * Targets come from the athlete's own goals via `targetsForDays`, so a ring
 * only closes for something they actually committed to — a ring that fills
 * regardless of effort stops meaning anything after a few weeks.
 */
export function activityRings(
  state: FitnessState,
  targets: { minutes: number; workouts: number; calories: number },
  now = new Date(),
): ActivityRings {
  const today = toISODate(now);
  const todays = state.sessions.filter((s) => s.date === today);
  const minutes = todays.reduce((sum, s) => sum + s.durationMin, 0);
  const calories = todays.reduce((sum, s) => sum + s.calories, 0);

  const weekStart = startOfWeek(now, weekStartOf(state));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekSessions = sessionsInRange(state, toISODate(weekStart), toISODate(weekEnd)).length;

  const pct = (value: number, target: number) =>
    target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  const rings = {
    minutes: { value: minutes, target: targets.minutes, pct: pct(minutes, targets.minutes) },
    sessions: {
      value: weekSessions,
      target: targets.workouts,
      pct: pct(weekSessions, targets.workouts),
    },
    calories: { value: calories, target: targets.calories, pct: pct(calories, targets.calories) },
  };

  const meaningful = [rings.minutes, rings.sessions, rings.calories].filter((r) => r.target > 0);
  return { ...rings, closed: meaningful.length > 0 && meaningful.every((r) => r.pct >= 100) };
}

// ── consistency heatmap ──────────────────────────────────────────────────

export interface HeatmapCell {
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Active minutes that day. */
  minutes: number;
  sessions: number;
  /** 0–4 intensity bucket, for the colour ramp. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

export interface HeatmapWeek {
  cells: HeatmapCell[];
}

/**
 * GitHub-style consistency grid, oldest week first, one column per week.
 *
 * `weeks` columns ending with the current week. Levels are relative to the
 * busiest day in the window so the ramp stays readable whether the athlete
 * does 20-minute walks or 2-hour sessions.
 */
export function consistencyHeatmap(
  state: FitnessState,
  weeks = 18,
  now = new Date(),
): HeatmapWeek[] {
  const minutesByDay = new Map<string, { minutes: number; sessions: number }>();
  for (const s of state.sessions) {
    const cur = minutesByDay.get(s.date) ?? { minutes: 0, sessions: 0 };
    cur.minutes += s.durationMin;
    cur.sessions += 1;
    minutesByDay.set(s.date, cur);
  }

  // Align the grid to the athlete's week start so columns are real weeks.
  const end = startOfWeek(now, weekStartOf(state));
  end.setDate(end.getDate() + 6); // last day of the current week column
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1));

  let peak = 0;
  const cursor = new Date(start);
  const cells: HeatmapCell[] = [];
  const lastDay = toISODate(now);
  while (cursor <= end) {
    const iso = toISODate(cursor);
    const rec = minutesByDay.get(iso);
    const minutes = rec?.minutes ?? 0;
    if (iso <= lastDay && minutes > peak) peak = minutes;
    cells.push({
      date: iso,
      minutes,
      sessions: rec?.sessions ?? 0,
      level: 0,
      future: iso > lastDay,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const cell of cells) {
    if (cell.future || cell.minutes <= 0) {
      cell.level = 0;
    } else if (peak <= 0) {
      cell.level = 0;
    } else {
      const ratio = cell.minutes / peak;
      cell.level = (
        ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1
      ) as HeatmapCell['level'];
    }
  }

  const out: HeatmapWeek[] = [];
  for (let i = 0; i < cells.length; i += 7) out.push({ cells: cells.slice(i, i + 7) });
  return out;
}

/** Days trained inside the heatmap window — the headline number above the grid. */
export function heatmapActiveDays(grid: HeatmapWeek[]): number {
  return grid.reduce((sum, w) => sum + w.cells.filter((c) => c.sessions > 0).length, 0);
}

// ── session summary (runner "finish" screen) ─────────────────────────────

export interface SessionSummary {
  sets: number;
  exercises: number;
  volume: number;
  /** Total set distance logged (pool/running), canonical km. */
  distance: number;
  /** Exercises where at least one set beat the previous best. */
  personalRecords: string[];
  /** Heaviest single set moved. */
  heaviest: number;
  /** Longest set by reps. */
  mostReps: number;
}

/**
 * Roll-up for the guided runner's finish screen, computed *before* the
 * session is written — the runner holds the sets in local state until save.
 */
export function summariseLiveSession(
  state: FitnessState,
  exercises: WorkoutExercise[],
): SessionSummary {
  let sets = 0;
  let volume = 0;
  let distance = 0;
  let heaviest = 0;
  let mostReps = 0;
  const prs: string[] = [];

  for (const entry of exercises) {
    let touched = false;
    for (const set of entry.sets) {
      if (set.kind === 'warmup') continue;
      sets += 1;
      volume += setVolume(set);
      distance += set.distance ?? 0;
      heaviest = Math.max(heaviest, set.weight ?? 0);
      mostReps = Math.max(mostReps, set.reps ?? 0);
      if (isLoadedSet(set) && isPersonalRecord(state, entry.name, set.weight ?? 0, set.reps ?? 0)) {
        touched = true;
      }
    }
    if (touched) prs.push(matchExercise(entry.name)?.name ?? entry.name);
  }

  return {
    sets,
    exercises: exercises.filter((e) => setCount(e) > 0).length,
    volume: Math.round(volume),
    distance: Math.round(distance * 100) / 100,
    personalRecords: prs,
    heaviest,
    mostReps,
  };
}

// ── smart progression (Pro) ─────────────────────────────────────────────

/**
 * Double-progression defaults: add reps until the top of the range, then add
 * load and drop back to the bottom. The same scheme Strong/Boostcamp teach —
 * computed from the athlete's own last session, so it is always personal.
 */
export const PROGRESSION_REP_MIN = 8;
export const PROGRESSION_REP_MAX = 12;
/** Default load jump in kg when the top of the rep range is hit. */
export const PROGRESSION_WEIGHT_STEP_KG = 2.5;
/** Distance bump per session for distance-measured movements, as a ratio. */
export const PROGRESSION_DISTANCE_RATIO = 0.05;

export interface ProgressionTarget {
  /** Suggested top-set reps (load-measured lifts). */
  reps?: number;
  /** Suggested top-set load in canonical kg (load-measured lifts). */
  weight?: number;
  /** Suggested distance in km (distance-measured movements). */
  distance?: number;
  /** Plain-language reason shown next to the target ("Last: 60 × 10 → …"). */
  rationale: string;
  /** What changed versus last time: a rep, load, or distance bump. */
  kind: 'reps' | 'load' | 'distance' | 'repeat';
}

/**
 * Next-session target for one exercise, derived from its last logged
 * performance: +1 rep until 12, then +2.5 kg back at 8 (double progression);
 * +5% distance for runs, rides and swims. Returns null when the movement was
 * never logged — there is nothing to progress from.
 *
 * This is the engine behind the Pro "smart progression" gate: free pre-fills
 * last session's numbers; Pro pre-fills the next step and explains why.
 */
export function progressionTarget(
  state: FitnessState,
  exerciseName: string,
  now = new Date(),
): ProgressionTarget | null {
  const last = lastPerformance(state, exerciseName, now);
  if (!last) return null;

  const lastDistance = Math.max(0, ...last.sets.map((s) => s.distance ?? 0));
  if (lastDistance > 0) {
    const distance = Math.round(lastDistance * (1 + PROGRESSION_DISTANCE_RATIO) * 100) / 100;
    return {
      distance,
      kind: 'distance',
      rationale: `Last: ${formatTargetDistance(lastDistance)} → aim ${formatTargetDistance(distance)} (+5%)`,
    };
  }

  const w = last.bestWeight;
  const r = last.bestReps;
  if (w > 0 && r > 0) {
    if (r < PROGRESSION_REP_MAX) {
      return {
        reps: r + 1,
        weight: w,
        kind: 'reps',
        rationale: `Last: ${r} × ${formatTargetWeight(w)} → add a rep`,
      };
    }
    const weight = Math.round((w + PROGRESSION_WEIGHT_STEP_KG) * 2) / 2;
    return {
      reps: PROGRESSION_REP_MIN,
      weight,
      kind: 'load',
      rationale: `Last: ${r} × ${formatTargetWeight(w)} → add ${PROGRESSION_WEIGHT_STEP_KG} kg`,
    };
  }

  // Bodyweight / rep-only work: nudge the rep count when there is one.
  if (r > 0) {
    return {
      reps: r + 1,
      kind: 'reps',
      rationale: `Last: ${r} reps → add a rep`,
    };
  }
  return { kind: 'repeat', rationale: 'Repeat last session, then push the top set' };
}

function formatTargetWeight(kg: number): string {
  return `${Math.round(kg * 10) / 10} kg`;
}

function formatTargetDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km * 100) / 100} km`;
}

// ── readiness & training load (Pro) ───────────────────────────────────────

export interface Readiness {
  /**
   * 0–100 daily score, or null while calibrating (fewer than 3 logged
   * sessions — there is no baseline to compare against yet).
   */
  score: number | null;
  label: 'Ready' | 'Steady' | 'Easy day' | 'Calibrating';
  /** Human-readable drivers, most important first (max 3). */
  factors: string[];
  /** Mean daily tonnage, last 7 days (acute load). */
  acute: number;
  /** Mean daily tonnage, last 28 days (chronic load / baseline). */
  chronic: number;
  /** Acute ÷ chronic; > 1.3 is the classic overreaching flag. */
  ratio: number;
}

export interface LoadPoint {
  date: string;
  volume: number;
}

/**
 * Daily readiness from training-derived load only (no wearables needed):
 * an acute:chronic tonnage ratio over 7 vs 28 days, days since the last hard
 * session, and whether the plan's rest days are being respected.
 *
 * Free sees the label; Pro sees the score, the drivers and the load chart.
 */
export function readiness(state: FitnessState, now = new Date()): Readiness {
  const today = toISODate(now);
  const dayMs = 24 * 60 * 60 * 1000;
  const isoDaysAgo = (n: number) => toISODate(new Date(now.getTime() - n * dayMs));

  const sessions = state.sessions.filter((s) => s.date <= today);
  const volumeOnOrAfter = (from: string) =>
    sessions.filter((s) => s.date >= from).reduce((a, s) => a + sessionVolume(s), 0);

  const acute = volumeOnOrAfter(isoDaysAgo(6)) / 7;
  const chronic = volumeOnOrAfter(isoDaysAgo(27)) / 28;
  const ratio = chronic > 0 ? acute / chronic : acute > 0 ? 1.5 : 1;

  if (sessions.length < 3) {
    return {
      score: null,
      label: 'Calibrating',
      factors: [
        sessions.length === 0
          ? 'Log your first sessions to calibrate readiness'
          : `${3 - sessions.length} more session${sessions.length === 2 ? '' : 's'} to calibrate`,
      ],
      acute: Math.round(acute),
      chronic: Math.round(chronic),
      ratio: Math.round(ratio * 100) / 100,
    };
  }

  let score = 80;
  const factors: string[] = [];

  if (ratio > 1.5) {
    score -= 25;
    factors.push(`Volume spiked ${Math.round((ratio - 1) * 100)}% vs your 4-week average`);
  } else if (ratio > 1.3) {
    score -= 15;
    factors.push('Training load is climbing fast — keep the next one moderate');
  } else if (ratio > 1.15) {
    score -= 5;
    factors.push('Load is up slightly on your baseline');
  } else if (ratio < 0.5) {
    score += 5;
    factors.push('Fresh legs — volume is well down on your baseline');
  }

  const lastHard = sessions.find((s) => s.intensity === 'high');
  const daysSinceHard = lastHard
    ? Math.round((now.getTime() - new Date(`${lastHard.date}T12:00:00`).getTime()) / dayMs)
    : 99;
  if (daysSinceHard <= 0) {
    score -= 10;
    factors.push('Hard session logged today — favour technique and volume');
  } else if (daysSinceHard === 1) {
    score -= 5;
    factors.push('Hard session yesterday — see how the warm-up feels');
  } else if (daysSinceHard >= 4) {
    score += 5;
    factors.push('No hard session in 4+ days — a good day to push');
  }

  const trainedDays = new Set(sessions.filter((s) => s.date >= isoDaysAgo(6)).map((s) => s.date));
  const prescribedRest = state.profile.weeklyRestDays;
  if (prescribedRest > 0 && trainedDays.size >= 7 - prescribedRest + 1 && daysSinceHard <= 1) {
    score -= 5;
    factors.push('You are past your planned training days — recovery counts too');
  }

  score = Math.max(5, Math.min(99, Math.round(score)));
  const label = score >= 72 ? 'Ready' : score >= 52 ? 'Steady' : 'Easy day';
  if (label === 'Ready' && factors.length === 0) factors.push('Load and recovery look balanced');
  return {
    score,
    label,
    factors: factors.slice(0, 3),
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    ratio: Math.round(ratio * 100) / 100,
  };
}

/** Daily tonnage series for the load chart (oldest → newest). */
export function loadSeries(state: FitnessState, days = 28, now = new Date()): LoadPoint[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const out: LoadPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = toISODate(new Date(now.getTime() - i * dayMs));
    const volume = state.sessions
      .filter((s) => s.date === date)
      .reduce((a, s) => a + sessionVolume(s), 0);
    out.push({ date, volume: Math.round(volume) });
  }
  return out;
}
