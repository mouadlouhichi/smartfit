import { DEFAULT_CATEGORIES, DEFAULT_WEEK_START, PLANS } from './constants';
import { estimateCalories, toISODate } from './fitness';
import type { FitnessState, Intensity, ScheduledWorkout, WorkoutExercise } from './types';

function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

let counter = 0;
function sid() {
  counter += 1;
  return `seed_${counter}`;
}

function session(opts: {
  daysAgo: number;
  categoryId: string;
  title: string;
  durationMin: number;
  intensity: Intensity;
  distanceKm?: number;
  exercises?: { name: string; sets: { reps?: number; weight?: number }[] }[];
}): FitnessState['sessions'][number] {
  return {
    id: sid(),
    date: daysAgo(opts.daysAgo),
    categoryId: opts.categoryId,
    title: opts.title,
    durationMin: opts.durationMin,
    intensity: opts.intensity,
    calories: estimateCalories(opts.durationMin, opts.intensity),
    distanceKm: opts.distanceKm,
    exercises: (opts.exercises ?? []) as WorkoutExercise[],
    createdAt: Date.now() - opts.daysAgo * 86_400_000,
  };
}

/** Build a realistic 6-week training history so charts and streaks render. */
export function buildSeedState(): FitnessState {
  const sessions: FitnessState['sessions'] = [];

  // A repeating weekly template: [weekdayOffset from Monday, template]
  const templates: {
    dow: number; // 1=Mon..6=Sat
    categoryId: string;
    title: string;
    durationMin: number;
    intensity: Intensity;
    distanceKm?: number;
  }[] = [
    {
      dow: 1,
      categoryId: 'cat-strength',
      title: 'Push — chest & shoulders',
      durationMin: 55,
      intensity: 'high',
    },
    {
      dow: 2,
      categoryId: 'cat-strength',
      title: 'Pull — back & biceps',
      durationMin: 50,
      intensity: 'high',
    },
    {
      dow: 3,
      categoryId: 'cat-cardio',
      title: 'Morning run',
      durationMin: 35,
      intensity: 'moderate',
      distanceKm: 5.2,
    },
    { dow: 4, categoryId: 'cat-hiit', title: 'HIIT circuits', durationMin: 28, intensity: 'high' },
    {
      dow: 5,
      categoryId: 'cat-strength',
      title: 'Legs — squats & hinges',
      durationMin: 60,
      intensity: 'high',
    },
    {
      dow: 6,
      categoryId: 'cat-sports',
      title: 'Football with friends',
      durationMin: 70,
      intensity: 'moderate',
    },
  ];

  // Fill the last 6 weeks (skip today so the streak logic feels live).
  for (let week = 1; week <= 6; week++) {
    for (const t of templates) {
      const dayAgo = week * 7 - t.dow + (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
      // Skip a couple of sessions to look human.
      if (week === 3 && t.dow === 6) continue;
      if (week === 5 && t.dow === 4) continue;
      sessions.push(
        session({
          daysAgo: dayAgo,
          categoryId: t.categoryId,
          title: t.title,
          durationMin: t.durationMin,
          intensity: t.intensity,
          distanceKm: t.distanceKm,
          exercises:
            t.categoryId === 'cat-strength'
              ? [
                  { name: 'Warm-up', sets: [{ reps: 10 }] },
                  {
                    name: 'Main lifts',
                    sets: [
                      { reps: 8, weight: 40 + week },
                      { reps: 8, weight: 40 + week },
                      { reps: 6, weight: 45 + week },
                    ],
                  },
                ]
              : undefined,
        }),
      );
    }
  }

  const schedule: ScheduledWorkout[] = [
    {
      id: sid(),
      title: 'Push day',
      categoryId: 'cat-strength',
      weekday: 1,
      timeOfDay: '07:00',
      durationMin: 55,
      intensity: 'high',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: sid(),
      title: 'Pull day',
      categoryId: 'cat-strength',
      weekday: 2,
      timeOfDay: '07:00',
      durationMin: 50,
      intensity: 'high',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: sid(),
      title: 'Run',
      categoryId: 'cat-cardio',
      weekday: 3,
      timeOfDay: '06:30',
      durationMin: 35,
      intensity: 'moderate',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: sid(),
      title: 'HIIT',
      categoryId: 'cat-hiit',
      weekday: 4,
      timeOfDay: '18:00',
      durationMin: 28,
      intensity: 'high',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: sid(),
      title: 'Legs',
      categoryId: 'cat-strength',
      weekday: 5,
      timeOfDay: '07:00',
      durationMin: 60,
      intensity: 'high',
      active: true,
      createdAt: Date.now(),
    },
    {
      id: sid(),
      title: 'Football',
      categoryId: 'cat-sports',
      weekday: 6,
      timeOfDay: '10:00',
      durationMin: 70,
      intensity: 'moderate',
      active: true,
      createdAt: Date.now(),
    },
  ];

  const goals: FitnessState['goals'] = [
    {
      id: sid(),
      name: 'Train 5 days',
      metric: 'workouts',
      cadence: 'weekly',
      target: 5,
      startDate: daysAgo(30),
      createdAt: Date.now(),
    },
    {
      id: sid(),
      name: '150 active minutes',
      metric: 'minutes',
      cadence: 'weekly',
      target: 150,
      startDate: daysAgo(30),
      createdAt: Date.now(),
    },
    {
      id: sid(),
      name: 'Run 20 km',
      metric: 'distance',
      cadence: 'monthly',
      target: 20,
      startDate: daysAgo(30),
      createdAt: Date.now(),
    },
  ];

  // Weight trending down from 82 -> 78.6 over 6 weeks.
  const bodyLogs: FitnessState['bodyLogs'] = [];
  for (let w = 6; w >= 0; w--) {
    bodyLogs.push({
      id: sid(),
      date: daysAgo(w * 7),
      unit: 'weight',
      value: Math.round((82 - (6 - w) * 0.57) * 10) / 10,
      createdAt: Date.now() - w * 7 * 86_400_000,
    });
  }

  // A short meal history so the fuel screen has something real to show in
  // demo mode: today partially logged, yesterday complete.
  const hour = 3_600_000;
  const meals: FitnessState['meals'] = [
    {
      id: sid(),
      date: daysAgo(0),
      name: 'Oats with banana',
      slot: 'breakfast',
      calories: 380,
      protein: 12,
      carbs: 64,
      fat: 7,
      createdAt: Date.now() - 6 * hour,
    },
    {
      id: sid(),
      date: daysAgo(0),
      name: 'Chicken & rice',
      slot: 'lunch',
      calories: 620,
      protein: 45,
      carbs: 70,
      fat: 14,
      createdAt: Date.now() - 3 * hour,
    },
    {
      id: sid(),
      date: daysAgo(1),
      name: 'Greek yogurt',
      slot: 'snack',
      calories: 150,
      protein: 15,
      carbs: 9,
      fat: 5,
      createdAt: Date.now() - 26 * hour,
    },
    {
      id: sid(),
      date: daysAgo(1),
      name: 'Grilled salmon',
      slot: 'dinner',
      calories: 540,
      protein: 40,
      fat: 28,
      createdAt: Date.now() - 24 * hour,
    },
  ];

  return {
    profile: {
      name: 'Alex',
      weightUnit: 'kg',
      distanceUnit: 'km',
      weeklyRestDays: 1,
      weekStartsOn: DEFAULT_WEEK_START,
      planId: PLANS[0].id,
      onboardingDone: true,
      activityLevel: 'moderate',
    },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    sessions,
    schedule,
    goals,
    bodyLogs,
    meals,
    customGyms: [],
    enrolledPrograms: [],
    enrolledClasses: [],
  };
}
