import { FeatureError, objectValue } from './content';
import type { ScheduledWorkout, Weekday } from './types';
export interface TrainingPreferences {
  schemaVersion: 1;
  goal: 'strength' | 'muscle' | 'fitness';
  experience: 'beginner' | 'intermediate' | 'advanced';
  location: 'home' | 'gym' | 'outdoors';
  days: Weekday[];
  minutes: 15 | 20 | 30 | 45 | 60;
  equipment: ('bodyweight' | 'dumbbells')[];
  constraints: ('no-floor' | 'no-overhead')[];
  excludedExercises: string[];
  /** Self-reported need for professional advice; never generate through it. */
  needsClearance: boolean;
}
export const DEFAULT_TRAINING_PREFERENCES: TrainingPreferences = {
  schemaVersion: 1,
  goal: 'fitness',
  experience: 'beginner',
  location: 'home',
  days: [1, 3, 5],
  minutes: 20,
  equipment: ['bodyweight'],
  constraints: [],
  excludedExercises: [],
  needsClearance: false,
};
export function parseTrainingPreferences(value: unknown): TrainingPreferences {
  const v = objectValue(value);
  if (v.schemaVersion !== 1) throw new FeatureError('Unsupported preferences version.');
  if (
    !['strength', 'muscle', 'fitness'].includes(String(v.goal)) ||
    !['beginner', 'intermediate', 'advanced'].includes(String(v.experience)) ||
    !['home', 'gym', 'outdoors'].includes(String(v.location))
  )
    throw new FeatureError('Choose your goal, experience and training location.');
  if (![15, 20, 30, 45, 60].includes(Number(v.minutes)))
    throw new FeatureError('Choose a supported session duration.');
  if (
    !Array.isArray(v.days) ||
    v.days.length < 1 ||
    v.days.length > 6 ||
    !v.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  )
    throw new FeatureError('Choose 1–6 training days.');
  if (
    !Array.isArray(v.equipment) ||
    v.equipment.length < 1 ||
    v.equipment.length > 2 ||
    !v.equipment.every((x) => ['bodyweight', 'dumbbells'].includes(x))
  )
    throw new FeatureError('Choose available equipment.');
  if (
    !Array.isArray(v.constraints) ||
    v.constraints.length > 2 ||
    !v.constraints.every((x) => ['no-floor', 'no-overhead'].includes(x))
  )
    throw new FeatureError('Invalid movement preference.');
  if (
    !Array.isArray(v.excludedExercises) ||
    v.excludedExercises.length > 30 ||
    !v.excludedExercises.every((x) => STARTER_MOVEMENTS.some((m) => m.id === x))
  )
    throw new FeatureError('Invalid exercise exclusions.');
  if (typeof v.needsClearance !== 'boolean')
    throw new FeatureError('Confirm your exercise readiness.');
  return {
    schemaVersion: 1,
    goal: v.goal as TrainingPreferences['goal'],
    experience: v.experience as TrainingPreferences['experience'],
    location: v.location as TrainingPreferences['location'],
    days: [...new Set(v.days)].sort() as Weekday[],
    minutes: Number(v.minutes) as TrainingPreferences['minutes'],
    equipment: [...new Set(v.equipment)],
    constraints: [...new Set(v.constraints)],
    excludedExercises: [...new Set(v.excludedExercises)],
    needsClearance: v.needsClearance,
  };
}
export const STARTER_MOVEMENTS = [
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    equipment: 'bodyweight',
    floor: false,
    overhead: false,
  },
  {
    id: 'wall-pushup',
    name: 'Wall Pushup',
    equipment: 'bodyweight',
    floor: false,
    overhead: false,
  },
  {
    id: 'standing-calf-raise',
    name: 'Standing Calf Raise',
    equipment: 'bodyweight',
    floor: false,
    overhead: false,
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    equipment: 'bodyweight',
    floor: true,
    overhead: false,
  },
  {
    id: 'dumbbell-curl',
    name: 'Dumbbell Biceps Curl',
    equipment: 'dumbbells',
    floor: false,
    overhead: false,
  },
  {
    id: 'dumbbell-press',
    name: 'Dumbbell Shoulder Press',
    equipment: 'dumbbells',
    floor: false,
    overhead: true,
  },
] as const;
/** Conservative, deterministic starter routine, not a medical or adaptive program. */
export function generateStarterWeek(raw: TrainingPreferences): {
  schedule: Omit<ScheduledWorkout, 'id' | 'createdAt'>[];
  explanation: string[];
} {
  const p = parseTrainingPreferences(raw);
  if (p.needsClearance)
    return {
      schedule: [],
      explanation: [
        'Automatic training suggestions are paused. Consult a qualified professional before planning exercise.',
      ],
    };
  const movements = STARTER_MOVEMENTS.filter(
    (m) =>
      p.equipment.includes(m.equipment) &&
      !(p.location === 'outdoors' && m.id === 'wall-pushup') &&
      !p.excludedExercises.includes(m.id) &&
      !(p.constraints.includes('no-floor') && m.floor) &&
      !(p.constraints.includes('no-overhead') && m.overhead),
  );
  if (movements.length < 2)
    return {
      schedule: [],
      explanation: [
        'Not enough suitable movements remain. Adjust your preferences or ask a trainer for an individual routine.',
      ],
    };
  const chosen: Weekday[] = [];
  for (const d of p.days)
    if (chosen.length < 3 && !chosen.some((x) => Math.abs(x - d) === 1 || Math.abs(x - d) === 6))
      chosen.push(d);
  const count = Math.min(
    movements.length,
    Math.max(2, Math.floor((Math.min(p.minutes, 30) - 5) / 5)),
  );
  const sets = p.experience === 'beginner' ? 2 : 3;
  const reps = p.goal === 'strength' ? 6 : p.goal === 'muscle' ? 10 : 8;
  return {
    schedule: chosen.map((weekday, index) => ({
      title: `Personal starter ${index + 1}`,
      categoryId: 'cat-strength',
      weekday,
      timeOfDay: '18:00',
      durationMin: Math.min(p.minutes, 30),
      intensity: p.experience === 'beginner' ? 'low' : 'moderate',
      active: true,
      exercises: movements
        .slice(0, count)
        .map((m) => ({ name: m.name, sets: Array.from({ length: sets }, () => ({ reps })) })),
    })),
    explanation: [
      `Based on your ${p.goal} goal, ${p.experience} experience and available ${p.equipment.join(' / ')}.`,
      `${chosen.length} non-consecutive sessions, capped at three per week to allow recovery.`,
      `Starter sessions are capped at 30 minutes including warm-up. Rest 60–90 seconds between sets.`,
      'This limited starter catalog is not a full balanced long-term program. No jumping is included. Check your space and technique; stop if you feel pain.',
    ],
  };
}
