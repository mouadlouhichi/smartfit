/**
 * Custom Gym Management - redesigned gym feature
 *
 * Allows users to:
 * - Add/delete their own gyms
 * - Create custom programs within a gym
 * - Enroll in courses/classes
 * - AI determines exercise properties for each course
 */

import type { Intensity, WorkoutExercise } from './types';
import type { ClassFocus, GymClass, GymProgram } from './program';
import { allExercises, exerciseMeasure, matchExercise } from './exercises';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomGymProgram {
  id: string;
  gymId: string;
  name: string;
  description?: string;
  focus: ClassFocus;
  intensity: Intensity;
  durationMin: number;
  /** Courses/classes within this program */
  classes: CustomGymClass[];
  /** Whether user participates in this program */
  enrolled: boolean;
  createdAt: number;
}

export interface CustomGymClass {
  id: string;
  programId: string;
  name: string;
  focus: ClassFocus;
  intensity: Intensity;
  minutes: number;
  /** AI-determined exercises for this class */
  exercises: WorkoutExercise[];
  /** Schedule */
  weekday?: number;
  time?: string;
  /** Whether user enrolled in this specific class */
  enrolled: boolean;
  /** Instructor name */
  instructor?: string;
  createdAt: number;
}

export interface CustomGym {
  id: string;
  name: string;
  location?: string;
  hours?: string;
  description?: string;
  /** Built-in vs custom */
  custom: boolean;
  /** Programs in this gym */
  programs: CustomGymProgram[];
  createdAt: number;
  /** For built-in gyms, reference to original program */
  builtInProgramId?: string;
}

// ── Built-in gyms converted to new format ────────────────────────────────────

import { ZONE_FIGHT } from './program';

export function builtInGymToCustom(gym: GymProgram): CustomGym {
  return {
    id: gym.id,
    name: gym.name,
    hours: gym.hours,
    description: `Built-in gym with ${Object.keys(gym.classes).length} classes`,
    custom: false,
    builtInProgramId: gym.id,
    createdAt: Date.now(),
    programs: [
      {
        id: `${gym.id}-main`,
        gymId: gym.id,
        name: `${gym.name} Main Program`,
        description: 'Complete program from gym timetable',
        focus: 'cardio' as ClassFocus,
        intensity: 'moderate' as Intensity,
        durationMin: 45,
        enrolled: false,
        createdAt: Date.now(),
        classes: Object.values(gym.classes).map((c) => ({
          id: c.id,
          programId: `${gym.id}-main`,
          name: c.name,
          focus: c.focus,
          intensity: c.intensity,
          minutes: c.minutes,
          exercises: aiDetermineExercises(c.name, c.focus, c.intensity),
          enrolled: false,
          createdAt: Date.now(),
        })),
      },
    ],
  };
}

export const BUILT_IN_GYMS: CustomGym[] = [builtInGymToCustom(ZONE_FIGHT)];

// ── AI Exercise Determination ────────────────────────────────────────────────

/**
 * AI-powered exercise property determination
 * Analyzes class name, focus, and intensity to suggest relevant exercises
 * Uses the exercise catalog + heuristic matching
 */
export function aiDetermineExercises(
  className: string,
  focus: ClassFocus,
  intensity: Intensity,
): WorkoutExercise[] {
  const nameLower = className.toLowerCase();
  const catalog = allExercises().filter((e) => exerciseMeasure(e) !== 'distance');

  // Focus-based muscle mapping
  const focusMuscles: Record<ClassFocus, string[]> = {
    cardio: ['quadriceps', 'hamstrings', 'calves'],
    hiit: ['quadriceps', 'chest', 'abdominals'],
    strength: ['chest', 'lats', 'quadriceps', 'shoulders'],
    combat: ['shoulders', 'abdominals', 'quadriceps'],
    mind: ['abdominals', 'lower back'],
    aqua: ['quadriceps', 'shoulders', 'chest'],
  };

  const targetMuscles = focusMuscles[focus] || ['chest', 'quadriceps'];

  // Keyword matching for specific class types
  const keywordMap: Record<string, { muscles: string[]; count: number }> = {
    spinning: { muscles: ['quadriceps', 'hamstrings', 'glutes'], count: 3 },
    'fat burner': { muscles: ['abdominals', 'quadriceps'], count: 4 },
    tbc: { muscles: ['chest', 'quadriceps', 'abdominals'], count: 5 },
    'xtrem abdos': { muscles: ['abdominals', 'lower back'], count: 4 },
    hiit: { muscles: ['quadriceps', 'chest', 'shoulders'], count: 5 },
    'aqua gym': { muscles: ['quadriceps', 'shoulders'], count: 3 },
    caf: { muscles: ['glutes', 'abdominals', 'hamstrings'], count: 4 },
    'power circuit': { muscles: ['chest', 'quadriceps', 'shoulders', 'abdominals'], count: 6 },
    'body sculpt': { muscles: ['chest', 'glutes', 'shoulders', 'abdominals'], count: 5 },
    combat: { muscles: ['shoulders', 'abdominals', 'quadriceps'], count: 4 },
    boxe: { muscles: ['shoulders', 'chest', 'abdominals'], count: 4 },
    mma: { muscles: ['shoulders', 'quadriceps', 'abdominals', 'chest'], count: 5 },
    'power pump': { muscles: ['chest', 'quadriceps', 'shoulders'], count: 5 },
    tabata: { muscles: ['quadriceps', 'abdominals', 'chest'], count: 4 },
    cardio: { muscles: ['quadriceps', 'hamstrings'], count: 3 },
    pilates: { muscles: ['abdominals', 'lower back', 'glutes'], count: 4 },
    'self defense': { muscles: ['shoulders', 'abdominals', 'quadriceps'], count: 4 },
    stretching: { muscles: ['hamstrings', 'quadriceps', 'lower back'], count: 3 },
    cross: { muscles: ['quadriceps', 'chest', 'shoulders', 'abdominals'], count: 6 },
  };

  // Find matching keyword
  let matched = null;
  for (const [kw, config] of Object.entries(keywordMap)) {
    if (nameLower.includes(kw)) {
      matched = config;
      break;
    }
  }

  const musclesToUse = matched?.muscles || targetMuscles;
  const exerciseCount =
    matched?.count || (intensity === 'high' ? 5 : intensity === 'moderate' ? 4 : 3);

  const exercises: WorkoutExercise[] = [];
  const usedNames = new Set<string>();

  for (const muscle of musclesToUse) {
    if (exercises.length >= exerciseCount) break;

    const candidates = catalog
      .filter((e) => e.muscles[0] === muscle && !usedNames.has(e.name))
      .sort((a, b) => Number(b.popular ?? false) - Number(a.popular ?? false));

    const pick = candidates[0] || catalog.find((e) => !usedNames.has(e.name));
    if (pick) {
      usedNames.add(pick.name);
      exercises.push({
        name: pick.name,
        sets: Array.from({ length: intensity === 'high' ? 4 : 3 }, () => ({})),
      });
    }
  }

  // Fill remaining if needed
  while (exercises.length < exerciseCount) {
    const remaining = catalog.filter((e) => !usedNames.has(e.name));
    if (remaining.length === 0) break;
    const pick = remaining.sort(
      (a, b) => Number(b.popular ?? false) - Number(a.popular ?? false),
    )[0];
    usedNames.add(pick.name);
    exercises.push({
      name: pick.name,
      sets: Array.from({ length: 3 }, () => ({})),
    });
  }

  return exercises;
}

