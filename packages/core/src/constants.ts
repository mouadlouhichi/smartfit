import type { Category, Intensity, Plan } from './types';

export const STORAGE_KEY = 'smartfit.state.v1';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-strength', name: 'Strength', icon: 'dumbbell', color: '#16a34a', builtin: true },
  { id: 'cat-cardio', name: 'Cardio', icon: 'heart-pulse', color: '#0ea5e9', builtin: true },
  { id: 'cat-hiit', name: 'HIIT', icon: 'flame', color: '#f59e0b', builtin: true },
  { id: 'cat-mobility', name: 'Mobility', icon: 'stretch-horizontal', color: '#8b5cf6', builtin: true },
  { id: 'cat-sports', name: 'Sports', icon: 'volleyball', color: '#ec4899', builtin: true },
  { id: 'cat-rest', name: 'Active Rest', icon: 'moon', color: '#64748b', builtin: true },
];

export const INTENSITY_META: Record<Intensity, { label: string; multiplier: number; color: string }> = {
  low: { label: 'Low', multiplier: 4, color: '#0ea5e9' },
  moderate: { label: 'Moderate', multiplier: 7, color: '#f59e0b' },
  high: { label: 'High', multiplier: 11, color: '#ef4444' },
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const PLANS: Plan[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: 'A classic 6-day hypertrophy split that rotates push, pull and leg focus.',
    sessionsPerWeek: 6,
    split: [
      { weekday: 1, focus: 'Push (chest, shoulders, triceps)', categoryId: 'cat-strength' },
      { weekday: 2, focus: 'Pull (back, biceps)', categoryId: 'cat-strength' },
      { weekday: 3, focus: 'Legs (quads, glutes, calves)', categoryId: 'cat-strength' },
      { weekday: 4, focus: 'Push + HIIT finisher', categoryId: 'cat-hiit' },
      { weekday: 5, focus: 'Pull + core', categoryId: 'cat-strength' },
      { weekday: 6, focus: 'Legs + cardio', categoryId: 'cat-cardio' },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: 'A balanced 4-day split hitting upper and lower body twice a week.',
    sessionsPerWeek: 4,
    split: [
      { weekday: 1, focus: 'Upper body A', categoryId: 'cat-strength' },
      { weekday: 2, focus: 'Lower body A', categoryId: 'cat-strength' },
      { weekday: 4, focus: 'Upper body B', categoryId: 'cat-strength' },
      { weekday: 5, focus: 'Lower body B + cardio', categoryId: 'cat-cardio' },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body 3×',
    description: 'Three efficient full-body sessions — ideal for beginners and busy schedules.',
    sessionsPerWeek: 3,
    split: [
      { weekday: 1, focus: 'Full body A', categoryId: 'cat-strength' },
      { weekday: 3, focus: 'Full body B', categoryId: 'cat-strength' },
      { weekday: 5, focus: 'Full body C + mobility', categoryId: 'cat-mobility' },
    ],
  },
  {
    id: 'cardio-focus',
    name: 'Cardio & Conditioning',
    description: 'Endurance-first plan blending steady-state cardio, HIIT and mobility.',
    sessionsPerWeek: 5,
    split: [
      { weekday: 1, focus: 'Steady-state run', categoryId: 'cat-cardio' },
      { weekday: 2, focus: 'HIIT intervals', categoryId: 'cat-hiit' },
      { weekday: 3, focus: 'Mobility & recovery', categoryId: 'cat-mobility' },
      { weekday: 5, focus: 'Tempo run / cycle', categoryId: 'cat-cardio' },
      { weekday: 6, focus: 'Long session / sport', categoryId: 'cat-sports' },
    ],
  },
];

export const GOAL_METRIC_META: Record<
  string,
  { label: string; unit: string; icon: string; step: number }
> = {
  workouts: { label: 'Workouts', unit: 'sessions', icon: 'check-circle', step: 1 },
  minutes: { label: 'Active minutes', unit: 'min', icon: 'timer', step: 30 },
  calories: { label: 'Calories burned', unit: 'kcal', icon: 'flame', step: 250 },
  distance: { label: 'Distance', unit: 'km', icon: 'route', step: 5 },
};

export const BODY_UNIT_META: Record<string, { label: string; unit: string; icon: string }> = {
  weight: { label: 'Body weight', unit: 'kg', icon: 'scale' },
  bodyfat: { label: 'Body fat', unit: '%', icon: 'percent' },
  waist: { label: 'Waist', unit: 'cm', icon: 'ruler' },
  chest: { label: 'Chest', unit: 'cm', icon: 'ruler' },
  arms: { label: 'Arms', unit: 'cm', icon: 'ruler' },
  custom: { label: 'Custom measurement', unit: '', icon: 'ruler' },
};
