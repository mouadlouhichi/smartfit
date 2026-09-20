/**
 * SmartFit domain model.
 * The fitness analogue of the reference finance app's split between
 * "what money is for" (envelope/category) and "where it sits" (place):
 *
 *  - Activity category  -> what the training IS (Strength / Cardio / Mobility…)
 *  - Workout session    -> a logged, completed bout on a given date/place
 *  - Scheduled workout  -> the recurring plan (like fixed bills)
 *  - Goal               -> a persistent target that survives week rollover
 *  - Body log           -> body-composition / measurement history
 *  - Plan               -> the training strategy (like a budgeting strategy)
 */

export type Intensity = 'low' | 'moderate' | 'high';

export type GoalMetric =
  | 'workouts' // number of completed sessions
  | 'minutes' // total active minutes
  | 'calories' // estimated kcal burned
  | 'distance'; // total distance (km)

export type GoalCadence = 'weekly' | 'monthly';

export type BodyUnit = 'weight' | 'bodyfat' | 'waist' | 'chest' | 'arms' | 'custom';

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';

/** First day of the training week. 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;

export interface Category {
  id: string;
  name: string;
  icon: string; // lucide icon key, see category-icon
  color: string; // hex accent
  builtin?: boolean;
}

export type WorkoutSetKind = 'working' | 'warmup' | 'drop' | 'failure';

export interface WorkoutSet {
  reps?: number;
  weight?: number; // canonical kg
  distance?: number; // km
  duration?: number; // minutes
  /** Optional classification so warm-ups do not become strength PRs. */
  kind?: WorkoutSetKind;
  /** Optional perceived exertion score, 1–10. */
  rpe?: number;
}

/** One GPS fix captured by the walk tracker. */
export interface GeoPoint {
  lat: number;
  lng: number;
  /** Epoch ms of the fix (for pace); optional and dropped when absent. */
  t?: number;
  /** Barometric/GPS elevation in metres, when the device reports it. */
  ele?: number;
}

/**
 * One kilometre (or mile) of a tracked run, as stored on the session so
 * history and share cards never recompute from raw GPS.
 */
export interface RunSplit {
  /** 1-based split number. */
  index: number;
  distanceKm: number;
  /** Seconds spent on this split, excluding auto-paused time. */
  durationSec: number;
  paceMinPerKm: number;
  elevationGainM: number;
  /** True for the trailing, incomplete split. */
  partial: boolean;
}

/** A fastest-window effort inside one run ("Fastest 1 km"). */
export interface RunBestEffort {
  label: string;
  distanceKm: number;
  durationSec: number;
  paceMinPerKm: number;
}

/** Everything the run tracker derives from a GPS trace. */
export interface RunStats {
  distanceKm: number;
  /** Wall-clock seconds, first fix → last fix. */
  elapsedSec: number;
  /** Seconds actually moving (auto-paused stretches excluded). */
  movingSec: number;
  stoppedSec: number;
  /** Minutes per kilometre over moving time. */
  avgPaceMinPerKm: number;
  /** Fastest split pace of the session. */
  bestPaceMinPerKm: number;
  elevationGainM: number;
  elevationLossM: number;
  splits: RunSplit[];
  bestEfforts: RunBestEffort[];
  startedAt?: number;
  endedAt?: number;
}

export interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO yyyy-mm-dd
  categoryId: string;
  title: string;
  durationMin: number;
  intensity: Intensity;
  calories: number; // estimated kcal
  distanceKm?: number; // canonical km
  exercises: WorkoutExercise[];
  notes?: string;
  /** Set when this session was logged from a scheduled slot. */
  scheduleId?: string;
  /** GPS trace captured by the walk tracker (drives the shareable route map). */
  route?: GeoPoint[];
  /** Run tracker extras — present only on GPS-recorded sessions. */
  movingTimeMin?: number;
  elevationGainM?: number;
  /** Per-kilometre splits, stored so history/share never recompute them. */
  splits?: RunSplit[];
  createdAt: number;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface ScheduledWorkout {
  id: string;
  title: string;
  categoryId: string;
  weekday: Weekday;
  timeOfDay: string; // "07:30"
  durationMin: number;
  intensity: Intensity;
  active: boolean;
  createdAt: number;
  /**
   * The routine this slot runs — its exercise list, with target sets.
   * Optional and backwards-compatible: a slot without one still works as a
   * reminder, and the guided runner simply starts from an empty list.
   * This is what turns a schedule entry into a real *workout template*.
   */
  exercises?: WorkoutExercise[];
}

