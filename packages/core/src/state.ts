/**
 * State construction and validation.
 *
 * Persisted state is untrusted input: it can come from an older app version, a
 * hand-edited JSON export, a half-written localStorage record or a Firestore
 * document written by a different client. `parseState` normalises anything
 * into a valid `FitnessState`, dropping records it cannot repair, so a single
 * malformed row can never white-screen the app.
 */
import { CATEGORY_FALLBACK_COLOR } from './colors';
import { DEFAULT_CATEGORIES, DEFAULT_WEEK_START } from './constants';
import type {
  BodyLog,
  BodyUnit,
  Category,
  FitnessGoal,
  GeoPoint,
  FitnessState,
  GoalCadence,
  GoalMetric,
  Intensity,
  MealLog,
  MealSlot,
  PlanId,
  RunSplit,
  ScheduledWorkout,
  UserProfile,
  Weekday,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSetKind,
} from './types';

export function emptyProfile(): UserProfile {
  return {
    name: '',
    weightUnit: 'kg',
    distanceUnit: 'km',
    weeklyRestDays: 2,
    weekStartsOn: DEFAULT_WEEK_START,
    planId: 'full-body',
    onboardingDone: false,
  };
}

export function emptyState(): FitnessState {
  return {
    profile: emptyProfile(),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    sessions: [],
    schedule: [],
    goals: [],
    bodyLogs: [],
    meals: [],
  };
}

// ── primitive coercion ──────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function optNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isoDate(v: unknown, fallback: string): string {
  const s = str(v);
  return ISO_DATE.test(s) ? s : fallback;
}

const INTENSITIES = ['low', 'moderate', 'high'] as const satisfies readonly Intensity[];
const GOAL_METRICS = [
  'workouts',
  'minutes',
  'calories',
  'distance',
] as const satisfies readonly GoalMetric[];
const CADENCES = ['weekly', 'monthly'] as const satisfies readonly GoalCadence[];
const BODY_UNITS = [
  'weight',
  'bodyfat',
  'waist',
  'chest',
  'arms',
  'custom',
] as const satisfies readonly BodyUnit[];
const PLAN_IDS = [
  'ppl',
  'upper-lower',
  'full-body',
  'cardio-focus',
] as const satisfies readonly PlanId[];

function weekday(v: unknown): Weekday {
  const n = Math.trunc(num(v, 1));
  return (n >= 0 && n <= 6 ? n : 1) as Weekday;
}

function exercises(v: unknown): WorkoutExercise[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((raw): WorkoutExercise[] => {
    if (!isObj(raw)) return [];
    const name = str(raw.name).trim();
    if (!name) return [];
    const sets = Array.isArray(raw.sets)
      ? raw.sets.filter(isObj).map((s) => {
          const kind = oneOf(
            s.kind,
            ['working', 'warmup', 'drop', 'failure'] as const satisfies readonly WorkoutSetKind[],
            'working',
          );
          const rpe = optNum(s.rpe);
          return {
            reps: optNum(s.reps),
            weight: optNum(s.weight),
            distance: optNum(s.distance),
            duration: optNum(s.duration),
            ...(kind !== 'working' ? { kind } : {}),
            ...(rpe !== undefined && rpe >= 1 && rpe <= 10 ? { rpe } : {}),
          };
        })
      : [];
    return [{ name, sets }];
  });
}

// ── record parsers ──────────────────────────────────────────────────────

