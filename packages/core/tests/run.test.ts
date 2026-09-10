import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEST_EFFORT_TARGETS,
  computeRunStats,
  fmtDuration,
  fmtKm,
  fmtPace,
  isTrackedRun,
  runAchievements,
  runTotals,
} from '../src/run.ts';
import type { GeoPoint, WorkoutSession } from '../src/types.ts';

/**
 * The run tracker's maths: moving time with auto-pause, per-kilometre splits,
 * best efforts on the moving timeline and elevation with noise rejection.
 * These numbers are what athletes share, so they are pinned down here.
 */

/** Degrees of latitude per metre on the same sphere `haversineMeters` uses. */
const DEG_PER_METER = 360 / (2 * Math.PI * 6_371_000);

/** Build a straight north-bound trace: `km` at `paceMinPerKm`, fixes every
 *  `everySec` seconds. Latitude only, so distances are easy to reason about. */
function straightRun(
  km: number,
  paceMinPerKm: number,
  opts: { everySec?: number; startT?: number; elePerKm?: number; lat0?: number } = {},
): GeoPoint[] {
  const everySec = opts.everySec ?? 5;
  const startT = opts.startT ?? Date.UTC(2026, 8, 10, 6, 0, 0);
  const lat0 = opts.lat0 ?? 45;
  const stepMeters = (1000 / (paceMinPerKm * 60)) * everySec;
  // Integer stepping so the trace spans exactly the requested distance.
  const steps = Math.round((km * 1000) / stepMeters);
  const points: GeoPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const meters = i * stepMeters;
    points.push({
      lat: lat0 + meters * DEG_PER_METER,
      lng: 9,
      t: startT + i * everySec * 1000,
      ...(opts.elePerKm !== undefined ? { ele: 100 + (meters / 1000) * opts.elePerKm } : {}),
    });
  }
  return points;
}

test('a clean 5 km at 5:00 /km yields splits, moving time and pace', () => {
  const stats = computeRunStats(straightRun(5, 5));
  assert.ok(Math.abs(stats.distanceKm - 5) < 0.03, `distance ${stats.distanceKm}`);
  assert.ok(Math.abs(stats.movingSec - 1500) < 15, `moving ${stats.movingSec}`);
  assert.ok(Math.abs(stats.avgPaceMinPerKm - 5) < 0.1, `pace ${stats.avgPaceMinPerKm}`);
  assert.equal(stats.stoppedSec, 0);
  assert.equal(stats.splits.filter((s) => !s.partial).length, 5);
  for (const split of stats.splits) {
    assert.ok(Math.abs(split.paceMinPerKm - 5) < 0.15, `split pace ${split.paceMinPerKm}`);
  }
});

test('a partial final kilometre is kept and flagged', () => {
  const stats = computeRunStats(straightRun(2.4, 5));
  assert.equal(stats.splits.length, 3);
  assert.equal(stats.splits[2].partial, true);
  assert.ok(stats.splits[2].distanceKm > 0.3 && stats.splits[2].distanceKm < 0.5);
  // Partial splits never set the "best pace of the session".
  const full = stats.splits.filter((s) => !s.partial);
  assert.ok(Math.abs(stats.bestPaceMinPerKm - Math.min(...full.map((s) => s.paceMinPerKm))) < 1e-9);
});

test('standing still is auto-paused and excluded from moving time', () => {
  const moving = straightRun(1, 5); // 60 fixes, 1 km
  const pauseStart = moving[30];
  const pauseEnd: GeoPoint = { lat: moving[30].lat, lng: 9, t: pauseStart.t! + 120_000 }; // 2 min stop
  const resumed = moving.slice(31).map((p) => ({ ...p, t: p.t! + 120_000 }));
  const stats = computeRunStats([...moving.slice(0, 31), pauseEnd, ...resumed]);

  assert.ok(stats.stoppedSec >= 120, `stopped ${stats.stoppedSec}`);
  assert.ok(Math.abs(stats.movingSec - 300) < 20, `moving ${stats.movingSec}`);
  assert.ok(Math.abs(stats.avgPaceMinPerKm - 5) < 0.25, `pace ${stats.avgPaceMinPerKm}`);
  // The standing stretch adds no distance.
  assert.ok(Math.abs(stats.distanceKm - 1) < 0.03, `distance ${stats.distanceKm}`);
});