export interface FitnessGoal {
  id: string;
  name: string;
  metric: GoalMetric;
  cadence: GoalCadence;
  target: number;
  startDate: string;
  createdAt: number;
}

export interface BodyLog {
  id: string;
  date: string; // ISO yyyy-mm-dd
  unit: BodyUnit;
  label?: string; // for custom
  /** Canonical value: kg for weight, cm for circumferences, % for bodyfat. */
  value: number;
  createdAt: number;
}

/** Which eating occasion a meal log belongs to (day is on `date`). */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * One logged meal / food entry. Macros are optional beyond calories and
 * protein — the two numbers people actually track — so logging stays fast.
 */
export interface MealLog {
  id: string;
  date: string; // ISO yyyy-mm-dd
  name: string;
  slot: MealSlot;
  calories: number; // kcal
  protein: number; // grams
  carbs?: number; // grams
  fat?: number; // grams
  /** Set when the entry came from the on-device meal scan. */
  scanned?: boolean;
  createdAt: number;
}

export type PlanId = 'ppl' | 'upper-lower' | 'full-body' | 'cardio-focus';

/** Subscription stamp for the paid tier (see `pro.ts`); receipt checks happen in the billing adapter. */
export interface ProStatus {
  /**
   * `trial` is issued locally by the sandbox billing adapter for the free
   * trial and expires after `PRO_TRIAL_DAYS`; `monthly`/`yearly`/`lifetime`
   * come from a real receipt and never expire client-side.
   */
  plan: 'monthly' | 'yearly' | 'lifetime' | 'trial';
  /** Epoch ms of activation. */
  since: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  sessionsPerWeek: number;
  split: { weekday: Weekday; focus: string; categoryId: string }[];
}

export interface UserProfile {
  name: string;
  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;
  /** Planned rest days per week — used by the rest-day-aware streak. */
  weeklyRestDays: number;
  /** First day of the training week (0 = Sunday, 1 = Monday). */
  weekStartsOn: WeekStart;
  planId: PlanId;
  onboardingDone: boolean;
  /**
   * Optional target body weight in canonical kg. Drives the suggested
   * program mix (burn-heavy while far away, maintenance once reached).
   */
  targetWeightKg?: number;
  /**
   * Optional selected gym program id (see GYM_PROGRAMS, e.g. 'zone-fight').
   * When set, the app proposes a weekly program built from that gym's real
   * class timetable.
   */
  gymId?: string;
  /** SmartFit Pro subscription stamp (absent = free tier). */
  pro?: ProStatus;
  /**
   * Nutrition goal — overrides the value derived from `targetWeightKg`
   * versus the latest weigh-in. Drives the calorie/protein targets.
   */
  nutritionGoal?: 'cut' | 'maintain' | 'gain';
  /** Daily activity multiplier used for the energy targets (Fuel screen). */
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active';
  /** Optional refinements for Mifflin-St Jeor; omitted = weight-based estimate. */
  sex?: 'female' | 'male';
  ageYears?: number;
  heightCm?: number;
}

export interface FitnessState {
  profile: UserProfile;
  categories: Category[];
  sessions: WorkoutSession[];
  schedule: ScheduledWorkout[];
  goals: FitnessGoal[];
  bodyLogs: BodyLog[];
  meals: MealLog[];
}
