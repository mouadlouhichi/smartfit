import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityRings,
  computeAchievements,
  consistencyHeatmap,
  currentStreakDays,
  estimatedOneRepMax,
  exerciseVolume,
  heatmapActiveDays,
  isPersonalRecord,
  isTrialing,
  hasProAccess,
  lastPerformance,
  loadSeries,
  muscleVolume,
  personalRecords,
  progressionTarget,
  readiness,
  sessionVolume,
  summariseLiveSession,
  suggestedRestSeconds,
  totalVolume,
  trialDaysLeft,
  emptyState,
  formatVolume,
  formatSet,
  PRO_TRIAL_DAYS,
  FREE_ROUTINE_TEMPLATES,
  parseStateJSON,
  type FitnessState,
  type WorkoutSession,
  type WorkoutSet,
} from '../src/index.ts';

/** Minimal session builder so the fixtures stay readable. */
function session(
  date: string,
  exercises: {
    name: string;
    sets: WorkoutSet[];
  }[],
  over: Partial<WorkoutSession> = {},
): WorkoutSession {
  return {
    id: `ses-${date}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    categoryId: 'cat-strength',
    title: 'Test session',
    durationMin: 45,
    intensity: 'moderate',
    calories: 300,
    exercises,
    createdAt: new Date(`${date}T08:00:00`).getTime(),
    ...over,
  };
}

function withSessions(...sessions: WorkoutSession[]): FitnessState {
  return {
    ...emptyState(),
    // The store keeps sessions newest-first.
    sessions: [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

// ── one-rep max ──────────────────────────────────────────────────────────

test('estimatedOneRepMax uses Epley and degrades safely', () => {
  assert.equal(estimatedOneRepMax(100, 1), 100); // a single is its own 1RM
  assert.equal(estimatedOneRepMax(100, 10), 133.3); // 100 × (1 + 10/30)
  assert.equal(estimatedOneRepMax(60, 5), 70);
  assert.equal(estimatedOneRepMax(0, 10), 0);
  assert.equal(estimatedOneRepMax(100, 0), 0);
  assert.equal(estimatedOneRepMax(100, 40), 0); // past the formula's useful range
  assert.equal(estimatedOneRepMax(NaN, 5), 0);
});

// ── volume ───────────────────────────────────────────────────────────────

test('volume is weight × reps, rolled up per exercise and session', () => {
  const s = session('2026-01-05', [
    {
      name: 'Bench Press',
      sets: [
        { reps: 8, weight: 60 },
        { reps: 8, weight: 60 },
      ],
    },
    { name: 'Plank', sets: [{ duration: 1 }] }, // bodyweight → no tonnage
  ]);
  assert.equal(exerciseVolume(s.exercises[0]), 960);
  assert.equal(exerciseVolume(s.exercises[1]), 0);
  assert.equal(sessionVolume(s), 960);
  assert.equal(totalVolume([s, s]), 1920);
});

test('formatVolume rolls up to tonnes and honours the display unit', () => {
  assert.equal(formatVolume(960, 'kg'), '960 kg');
  assert.equal(formatVolume(12_400, 'kg'), '12.4 t');
  // Imperial never says "tonnes"; 1000 kg ≈ 2205 lb, grouped and readable.
  assert.equal(formatVolume(1000, 'lb'), '2,205 lb');
});

test('formatSet renders the four shapes a set can take', () => {
  assert.equal(formatSet({ reps: 8, weight: 60 }), '8 × 60 kg');
  assert.equal(formatSet({ reps: 12 }), '12 reps');
  assert.equal(formatSet({ duration: 45 }), '45m');
  assert.equal(formatSet({ distance: 5 }), '5 km');
  assert.equal(formatSet({}), '—');
  assert.equal(
    formatSet({ reps: 8, weight: 40, kind: 'warmup', rpe: 6 }),
    '8 × 40 kg · Warm-up · RPE 6',
  );
});

test('warm-up sets are visible but excluded from coaching volume and records', () => {
  const warmup = { reps: 10, weight: 40, kind: 'warmup' as const };
  const working = { reps: 5, weight: 80 };
  const s = session('2026-01-05', [{ name: 'Bench Press', sets: [warmup, working] }]);
  assert.equal(exerciseVolume(s.exercises[0]), 400);
  assert.equal(personalRecords(withSessions(s))[0]?.bestWeight, 80);
  const summary = summariseLiveSession(emptyState(), s.exercises);
  assert.equal(summary.sets, 1);
  assert.equal(summary.volume, 400);
});

// ── progressive overload ─────────────────────────────────────────────────

test('lastPerformance returns the previous session for that lift', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }] }]),
    session('2026-01-02', [
      {
        name: 'Bench Press',
        sets: [
          { reps: 6, weight: 55 },
          { reps: 8, weight: 50 },
        ],
      },
    ]),
    session('2026-01-01', [{ name: 'Squat', sets: [{ reps: 5, weight: 100 }] }]),
  );

  const last = lastPerformance(state, 'Bench Press', new Date('2026-01-06T09:00:00'));
  assert.ok(last, 'found a previous performance');
  assert.equal(last.date, '2026-01-05');
  assert.equal(last.bestWeight, 60);
  assert.equal(last.bestReps, 8);
  assert.equal(last.volume, 480);
  assert.equal(last.sessionsAgo, 0);

  const before = lastPerformance(state, 'Squat', new Date('2026-01-06T09:00:00'));
  assert.ok(before);
  assert.equal(before.bestWeight, 100);
});

test('lastPerformance matches aliases and skips today', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Barbell Bench Press', sets: [{ reps: 5, weight: 80 }] }]),
  );
  // A different spelling of the same catalog entry still resolves.
  const found = lastPerformance(state, 'bench press', new Date('2026-01-06T09:00:00'));
  assert.ok(found, 'alias resolves through the catalog');
  assert.equal(found.bestWeight, 80);

  // A session logged earlier today must not pre-fill itself.
  const today = lastPerformance(state, 'bench press', new Date('2026-01-05T18:00:00'));
  assert.equal(today, null);
});

test('lastPerformance is null for a first-timer', () => {
  assert.equal(lastPerformance(emptyState(), 'Bench Press'), null);
  assert.equal(lastPerformance(emptyState(), '   '), null);
});

// ── personal records ─────────────────────────────────────────────────────

test('personalRecords keeps the best e1RM per lift, best first', () => {
  const state = withSessions(
    session('2026-01-08', [{ name: 'Bench Press', sets: [{ reps: 3, weight: 90 }] }]),
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 10, weight: 60 }] }]),
    session('2026-01-03', [{ name: 'Squat', sets: [{ reps: 5, weight: 120 }] }]),
  );

  const records = personalRecords(state);
  assert.equal(records.length, 2, 'one record per lift');
  // Squat e1RM 140 beats bench e1RM 99 → squat leads the list. Names are the
  // catalog's canonical ones, so "Bench Press" and "Barbell Bench Press" merge.
  assert.match(records[0].name, /Squat/);
  assert.equal(records[0].bestWeight, 120);
  assert.equal(records[0].bestE1rm, 140);

  const bench = records.find((r) => /Bench Press/.test(r.name));
  assert.ok(bench);
  // 3 × 90 → e1RM 99 beats 10 × 60 → e1RM 80.
  assert.equal(bench.bestE1rm, 99);
  assert.equal(bench.totalSets, 2);
});

test('personalRecords ignores bodyweight and timed sets', () => {
  const state = withSessions(
    session('2026-01-05', [
      { name: 'Plank', sets: [{ duration: 2 }, { reps: 20 }] },
      { name: 'Bench Press', sets: [{ reps: 5, weight: 50 }] },
    ]),
  );
  const records = personalRecords(state);
  assert.equal(records.length, 1);
  assert.match(records[0].name, /Bench Press/);
});

test('isPersonalRecord compares against the stored best, not the last set', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 3, weight: 90 }] }]),
  );
  assert.equal(isPersonalRecord(state, 'Bench Press', 100, 1), true); // heavier single
  assert.equal(isPersonalRecord(state, 'Bench Press', 60, 5), false); // e1RM 70 < 99
  assert.equal(isPersonalRecord(state, 'Deadlift', 60, 5), true); // never lifted before
  assert.equal(isPersonalRecord(state, 'Plank', 0, 20), false); // no load, no record
});

// ── muscle volume ────────────────────────────────────────────────────────

test('muscleVolume attributes tonnage through the catalog', () => {
  const state = withSessions(
    session('2026-01-05', [
      { name: 'Bench Press', sets: [{ reps: 10, weight: 60 }] },
      { name: 'Not A Real Exercise At All', sets: [{ reps: 10, weight: 60 }] },
    ]),
  );
  const volumes = muscleVolume(state, 30, new Date('2026-01-20T09:00:00'));
  assert.ok(volumes.length > 0, 'the catalog exercise is attributed');
  assert.ok(
    volumes.every((v) => v.volume > 0 && v.label.length > 0),
    'every row carries a label and tonnage',
  );
  // The unknown name contributes nothing rather than inventing a muscle.
  const total = volumes.reduce((sum, v) => sum + v.volume, 0);
  assert.ok(total > 0);
});

// ── rest prescription ────────────────────────────────────────────────────

test('suggestedRestSeconds scales with intensity', () => {
  assert.equal(suggestedRestSeconds('low'), 60);
  assert.equal(suggestedRestSeconds('moderate'), 90);
  assert.equal(suggestedRestSeconds('high'), 120);
});

// ── streaks & achievements ───────────────────────────────────────────────

test('currentStreakDays counts back from today, tolerating an untrained today', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 50 }] }]),
    session('2026-01-04', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 50 }] }]),
    session('2026-01-03', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 50 }] }]),
    session('2026-01-01', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 50 }] }]),
  );
  assert.equal(currentStreakDays(state, new Date('2026-01-05T20:00:00')), 3);
  // Not trained yet today, but yesterday was → the streak is still alive.
  assert.equal(currentStreakDays(state, new Date('2026-01-06T07:00:00')), 3);
  // Two days of silence breaks it.
  assert.equal(currentStreakDays(state, new Date('2026-01-07T07:00:00')), 0);
  assert.equal(currentStreakDays(emptyState(), new Date('2026-01-07T07:00:00')), 0);
});

test('computeAchievements unlocks from the log and reports honest progress', () => {
  const fresh = computeAchievements(emptyState());
  assert.equal(fresh.length, 9, 'the whole wall is defined');
  assert.equal(fresh.filter((a) => a.unlocked).length, 0, 'nothing is handed out for free');
  assert.ok(fresh.every((a) => a.progress >= 0 && a.progress <= 100));

  const earned = computeAchievements(
    withSessions(
      ...['2026-01-03', '2026-01-04', '2026-01-05'].map((d) =>
        session(d, [{ name: 'Bench Press', sets: [{ reps: 5, weight: 60 }] }]),
      ),
    ),
    new Date('2026-01-05T20:00:00'),
  );
  const byId = Object.fromEntries(earned.map((a) => [a.id, a]));
  assert.equal(byId['first-session'].unlocked, true);
  assert.equal(byId['streak-3'].unlocked, true);
  assert.equal(byId['streak-3'].unlocked || byId['streak-7'].unlocked, true);
  assert.equal(byId['streak-7'].unlocked, false, 'only three days in');
  assert.equal(byId['streak-7'].progressLabel, '3 / 7 days');
  assert.equal(byId['sessions-50'].unlocked, false);
});

test('achievements are derived — re-parsing the same log gives the same wall', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 60 }] }]),
  );
  const now = new Date('2026-01-05T20:00:00');
  assert.deepEqual(computeAchievements(state, now), computeAchievements(state, now));
});

// ── activity rings ───────────────────────────────────────────────────────

test('activityRings only closes rings that have a real target', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 60 }] }], {
      durationMin: 60,
      calories: 500,
    }),
  );

  const rings = activityRings(
    state,
    { minutes: 30, workouts: 3, calories: 0 },
    new Date('2026-01-05T20:00:00'),
  );
  assert.equal(rings.minutes.pct, 100);
  assert.equal(rings.minutes.value, 60);
  assert.equal(rings.calories.target, 0, 'no calorie goal → no calorie ring');
  assert.equal(rings.calories.pct, 0);
  assert.equal(rings.closed, false, 'the weekly ring is still open');

  const noTargets = activityRings(
    state,
    { minutes: 0, workouts: 0, calories: 0 },
    new Date('2026-01-05T20:00:00'),
  );
  assert.equal(noTargets.closed, false, 'an empty target set never fakes a close');
});

// ── consistency heatmap ──────────────────────────────────────────────────

test('consistencyHeatmap builds full weeks aligned to the week start', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 60 }] }], {
      durationMin: 90,
    }),
    session('2026-01-04', [{ name: 'Bench Press', sets: [{ reps: 5, weight: 60 }] }], {
      durationMin: 20,
    }),
  );
  const grid = consistencyHeatmap(state, 4, new Date('2026-01-07T12:00:00'));
  assert.equal(grid.length, 4, 'one column per week');
  assert.ok(
    grid.every((w) => w.cells.length === 7),
    'seven days per column',
  );

  const flat = grid.flatMap((w) => w.cells);
  const busy = flat.find((c) => c.date === '2026-01-05');
  const light = flat.find((c) => c.date === '2026-01-04');
  const future = flat.find((c) => c.date === '2026-01-10');
  assert.ok(busy && light && future);
  assert.equal(busy.minutes, 90);
  assert.equal(busy.level, 4, 'the busiest day tops the ramp');
  assert.ok(light.level > 0 && light.level < 4, 'a lighter day sits lower on the ramp');
  assert.equal(future.level, 0);
  assert.equal(future.future, true);
  assert.equal(heatmapActiveDays(grid), 2);
});

// ── live-session summary ─────────────────────────────────────────────────

test('summariseLiveSession rolls up the runner before the session is saved', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 3, weight: 90 }] }]),
  );
  const summary = summariseLiveSession(state, [
    {
      name: 'Bench Press',
      sets: [
        { reps: 5, weight: 100 },
        { reps: 0, weight: 0 },
      ],
    },
    { name: 'Squat', sets: [{ reps: 8, weight: 80 }] },
    { name: 'Plank', sets: [] },
  ]);
  assert.equal(summary.sets, 3, 'empty sets are still sets');
  assert.equal(summary.exercises, 2, 'only exercises with sets count');
  assert.equal(summary.volume, 500 + 640);
  assert.equal(summary.heaviest, 100);
  assert.equal(summary.mostReps, 8);
  assert.deepEqual(summary.personalRecords, ['Barbell Bench Press', 'Barbell Squat']);
});

// ── pro trial ────────────────────────────────────────────────────────────

test('a trial grants access for PRO_TRIAL_DAYS and then lapses', () => {
  const start = Date.parse('2026-01-01T00:00:00Z');
  const base = emptyState();
  const trialing = {
    ...base,
    profile: { ...base.profile, pro: { plan: 'trial' as const, since: start } },
  };

  assert.equal(isTrialing(trialing, start), true);
  assert.equal(hasProAccess(trialing, start), true);
  assert.equal(trialDaysLeft(trialing, start), PRO_TRIAL_DAYS);

  const almostOver = start + (PRO_TRIAL_DAYS - 1) * 86_400_000;
  assert.equal(isTrialing(trialing, almostOver), true);
  assert.equal(trialDaysLeft(trialing, almostOver), 1);

  const expired = start + PRO_TRIAL_DAYS * 86_400_000;
  assert.equal(isTrialing(trialing, expired), false);
  assert.equal(hasProAccess(trialing, expired), false);
  assert.equal(trialDaysLeft(trialing, expired), 0);

  // A real receipt never expires client-side.
  const paid = {
    ...base,
    profile: { ...base.profile, pro: { plan: 'yearly' as const, since: start } },
  };
  assert.equal(isTrialing(paid, expired), false);
  assert.equal(hasProAccess(paid, expired), true);
});

test('free-tier limits are exported for the gates to read', () => {
  assert.equal(FREE_ROUTINE_TEMPLATES, 3);
});

// ── routine templates round-trip ─────────────────────────────────────────

test('a scheduled slot keeps its exercise list through parsing', () => {
  const parsed = parseStateJSON(
    JSON.stringify({
      schedule: [
        {
          id: 'sch-1',
          title: 'Push day',
          categoryId: 'cat-strength',
          weekday: 1,
          timeOfDay: '07:00',
          durationMin: 60,
          intensity: 'high',
          active: true,
          createdAt: 1,
          exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }] }],
        },
        // A plain reminder stays keyless.
        {
          id: 'sch-2',
          title: 'Easy run',
          categoryId: 'cat-cardio',
          weekday: 3,
          timeOfDay: '18:00',
          durationMin: 30,
          intensity: 'low',
          active: true,
          createdAt: 2,
        },
      ],
    }),
  );
  assert.ok(parsed);
  const [withRoutine, plain] = parsed.schedule;
  assert.equal(withRoutine.exercises?.length, 1);
  assert.equal(withRoutine.exercises?.[0].name, 'Bench Press');
  assert.deepEqual(withRoutine.exercises?.[0].sets[0].reps, 8);
  assert.equal('exercises' in plain, false, 'a reminder carries no routine');
});

test('set metadata is preserved only when valid', () => {
  const parsed = parseStateJSON(
    JSON.stringify({
      sessions: [
        {
          id: 'session-1',
          date: '2026-01-05',
          title: 'Push',
          categoryId: 'cat-strength',
          durationMin: 45,
          intensity: 'moderate',
          calories: 100,
          exercises: [
            {
              name: 'Bench Press',
              sets: [
                { reps: 8, weight: 60, kind: 'drop', rpe: 9 },
                { reps: 10, weight: 40, kind: 'invalid', rpe: 12 },
              ],
            },
          ],
        },
      ],
    }),
  );
  const sets = parsed.sessions[0]?.exercises[0]?.sets ?? [];
  assert.deepEqual(sets[0], {
    reps: 8,
    weight: 60,
    distance: undefined,
    duration: undefined,
    kind: 'drop',
    rpe: 9,
  });
  assert.deepEqual(sets[1], {
    reps: 10,
    weight: 40,
    distance: undefined,
    duration: undefined,
  });
});

// ── starter suggestions ─────────────────────────────────────────────────

test('suggestedExercisesForCategory returns a balanced, curated starter', async () => {
  const { suggestedExercisesForCategory } = await import('../src/exercises.ts');
  const strength = suggestedExercisesForCategory('cat-strength', 6);
  assert.equal(strength.length, 6, 'returns the requested count');
  // Round-robin across muscle groups: not all the same group.
  const groups = new Set(strength.map((s) => s.group));
  assert.ok(groups.size > 1, 'balanced across muscle groups');
  // Every suggestion is a curated (offline-safe) catalog entry.
  assert.ok(
    strength.every((s) => !s.extended),
    'curated entries only',
  );

  const cardio = suggestedExercisesForCategory('cat-cardio', 4);
  assert.ok(
    cardio.every((s) => s.group === 'conditioning'),
    'cardio maps to conditioning',
  );

  // Unknown category falls back to popular lifts rather than nothing.
  const fallback = suggestedExercisesForCategory('cat-unknown', 4);
  assert.ok(fallback.length > 0, 'unknown category still yields suggestions');
});

// ── GPS / route maths ───────────────────────────────────────────────────

test('haversine and route distance are sane for a known walk', async () => {
  const { haversineMeters, routeDistanceKm, paceMinPerKm, formatPace } =
    await import('../src/geo.ts');
  // ~111.19 km per degree of latitude; a 0.01° step ≈ 1.112 km.
  const a = { lat: 0, lng: 0 };
  const b = { lat: 0.01, lng: 0 };
  const m = haversineMeters(a, b);
  assert.ok(m > 1100 && m < 1130, `expected ~1112m, got ${m}`);

  const route = [
    { lat: 0, lng: 0 },
    { lat: 0.01, lng: 0 },
    { lat: 0.01, lng: 0.01 },
  ];
  const km = routeDistanceKm(route);
  assert.ok(km > 2.2 && km < 2.24, `expected ~2.22km, got ${km}`);

  assert.equal(paceMinPerKm(10, 0), 0);
  assert.equal(formatPace(0), '—');
  assert.equal(formatPace(7.5), '7:30 /km');
});

test('simplifyRoute keeps endpoints and bounds the point count', async () => {
  const { simplifyRoute, projectRoute } = await import('../src/geo.ts');
  const many = Array.from({ length: 1200 }, (_, i) => ({ lat: i * 0.0001, lng: i * 0.0001 }));
  const simple = simplifyRoute(many, 500);
  assert.ok(simple.length <= 500, 'bounded');
  assert.deepEqual(simple[0], many[0], 'keeps first fix');
  assert.deepEqual(simple[simple.length - 1], many[many.length - 1], 'keeps last fix');

  // Projection stays inside the box and inverts latitude (north up).
  const { line } = projectRoute(many, 100, 8);
  assert.ok(
    line.every((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100),
    'inside box',
  );
});

test('parseState keeps a valid route and drops junk fixes', () => {
  const parsed = parseStateJSON(
    JSON.stringify({
      sessions: [
        {
          id: 's1',
          date: '2026-01-05',
          title: 'Walk',
          categoryId: 'cat-cardio',
          durationMin: 30,
          intensity: 'low',
          calories: 100,
          createdAt: 1,
          route: [
            { lat: 33.5, lng: -7.6 },
            { lat: 33.51, lng: -7.61 },
            { lat: 999, lng: 0 }, // out of range — dropped
            { lat: 'x', lng: 1 }, // non-finite — dropped
          ],
        },
      ],
    }),
  );
  assert.ok(parsed);
  assert.equal(parsed.sessions[0].route?.length, 2, 'only the two sane fixes survive');
});

// ── smart progression ───────────────────────────────────────────────────

test('progression adds a rep until the top of the range, then load', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 10, weight: 60 }] }]),
  );
  const addRep = progressionTarget(state, 'Bench Press');
  assert.equal(addRep?.kind, 'reps');
  assert.equal(addRep?.reps, 11);
  assert.equal(addRep?.weight, 60);
  assert.match(addRep?.rationale ?? '', /add a rep/);

  const topped = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 12, weight: 60 }] }]),
  );
  const addLoad = progressionTarget(topped, 'Bench Press');
  assert.equal(addLoad?.kind, 'load');
  assert.equal(addLoad?.reps, 8);
  assert.equal(addLoad?.weight, 62.5);
});

test('progression bumps distance work by 5% and returns null for new lifts', () => {
  const state = withSessions(
    session('2026-01-05', [{ name: 'Easy Run', sets: [{ distance: 5 }] }], {
      categoryId: 'cat-cardio',
    }),
  );
  const t = progressionTarget(state, 'Easy Run');
  assert.equal(t?.kind, 'distance');
  assert.equal(t?.distance, 5.25);
  assert.equal(progressionTarget(state, 'Barbell Squat'), null);
});

// ── readiness ───────────────────────────────────────────────────────────

test('readiness calibrates on three sessions and flags load spikes', () => {
  assert.equal(readiness(emptyState()).score, null);
  assert.equal(readiness(emptyState()).label, 'Calibrating');

  // Three steady moderate weeks in the past: a calm baseline.
  const calm = withSessions(
    session('2026-01-05', [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }] }]),
    session('2026-01-12', [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }] }]),
    session('2026-01-19', [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }] }]),
  );
  const baseline = readiness(calm, new Date('2026-02-01T12:00:00'));
  assert.ok(baseline.score !== null && baseline.score >= 72, 'steady history reads Ready');
  assert.equal(baseline.label, 'Ready');

  // …then a monster week right before "today": the ratio spikes.
  const spiked = withSessions(
    ...calm.sessions,
    session(
      '2026-01-31',
      [
        {
          name: 'Bench Press',
          sets: Array.from({ length: 20 }, () => ({ reps: 10, weight: 100 })),
        },
      ],
      { intensity: 'high' },
    ),
  );
  const flag = readiness(spiked, new Date('2026-02-01T12:00:00'));
  assert.ok(flag.ratio > 1.3, `expected a spike, got ${flag.ratio}`);
  assert.ok(flag.score !== null && flag.score < (baseline.score ?? 99));
  assert.ok(flag.factors.length > 0);
});

test('loadSeries returns one point per day, oldest first', () => {
  const state = withSessions(
    session('2026-01-31', [{ name: 'Bench Press', sets: [{ reps: 10, weight: 60 }] }]),
  );
  const series = loadSeries(state, 7, new Date('2026-02-01T12:00:00'));
  assert.equal(series.length, 7);
  assert.equal(series[0]?.date, '2026-01-26');
  assert.equal(series[6]?.date, '2026-02-01');
  assert.equal(series[5]?.volume, 600);
});
