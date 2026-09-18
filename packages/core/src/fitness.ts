import { INTENSITY_META, PLANS, DEFAULT_WEEK_START } from './constants';
import type {
  Category,
  FitnessState,
  GoalMetric,
  Intensity,
  UserProfile,
  WeekStart,
  WorkoutExercise,
  WorkoutSession,
} from './types';
import { clamp, round } from './utils';
import { CATEGORY_FALLBACK_COLOR } from './colors';
import { matchExercise, type ExerciseEquipment, type ExerciseGroup } from './exercises';

/** Reference body mass used when the user has never logged a weight. */
export const DEFAULT_BODY_WEIGHT_KG = 75;

/**
 * Estimated energy cost of a session, using the standard MET formula:
 *   kcal = MET × 3.5 × kg / 200 × minutes
 *
 * Intensity maps to a representative MET value. Passing the athlete's body
 * mass makes the estimate personal — a 100 kg lifter genuinely burns more for
 * the same session than a 55 kg one. Without it we fall back to a 75 kg
 * reference so the number stays stable rather than silently wrong.
 */
export function estimateCalories(
  durationMin: number,
  intensity: Intensity,
  bodyWeightKg: number = DEFAULT_BODY_WEIGHT_KG,
): number {
  const met = INTENSITY_META[intensity].met;
  const kg = bodyWeightKg > 0 ? bodyWeightKg : DEFAULT_BODY_WEIGHT_KG;
  const kcal = ((met * 3.5 * kg) / 200) * Math.max(0, durationMin);
  return Math.round(kcal / 5) * 5;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse an ISO yyyy-mm-dd as a *local* midnight date (never UTC-shifted). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** The single source of truth for "which day does the week start on". */
export function weekStartOf(state?: { profile?: Partial<UserProfile> }): WeekStart {
  const v = state?.profile?.weekStartsOn;
  return v === 0 || v === 1 ? v : DEFAULT_WEEK_START;
}

export function startOfWeek(
  d: Date = new Date(),
  weekStartsOn: WeekStart = DEFAULT_WEEK_START,
): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

export function endOfWeek(
  d: Date = new Date(),
  weekStartsOn: WeekStart = DEFAULT_WEEK_START,
): Date {
  const s = startOfWeek(d, weekStartsOn);
  s.setDate(s.getDate() + 6);
  return s;
}

export function weekKey(iso: string, weekStartsOn: WeekStart = DEFAULT_WEEK_START): string {
  return toISODate(startOfWeek(fromISODate(iso), weekStartsOn));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // yyyy-mm
}

export interface WeekAggregate {
  key: string;
  label: string;
  workouts: number;
  minutes: number;
  calories: number;
  distance: number;
}

export function sessionsInRange(
  state: FitnessState,
  fromISO: string,
  toISO: string,
): WorkoutSession[] {
  return state.sessions.filter((s) => s.date >= fromISO && s.date <= toISO);
}

/** Sessions in the last `days` calendar days, inclusive of today. */
export function sessionsInLastDays(
  state: FitnessState,
  days: number,
  now = new Date(),
): WorkoutSession[] {
  const from = startOfDay(now);
  from.setDate(from.getDate() - (Math.max(1, days) - 1));
  return sessionsInRange(state, toISODate(from), toISODate(now));
}

export function aggregate(sessions: WorkoutSession[]): Omit<WeekAggregate, 'key' | 'label'> {
  return {
    workouts: sessions.length,
    minutes: sessions.reduce((a, s) => a + s.durationMin, 0),
    calories: sessions.reduce((a, s) => a + s.calories, 0),
    distance: round(
      sessions.reduce((a, s) => a + (s.distanceKm ?? 0), 0),
      1,
    ),
  };
}

/** Last `n` weeks of aggregates, oldest first — the chart series. */
export function weeklySeries(state: FitnessState, n = 8, now = new Date()): WeekAggregate[] {
  const ws0 = weekStartOf(state);
  const out: WeekAggregate[] = [];
  const start = startOfWeek(now, ws0);
  for (let i = n - 1; i >= 0; i--) {
    const ws = new Date(start);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const from = toISODate(ws);
    const to = toISODate(we);
    const agg = aggregate(sessionsInRange(state, from, to));
    out.push({
      key: from,
      label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ...agg,
    });
  }
  return out;
}

export function thisWeek(state: FitnessState, now = new Date()): WeekAggregate {
  const ws0 = weekStartOf(state);
  const s = startOfWeek(now, ws0);
  const e = endOfWeek(now, ws0);
  return {
    key: toISODate(s),
    label: 'This week',
    ...aggregate(sessionsInRange(state, toISODate(s), toISODate(e))),
  };
}

/**
 * Rest-day-aware training streak.
 *
 * A naive "consecutive calendar days" streak is meaningless here: every plan
 * SmartFit ships prescribes 3–6 sessions a week, so a strict streak resets
 * constantly and always reads "1". Instead we walk back day by day and allow
 * up to `weeklyRestDays` consecutive rest days before the run is considered
 * broken. The number returned is the count of *training days* in the current
 * unbroken run.
 */
export function currentStreak(state: FitnessState, now = new Date()): number {
  if (state.sessions.length === 0) return 0;
  const days = new Set(state.sessions.map((s) => s.date));
  const maxGap = clamp(Math.round(state.profile?.weeklyRestDays ?? 2), 0, 6);
  const cursor = startOfDay(now);
  let streak = 0;
  let gap = 0;

  // Today isn't over yet — not having trained *so far today* must never break
  // a run, so step over it rather than counting it as a missed day.
  if (!days.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);

  // Two years of history is far more than any streak needs.
  for (let i = 0; i < 730; i++) {
    if (days.has(toISODate(cursor))) {
      streak++;
      gap = 0;
    } else {
      gap++;
      if (gap > maxGap) break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Consecutive weeks (ending this week or last) in which the weekly target was
 * met. `target` defaults to the user's weekly workout goal, else the number of
 * sessions their chosen plan prescribes.
 */
export function weeklyStreak(state: FitnessState, now = new Date()): number {
  const ws0 = weekStartOf(state);
  const goal = state.goals.find((g) => g.cadence === 'weekly' && g.metric === 'workouts');
  const target = Math.max(
    1,
    Math.round(goal?.target ?? getPlan(state.profile.planId).sessionsPerWeek),
  );

  let weeks = 0;
  const cursor = startOfWeek(now, ws0);
  for (let i = 0; i < 260; i++) {
    const from = toISODate(cursor);
    const to = new Date(cursor);
    to.setDate(to.getDate() + 6);
    const count = sessionsInRange(state, from, toISODate(to)).length;
    if (count >= target) {
      weeks++;
    } else if (i > 0) {
      break; // an incomplete *current* week shouldn't break the run
    }
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

/** Days since the most recent logged session, or null if nothing is logged. */
export function daysSinceLastSession(state: FitnessState, now = new Date()): number | null {
  if (state.sessions.length === 0) return null;
  const latest = state.sessions.reduce((a, s) => (s.date > a ? s.date : a), state.sessions[0].date);
  const diff = startOfDay(now).getTime() - fromISODate(latest).getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}

export function totalWorkouts(state: FitnessState): number {
  return state.sessions.length;
}

export function metricValue(sessions: WorkoutSession[], metric: GoalMetric): number {
  switch (metric) {
    case 'workouts':
      return sessions.length;
    case 'minutes':
      return sessions.reduce((a, s) => a + s.durationMin, 0);
    case 'calories':
      return sessions.reduce((a, s) => a + s.calories, 0);
    case 'distance':
      return round(
        sessions.reduce((a, s) => a + (s.distanceKm ?? 0), 0),
        1,
      );
  }
}

export interface GoalProgress {
  current: number;
  target: number;
  pct: number;
  done: boolean;
}

export function goalProgress(
  state: FitnessState,
  goal: { metric: GoalMetric; cadence: 'weekly' | 'monthly'; target: number },
  now = new Date(),
): GoalProgress {
  let sessions: WorkoutSession[];
  if (goal.cadence === 'weekly') {
    const ws0 = weekStartOf(state);
    sessions = sessionsInRange(
      state,
      toISODate(startOfWeek(now, ws0)),
      toISODate(endOfWeek(now, ws0)),
    );
  } else {
    const first = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const last = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    sessions = sessionsInRange(state, first, last);
  }
  const current = metricValue(sessions, goal.metric);
  const pct = goal.target > 0 ? Math.min(100, (current / goal.target) * 100) : 0;
  return { current, target: goal.target, pct: round(pct, 0), done: current >= goal.target };
}

/** Placeholder shown for sessions whose activity type was deleted. */
export const UNKNOWN_CATEGORY: Category = {
  id: '__unknown__',
  name: 'Other',
  icon: 'activity',
  color: CATEGORY_FALLBACK_COLOR,
};

export function categoryById(state: FitnessState, id: string): Category {
  return state.categories.find((c) => c.id === id) ?? UNKNOWN_CATEGORY;
}

/**
 * Minutes per activity type, highest first.
 *
 * Sessions whose category has since been deleted are folded into a single
 * "Other" bucket rather than silently dropped — previously their minutes
 * disappeared from the activity mix and the totals stopped adding up.
 */
export function categoryBreakdown(state: FitnessState, sessions?: WorkoutSession[]) {
  const list = sessions ?? state.sessions;
  const minutes = new Map<string, number>();
  for (const s of list) {
    minutes.set(s.categoryId, (minutes.get(s.categoryId) ?? 0) + s.durationMin);
  }

  const known = state.categories
    .map((c) => ({ category: c, minutes: minutes.get(c.id) ?? 0 }))
    .filter((x) => x.minutes > 0);

  const knownIds = new Set(state.categories.map((c) => c.id));
  const orphanMinutes = [...minutes.entries()]
    .filter(([id]) => !knownIds.has(id))
    .reduce((a, [, m]) => a + m, 0);

  const rows =
    orphanMinutes > 0 ? [...known, { category: UNKNOWN_CATEGORY, minutes: orphanMinutes }] : known;

  return rows.sort((a, b) => b.minutes - a.minutes);
}

/** How many records reference a given activity type. */
export function categoryUsage(state: FitnessState, categoryId: string): number {
  return (
    state.sessions.filter((s) => s.categoryId === categoryId).length +
    state.schedule.filter((s) => s.categoryId === categoryId).length
  );
}

export function getPlan(planId: string) {
  return PLANS.find((p) => p.id === planId) ?? PLANS[2];
}

export function todaysFocus(state: FitnessState, now = new Date()): string | null {
  const plan = getPlan(state.profile.planId);
  const wd = now.getDay();
  const slot = plan.split.find((s) => s.weekday === wd);
  return slot ? slot.focus : null;
}

/** Scheduled sessions for a given weekday, earliest first. */
export function scheduledFor(state: FitnessState, weekday: number, activeOnly = true) {
  return state.schedule
    .filter((s) => s.weekday === weekday && (!activeOnly || s.active))
    .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
}

/**
 * Today's scheduled slots paired with whether a session has already been
 * logged against them — the bridge between "the plan" and "the log".
 */
export function todaysAgenda(state: FitnessState, now = new Date()) {
  const today = toISODate(now);
  const todaysSessions = state.sessions.filter((s) => s.date === today);
  return scheduledFor(state, now.getDay()).map((slot) => {
    const done = todaysSessions.find(
      (s) => s.scheduleId === slot.id || (!s.scheduleId && s.title === slot.title),
    );
    return { slot, done: done ?? null };
  });
}

export function latestBodyValue(state: FitnessState, unit: string): number | null {
  const logs = state.bodyLogs
    .filter((l) => l.unit === unit)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return logs.length ? logs[0].value : null;
}

/** Most recently logged body mass in kg, for calorie estimation. */
export function latestBodyWeightKg(state: FitnessState): number | null {
  return latestBodyValue(state, 'weight');
}

/* ── Activity targets ─────────────────────────────────────────────────────
 * What the dashboard should measure "today / this week / this month" against.
 *
 * The rule is: the user's own goals win. Only when a metric has no goal do we
 * fall back to something derived from their chosen plan — never to a constant
 * plucked out of the air, which is what the summary rings used to do.
 */

export interface ActivityTargets {
  workouts: number;
  minutes: number;
  calories: number;
  distanceKm: number;
  /** True when at least one figure came from a goal the user actually set. */
  fromGoals: boolean;
}

/** Typical session length, used to derive a minutes target from a plan. */
export const ASSUMED_SESSION_MIN = 45;
const WEEKS_PER_MONTH = 30 / 7;

/** Per-week target for one metric, taking monthly goals into account. */
function weeklyTargetFor(state: FitnessState, metric: GoalMetric): number | null {
  const weekly = state.goals.find((g) => g.metric === metric && g.cadence === 'weekly');
  if (weekly) return weekly.target;
  const monthly = state.goals.find((g) => g.metric === metric && g.cadence === 'monthly');
  if (monthly) return monthly.target / WEEKS_PER_MONTH;
  return null;
}

/**
 * Targets scaled to an arbitrary window (1 day, 7 days, 30 days…).
 * `days` must be >= 1.
 */
export function targetsForDays(state: FitnessState, days: number): ActivityTargets {
  const span = Math.max(1, days) / 7;
  const plan = getPlan(state.profile.planId);

  const goalWorkouts = weeklyTargetFor(state, 'workouts');
  const goalMinutes = weeklyTargetFor(state, 'minutes');
  const goalCalories = weeklyTargetFor(state, 'calories');
  const goalDistance = weeklyTargetFor(state, 'distance');

  // Plan-derived fallbacks: sessions per week, and the minutes those imply.
  const weeklyWorkouts = goalWorkouts ?? plan.sessionsPerWeek;
  const weeklyMinutes = goalMinutes ?? weeklyWorkouts * ASSUMED_SESSION_MIN;

  const scale = (weekly: number, min: number) => Math.max(min, Math.round(weekly * span));

  return {
    workouts: scale(weeklyWorkouts, 1),
    minutes: scale(weeklyMinutes, 10),
    calories: goalCalories !== null ? scale(goalCalories, 1) : 0,
    distanceKm: goalDistance !== null ? round(goalDistance * span, 1) : 0,
    fromGoals:
      goalWorkouts !== null ||
      goalMinutes !== null ||
      goalCalories !== null ||
      goalDistance !== null,
  };
}

/** Convenience: this week's targets. */
export function weeklyTargets(state: FitnessState): ActivityTargets {
  return targetsForDays(state, 7);
}

/** Streak celebration milestones — the next goal the app cheers toward. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

/** The next streak milestone above `streak` (streak + 1 when past the last). */
export function nextStreakMilestone(streak: number): number {
  return STREAK_MILESTONES.find((m) => m > streak) ?? streak + 1;
}

/* ── Per-exercise energy cost ──────────────────────────────────────────────
   `estimateCalories` above prices a *session* from its overall intensity.
   That is right for a logged summary but too coarse for the live runner,
   where a set of deadlifts and a set of curls cost visibly different
   amounts. These helpers price a single movement instead. */

/**
 * Representative MET values per exercise group, for resistance work performed
 * set-wise (i.e. including the rest that makes sets possible).
 *
 * Anchored on the Compendium of Physical Activities: resistance training is
 * ~3.5 METs light, ~5.0 vigorous, and multi-joint lower-body and conditioning
 * work sits higher than single-joint arm work. These are deliberately modest
 * — over-crediting strength work is the most common failure of fitness-app
 * calorie maths.
 */
const GROUP_MET: Record<ExerciseGroup, number> = {
  legs: 6,
  back: 5.5,
  chest: 5,
  shoulders: 4.5,
  arms: 3.8,
  core: 4,
  conditioning: 8,
  mobility: 2.5,
};

/** Equipment nudges: free weights demand more stabilising than a machine. */
const EQUIPMENT_FACTOR: Partial<Record<ExerciseEquipment, number>> = {
  barbell: 1.1,
  dumbbell: 1.05,
  kettlebell: 1.15,
  machine: 0.9,
  cable: 0.95,
  band: 0.85,
  running: 1.2,
  pool: 1.2,
};

/** Seconds a single working set occupies, including its rest. */
const SECONDS_PER_SET = 45;
const REST_SECONDS_PER_SET = 60;

/**
 * MET value for one catalog movement, blending its group with its equipment.
 * Unknown names fall back to a generic resistance-training 5.0.
 */
export function exerciseMet(name: string): number {
  const entry = matchExercise(name);
  if (!entry) return 5;
  const base = GROUP_MET[entry.group] ?? 5;
  return base * (EQUIPMENT_FACTOR[entry.equipment] ?? 1);
}

/**
 * Energy cost of a single logged exercise.
 *
 * Time under load is derived from the sets actually recorded rather than a
 * flat per-exercise guess, so three sets cost roughly three times one. A set
 * that carries its own `duration` (planks, carries, intervals) uses that
 * instead of the nominal working-set length. Only sets the athlete has
 * actually performed should be passed in — warm-ups still cost energy, so
 * they are included, but skipped sets should be filtered by the caller.
 */
export function estimateExerciseCalories(
  exercise: WorkoutExercise,
  bodyWeightKg: number = DEFAULT_BODY_WEIGHT_KG,
): number {
  const kg = bodyWeightKg > 0 ? bodyWeightKg : DEFAULT_BODY_WEIGHT_KG;
  const met = exerciseMet(exercise.name);

  const minutes = exercise.sets.reduce((total, set) => {
    if (set.duration && set.duration > 0) return total + set.duration;
    return total + (SECONDS_PER_SET + REST_SECONDS_PER_SET) / 60;
  }, 0);

  return Math.round(((met * 3.5 * kg) / 200) * minutes);
}

/** Summed energy cost of every exercise in a session. */
export function estimateExercisesCalories(
  exercises: WorkoutExercise[],
  bodyWeightKg: number = DEFAULT_BODY_WEIGHT_KG,
): number {
  return exercises.reduce((total, ex) => total + estimateExerciseCalories(ex, bodyWeightKg), 0);
}