function parseProfile(v: unknown): UserProfile {
  const base = emptyProfile();
  if (!isObj(v)) return base;
  const weekStartsOn = num(v.weekStartsOn, DEFAULT_WEEK_START);
  const profile: UserProfile = {
    name: str(v.name, base.name),
    weightUnit: oneOf(v.weightUnit, ['kg', 'lb'] as const, base.weightUnit),
    distanceUnit: oneOf(v.distanceUnit, ['km', 'mi'] as const, base.distanceUnit),
    weeklyRestDays: Math.min(
      6,
      Math.max(0, Math.round(num(v.weeklyRestDays, base.weeklyRestDays))),
    ),
    weekStartsOn: weekStartsOn === 0 ? 0 : 1,
    planId: oneOf(v.planId, PLAN_IDS, base.planId),
    onboardingDone: bool(v.onboardingDone, base.onboardingDone),
  };
  // Optional target weight (canonical kg): kept only when it is a sane
  // number, and omitted entirely otherwise so fresh profiles stay keyless.
  const tw = v.targetWeightKg;
  if (typeof tw === 'number' && Number.isFinite(tw) && tw >= 20 && tw <= 400) {
    profile.targetWeightKg = Math.round(tw * 10) / 10;
  }
  // Optional gym program id: any short non-empty string survives parsing;
  // the UI resolves it against the known catalog (unknown → no suggestions).
  const gymId = str(v.gymId, '').trim();
  if (gymId && gymId.length <= 64) profile.gymId = gymId;
  // Fuel refinements — each kept only inside a sane range so a bad write can
  // never poison the targets; omitted keys stay omitted.
  if (v.nutritionGoal === 'cut' || v.nutritionGoal === 'maintain' || v.nutritionGoal === 'gain') {
    profile.nutritionGoal = v.nutritionGoal;
  }
  const activity = v.activityLevel;
  if (
    activity === 'sedentary' ||
    activity === 'light' ||
    activity === 'moderate' ||
    activity === 'active'
  ) {
    profile.activityLevel = activity;
  }
  if (v.sex === 'female' || v.sex === 'male') profile.sex = v.sex;
  const age = v.ageYears;
  if (typeof age === 'number' && Number.isFinite(age) && age >= 10 && age <= 100) {
    profile.ageYears = Math.round(age);
  }
  const height = v.heightCm;
  if (typeof height === 'number' && Number.isFinite(height) && height >= 100 && height <= 250) {
    profile.heightCm = Math.round(height);
  }
  // Optional Pro stamp: only a well-formed {plan, since} pair is kept.
  if (isObj(v.pro)) {
    const rawPlan = v.pro.plan;
    const plan: 'monthly' | 'yearly' | 'lifetime' | 'trial' | null =
      rawPlan === 'monthly' || rawPlan === 'yearly' || rawPlan === 'lifetime' || rawPlan === 'trial'
        ? rawPlan
        : null;
    const since = num(v.pro.since, 0);
    if (plan && since > 0) profile.pro = { plan, since };
  }
  return profile;
}

function parseCategory(v: unknown): Category | null {
  if (!isObj(v)) return null;
  const id = str(v.id).trim();
  const name = str(v.name).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    icon: str(v.icon, 'activity'),
    color: str(v.color, CATEGORY_FALLBACK_COLOR),
    builtin: v.builtin === true,
  };
}

function parseSession(v: unknown): WorkoutSession | null {
  if (!isObj(v)) return null;
  const id = str(v.id).trim();
  const date = isoDate(v.date, '');
  if (!id || !date) return null;
  return {
    id,
    date,
    categoryId: str(v.categoryId, 'cat-strength'),
    title: str(v.title, 'Workout'),
    durationMin: Math.max(0, Math.round(num(v.durationMin, 0))),
    intensity: oneOf(v.intensity, INTENSITIES, 'moderate'),
    calories: Math.max(0, Math.round(num(v.calories, 0))),
    distanceKm: optNum(v.distanceKm),
    exercises: exercises(v.exercises),
    notes: str(v.notes) || undefined,
    scheduleId: str(v.scheduleId) || undefined,
    route: parseRoute(v.route),
    movingTimeMin: optNum(v.movingTimeMin),
    elevationGainM: optNum(v.elevationGainM),
    splits: parseSplits(v.splits),
    createdAt: num(v.createdAt, Date.now()),
  };
}

/**
 * Stored splits are trusted only as far as their numbers: keep well-formed
 * entries, cap the count (a 200 km ultra is not a use case this app stores)
 * and drop the field entirely when nothing survives.
 */
function parseSplits(v: unknown): RunSplit[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: RunSplit[] = [];
  for (const raw of v) {
    if (!isObj(raw)) continue;
    const durationSec = num(raw.durationSec, NaN);
    const distanceKm = num(raw.distanceKm, NaN);
    if (!Number.isFinite(durationSec) || durationSec < 0) continue;
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) continue;
    const pace = num(raw.paceMinPerKm, durationSec / 60 / distanceKm);
    out.push({
      index: Math.max(1, Math.round(num(raw.index, out.length + 1))),
      distanceKm,
      durationSec: Math.round(durationSec),
      paceMinPerKm: Number.isFinite(pace) && pace > 0 ? pace : durationSec / 60 / distanceKm,
      elevationGainM: Math.max(0, Math.round(num(raw.elevationGainM, 0))),
      partial: raw.partial === true,
    });
    if (out.length >= 200) break;
  }
  return out.length > 0 ? out : undefined;
}

/**
 * A GPS trace is untrusted like everything else: drop non-finite fixes and
 * cap the length so a malformed or oversized route can never bloat storage.
 * Returns undefined unless at least two sane points survive (a route needs a
 * line, not a dot).
 */