test('a long gap between fixes never invents phantom distance', () => {
  const points: GeoPoint[] = [
    { lat: 45, lng: 9, t: 0 },
    { lat: 45.009, lng: 9, t: 120_000 }, // ~1 km away, but 2 minutes later
  ];
  const stats = computeRunStats(points);
  assert.equal(stats.distanceKm, 0);
  assert.equal(stats.movingSec, 0);
  assert.ok(stats.stoppedSec >= 120);
});

test('elevation ignores GPS vertical noise but keeps real climbs', () => {
  const noisy: GeoPoint[] = [
    { lat: 45, lng: 9, t: 0, ele: 100 },
    { lat: 45.0001, lng: 9, t: 10_000, ele: 100.4 }, // noise
    { lat: 45.0002, lng: 9, t: 20_000, ele: 99.7 }, // noise
    { lat: 45.0003, lng: 9, t: 30_000, ele: 112 }, // real climb
  ];
  const stats = computeRunStats(noisy);
  assert.equal(stats.elevationGainM, 12);
  assert.equal(stats.elevationLossM, 0);
});

test('a steady climb sampled in small steps is not filtered away', () => {
  // 5 km, +20 m per km, sampled every ~17 m → each fix only gains 0.33 m,
  // which per-fix thresholding would reject as noise. The climb is real.
  const stats = computeRunStats(straightRun(5, 5, { elePerKm: 20 }));
  assert.ok(
    stats.elevationGainM > 90 && stats.elevationGainM < 110,
    `expected ~100 m of climb, got ${stats.elevationGainM}`,
  );
  assert.equal(stats.elevationLossM, 0);
});

test('a full-distance trace reports full splits, not a rounded-down partial', () => {
  // 5.00 km must read as five splits — float accumulation must never turn the
  // last one into a 0.99 km partial.
  const stats = computeRunStats(straightRun(5, 5));
  const full = stats.splits.filter((s) => !s.partial);
  assert.equal(full.length, 5);
  assert.equal(stats.splits.length, 5);
  assert.ok(Math.abs(stats.distanceKm - 5) < 0.01, `distance ${stats.distanceKm}`);
});

test('best efforts find the fastest window inside a run', () => {
  // 3 km at 6:00, then 2 km at 4:00 → the 1 km best must be ~4:00 and the
  // 5 km best ~ (3*6 + 2*4)/5 = 5:12.
  const slow = straightRun(3, 6);
  const fastStart = slow[slow.length - 1];
  // The fast stretch continues north from where the slow one ended.
  const fast = straightRun(2, 4, { startT: fastStart.t! + 5000, lat0: fastStart.lat });
  const stats = computeRunStats([...slow, ...fast.slice(1)]);

  const oneK = stats.bestEfforts.find((e) => e.label === '1 km');
  assert.ok(oneK, 'expected a 1 km effort');
  assert.ok(oneK!.paceMinPerKm > 3.9 && oneK!.paceMinPerKm < 4.2, `1k pace ${oneK!.paceMinPerKm}`);
  assert.ok(oneK!.durationSec > 230 && oneK!.durationSec < 250, `1k sec ${oneK!.durationSec}`);

  const fiveK = stats.bestEfforts.find((e) => e.label === '5 km');
  assert.ok(fiveK, 'expected a 5 km effort');
  assert.ok(fiveK!.paceMinPerKm > 5 && fiveK!.paceMinPerKm < 5.4, `5k pace ${fiveK!.paceMinPerKm}`);
});

test('best efforts are only reported for distances actually covered', () => {
  const stats = computeRunStats(straightRun(3, 5));
  const labels = stats.bestEfforts.map((e) => e.label);
  assert.ok(labels.includes('1 km'));
  assert.ok(labels.includes('1 mile'));
  assert.ok(!labels.includes('5 km'));
  assert.ok(!labels.includes('10 km'));
  assert.equal(BEST_EFFORT_TARGETS.length, 4);
});

