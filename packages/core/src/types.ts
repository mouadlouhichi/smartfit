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

export interface Category {
  id: string;
  name: string;
  icon: string; // lucide icon key, see category-icon
  color: string; // hex accent
  builtin?: boolean;
}

export interface WorkoutSet {
  reps?: number;
  weight?: number; // kg
  distance?: number; // km
  duration?: number; // minutes
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
  distanceKm?: number;
  exercises: WorkoutExercise[];
  notes?: string;
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
  value: number;
  createdAt: number;
}

export type PlanId = 'ppl' | 'upper-lower' | 'full-body' | 'cardio-focus';

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  sessionsPerWeek: number;
  split: { weekday: Weekday; focus: string; categoryId: string }[];
}

export interface UserProfile {
  name: string;
  weightUnit: 'kg' | 'lb';
  distanceUnit: 'km' | 'mi';
  weeklyRestDays: number;
  planId: PlanId;
  onboardingDone: boolean;
}

export interface FitnessState {
  profile: UserProfile;
  categories: Category[];
  sessions: WorkoutSession[];
  schedule: ScheduledWorkout[];
  goals: FitnessGoal[];
  bodyLogs: BodyLog[];
}