function parseRoute(v: unknown): GeoPoint[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: GeoPoint[] = [];
  for (const raw of v) {
    if (!isObj(raw)) continue;
    const lat = num(raw.lat, NaN);
    const lng = num(raw.lng, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const t = optNum(raw.t);
    const ele = optNum(raw.ele);
    const point: GeoPoint = { lat, lng };
    if (t !== undefined) point.t = t;
    if (ele !== undefined) point.ele = ele;
    out.push(point);
    if (out.length >= 1000) break;
  }
  return out.length >= 2 ? out : undefined;
}

function parseSchedule(v: unknown): ScheduledWorkout | null {
  if (!isObj(v)) return null;
  const id = str(v.id).trim();
  if (!id) return null;
  const time = str(v.timeOfDay, '07:00');
  const slot: ScheduledWorkout = {
    id,
    title: str(v.title, 'Scheduled session'),
    categoryId: str(v.categoryId, 'cat-strength'),
    weekday: weekday(v.weekday),
    timeOfDay: /^\d{2}:\d{2}$/.test(time) ? time : '07:00',
    durationMin: Math.max(1, Math.round(num(v.durationMin, 45))),
    intensity: oneOf(v.intensity, INTENSITIES, 'moderate'),
    active: bool(v.active, true),
    createdAt: num(v.createdAt, Date.now()),
  };
  // Optional routine: only kept when it parses to a non-empty list, so a
  // plain reminder stays keyless rather than carrying `exercises: []`.
  const routine = exercises(v.exercises);
  if (routine.length > 0) slot.exercises = routine;
  return slot;
}

function parseGoal(v: unknown): FitnessGoal | null {
  if (!isObj(v)) return null;
  const id = str(v.id).trim();
  if (!id) return null;
  const metric = oneOf(v.metric, GOAL_METRICS, 'workouts');
  return {
    id,
    name: str(v.name, 'Goal'),
    metric,
    cadence: oneOf(v.cadence, CADENCES, 'weekly'),
    target: Math.max(0, num(v.target, 1)),
    startDate: isoDate(v.startDate, new Date().toISOString().slice(0, 10)),
    createdAt: num(v.createdAt, Date.now()),
  };
}

function parseBodyLog(v: unknown): BodyLog | null {
  if (!isObj(v)) return null;
  const id = str(v.id).trim();
  const date = isoDate(v.date, '');
  const value = optNum(v.value);
  if (!id || !date || value === undefined) return null;
  return {
    id,
    date,
    unit: oneOf(v.unit, BODY_UNITS, 'weight'),
    label: str(v.label) || undefined,
    value,
    createdAt: num(v.createdAt, Date.now()),
  };
}

const MEAL_SLOT_IDS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function parseMeal(v: unknown): MealLog | null {
  if (!isObj(v)) return null;
  const id = str(v.id).trim();
  const date = isoDate(v.date, '');
  const calories = optNum(v.calories);
  if (!id || !date || calories === undefined) return null;
  const carbs = optNum(v.carbs);
  const fat = optNum(v.fat);
  return {
    id,
    date,
    name: str(v.name, 'Meal').slice(0, 120) || 'Meal',
    slot: oneOf(v.slot, MEAL_SLOT_IDS, 'snack'),
    calories: Math.max(0, calories),
    protein: Math.max(0, optNum(v.protein) ?? 0),
    carbs: carbs === undefined ? undefined : Math.max(0, carbs),
    fat: fat === undefined ? undefined : Math.max(0, fat),
    scanned: v.scanned === true ? true : undefined,
    createdAt: num(v.createdAt, Date.now()),
  };
}

function collect<T>(v: unknown, parse: (item: unknown) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const parsed = parse(item);
    if (!parsed) continue;
    const id = (parsed as unknown as { id: string }).id;
    if (seen.has(id)) continue; // de-duplicate on id
    seen.add(id);
    out.push(parsed);
  }
  return out;
}

/**
 * Normalise arbitrary persisted data into a valid `FitnessState`.
 * Never throws; unrecoverable records are dropped rather than crashing a render.
 */
export function parseState(raw: unknown): FitnessState {
  if (!isObj(raw)) return emptyState();

  const categories = collect(raw.categories, parseCategory);
  // Built-in categories must always exist, even if a bad write removed them.
  const byId = new Map(categories.map((c) => [c.id, c]));
  for (const def of DEFAULT_CATEGORIES) {
    if (!byId.has(def.id)) byId.set(def.id, { ...def });
  }

  return {
    profile: parseProfile(raw.profile),
    categories: [...byId.values()],
    sessions: collect(raw.sessions, parseSession).sort((a, b) => (a.date < b.date ? 1 : -1)),
    schedule: collect(raw.schedule, parseSchedule),
    goals: collect(raw.goals, parseGoal),
    bodyLogs: collect(raw.bodyLogs, parseBodyLog).sort((a, b) => (a.date < b.date ? 1 : -1)),
    meals: collect(raw.meals, parseMeal).sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

/** Parse a JSON string (e.g. a localStorage payload or an import file). */
export function parseStateJSON(json: string | null | undefined): FitnessState | null {
  if (!json) return null;
  try {
    return parseState(JSON.parse(json));
  } catch {
    return null;
  }
}

/** True when the state holds nothing the user created. */
export function isEmptyState(state: FitnessState): boolean {
  return (
    state.sessions.length === 0 &&
    state.schedule.length === 0 &&
    state.goals.length === 0 &&
    state.bodyLogs.length === 0 &&
    state.meals.length === 0
  );
}