test('empty and single-point traces return zeroed stats', () => {
  for (const points of [[], [{ lat: 45, lng: 9, t: 0 }]] as GeoPoint[][]) {
    const stats = computeRunStats(points);
    assert.equal(stats.distanceKm, 0);
    assert.equal(stats.splits.length, 0);
    assert.equal(stats.avgPaceMinPerKm, 0);
    assert.equal(stats.bestEfforts.length, 0);
  }
});

test('tracked runs are identified by splits or a real route', () => {
  assert.equal(isTrackedRun({ splits: [], route: undefined, distanceKm: 5 }), false);
  assert.equal(isTrackedRun({ route: undefined, distanceKm: 5, splits: [] }), false);
  assert.equal(isTrackedRun({ splits: undefined, distanceKm: 5, route: straightRun(1, 5) }), true);
});

test('achievements compare a run against history honestly', () => {
  const history = [
    session({ distanceKm: 4, movingTimeMin: 24, elevationGainM: 30 }),
    session({ distanceKm: 6, movingTimeMin: 33, elevationGainM: 80, splits: splitsAt(6, 5.5) }),
  ];
  const stats = computeRunStats(straightRun(8, 5, { elePerKm: 20 }));
  const achievements = runAchievements(
    { distanceKm: stats.distanceKm, stats, elevationGainM: stats.elevationGainM },
    history,
  );

  const longest = achievements.find((a) => a.label === 'Longest run');
  assert.equal(longest?.isRecord, true);
  const climb = achievements.find((a) => a.label === 'Biggest climb');
  assert.equal(climb?.isRecord, true); // ~160 m > 80 m
  const pace = achievements.find((a) => a.label === 'Fastest average pace');
  assert.equal(pace?.isRecord, true); // 5:00 vs 5:30
  const oneK = achievements.find((a) => a.label === 'Fastest 1 km');
  assert.ok(oneK && oneK.isRecord);
});

test('a first run sets the baseline without shouting "record"', () => {
  const stats = computeRunStats(straightRun(3, 5));
  const achievements = runAchievements({ distanceKm: 3, stats }, []);
  assert.ok(achievements.length > 0);
  assert.ok(achievements.every((a) => a.isRecord === false));
});

test('runTotals adds up a period of runs', () => {
  const totals = runTotals([
    session({ distanceKm: 5, movingTimeMin: 25, elevationGainM: 40 }),
    session({ distanceKm: 10, movingTimeMin: 50, elevationGainM: 120 }),
    session({ distanceKm: 0, movingTimeMin: 0 }), // a gym session is not a run
  ]);
  assert.equal(totals.runs, 3);
  assert.equal(totals.distanceKm, 15);
  assert.equal(totals.movingMin, 75);
  assert.equal(totals.elevationGainM, 160);
});

test('formatters stay compact and unambiguous', () => {
  assert.equal(fmtKm(0.82), '820 m');
  assert.equal(fmtKm(5.0212), '5.02 km');
  assert.equal(fmtDuration(65), '1:05');
  assert.equal(fmtDuration(3725), '1:02:05');
  assert.equal(fmtPace(5.5), '5:30');
  assert.equal(fmtPace(4.999), '5:00');
  assert.equal(fmtPace(0), '—');
});

function splitsAt(km: number, pace: number) {
  return Array.from({ length: Math.floor(km) }, (_, i) => ({
    index: i + 1,
    distanceKm: 1,
    durationSec: Math.round(pace * 60),
    paceMinPerKm: pace,
    elevationGainM: 0,
    partial: false,
  }));
}

function session(over: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: `s-${Math.random()}`,
    date: '2026-09-01',
    categoryId: 'cat-cardio',
    title: 'Run',
    durationMin: 30,
    intensity: 'moderate',
    calories: 300,
    exercises: [],
    createdAt: 0,
    ...over,
  };
}