/**
 * Enhanced AI that also determines equipment, muscle groups, and properties
 */
export function aiAnalyzeClass(className: string, focus: ClassFocus, intensity: Intensity) {
  const exercises = aiDetermineExercises(className, focus, intensity);

  const muscles = new Set<string>();
  const equipment = new Set<string>();

  for (const ex of exercises) {
    const entry = matchExercise(ex.name) || allExercises().find((e) => e.name === ex.name);
    if (entry) {
      entry.muscles.forEach((m) => muscles.add(m));
      equipment.add(entry.equipment);
    }
  }

  return {
    exercises,
    muscles: Array.from(muscles),
    equipment: Array.from(equipment),
    estimatedCalories: intensity === 'high' ? 450 : intensity === 'moderate' ? 350 : 250,
    recommendedSets: intensity === 'high' ? 4 : 3,
  };
}

// ── Gym CRUD ─────────────────────────────────────────────────────────────────

export function createCustomGym(params: {
  name: string;
  location?: string;
  hours?: string;
  description?: string;
}): CustomGym {
  return {
    id: `gym-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: params.name.trim(),
    location: params.location?.trim() || undefined,
    hours: params.hours?.trim() || undefined,
    description: params.description?.trim() || undefined,
    custom: true,
    programs: [],
    createdAt: Date.now(),
  };
}

export function createGymProgram(params: {
  gymId: string;
  name: string;
  description?: string;
  focus: ClassFocus;
  intensity: Intensity;
  durationMin: number;
}): CustomGymProgram {
  return {
    id: `prog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    gymId: params.gymId,
    name: params.name.trim(),
    description: params.description?.trim() || undefined,
    focus: params.focus,
    intensity: params.intensity,
    durationMin: params.durationMin,
    classes: [],
    enrolled: false,
    createdAt: Date.now(),
  };
}

export function createGymClass(params: {
  programId: string;
  name: string;
  focus: ClassFocus;
  intensity: Intensity;
  minutes: number;
  weekday?: number;
  time?: string;
  instructor?: string;
}): CustomGymClass {
  const exercises = aiDetermineExercises(params.name, params.focus, params.intensity);

  return {
    id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    programId: params.programId,
    name: params.name.trim(),
    focus: params.focus,
    intensity: params.intensity,
    minutes: params.minutes,
    weekday: params.weekday,
    time: params.time,
    instructor: params.instructor?.trim() || undefined,
    exercises,
    enrolled: false,
    createdAt: Date.now(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getAllGyms(customGyms: CustomGym[] = []): CustomGym[] {
  // Merge built-in + custom, dedup by id
  const byId = new Map<string, CustomGym>();
  for (const g of BUILT_IN_GYMS) byId.set(g.id, g);
  for (const g of customGyms) byId.set(g.id, g);
  return Array.from(byId.values()).sort((a, b) => {
    if (a.custom !== b.custom) return a.custom ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function findGym(gyms: CustomGym[], id: string): CustomGym | null {
  return gyms.find((g) => g.id === id) ?? null;
}

export function findProgram(gyms: CustomGym[], programId: string): CustomGymProgram | null {
  for (const gym of gyms) {
    const prog = gym.programs.find((p) => p.id === programId);
    if (prog) return prog;
  }
  return null;
}

export function findClass(gyms: CustomGym[], classId: string): CustomGymClass | null {
  for (const gym of gyms) {
    for (const prog of gym.programs) {
      const cls = prog.classes.find((c) => c.id === classId);
      if (cls) return cls;
    }
  }
  return null;
}
