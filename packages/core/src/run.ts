/**
 * Run analytics — the maths behind the dedicated run experience.
 *
 * Everything here is pure and unit-tested: a GPS trace in, splits, best
 * efforts, elevation and honest moving time out. The rules mirror what the
 * serious trackers do, so the numbers athletes see are comparable:
 *
 *  - a segment slower than `STOP_SPEED_MPS` lasting `MIN_STOP_SEC`+ counts as
 *    stopped (auto-pause) and is excluded from moving time and splits
 *  - a gap longer than `GAP_CUTOFF_SEC` between fixes is a pause, whatever the
 *    apparent speed — no phantom distance is invented across it
 *  - elevation only counts changes of `ELE_THRESHOLD_M`+ between fixes, so GPS
 *    vertical noise cannot inflate a climb
 *  - best efforts are the fastest *contiguous* windows (1 km / 1 mile / 5 km /
 *    10 km) measured on moving time, and only count when the run actually
 *    covered that distance
 */

import { haversineMeters } from './geo';
import type { GeoPoint, RunBestEffort, RunSplit, RunStats, WorkoutSession } from './types';

/** Below this speed a segment reads as standing still (~1.4 km/h). */
export const STOP_SPEED_MPS = 0.4;
/** A slow segment has to last this long before it counts as stopped. */
export const MIN_STOP_SEC = 3;
/** No fix for this long → treat the whole stretch as paused. */
export const GAP_CUTOFF_SEC = 30;
/** Ignore elevation changes smaller than this between fixes (GPS noise). */
export const ELE_THRESHOLD_M = 1;
/**
 * A trailing sliver this close to a full split is snapped up into one: a run
 * that covers 4 999 m must read "5 km", not "4 splits + 0.999 km".
 */
export const SPLIT_SNAP_M = 2;
/** Best efforts accept a trace that lands within this many metres of the
 *  target distance (GPS sampling almost never lands on the exact boundary). */
export const EFFORT_SNAP_M = 5;

export interface RunTarget {
  label: string;
  distanceKm: number;
}

/** Standard best-effort windows, longest last so cards read big → small. */
export const BEST_EFFORT_TARGETS: RunTarget[] = [
  { label: '1 km', distanceKm: 1 },
  { label: '1 mile', distanceKm: 1.609344 },
  { label: '5 km', distanceKm: 5 },
  { label: '10 km', distanceKm: 10 },
];

interface Step {
  /** Metres covered on this segment. */
  meters: number;
  /** Seconds of this segment that count as moving. */
  movingSec: number;
  /** Seconds of this segment that count as stopped. */
  stoppedSec: number;
  elevationGain: number;
  elevationLoss: number;
  /** True when the segment continues the moving timeline (no pause inside). */
  continuous: boolean;
}

/**
 * Walk the trace once and classify every segment: movement (meters, moving vs
 * stopped time) plus the elevation each segment is allowed to claim. The
 * result feeds moving time, splits, elevation and best efforts, so all four
 * always agree.
 */
function classify(points: GeoPoint[]): Step[] {
  const steps: Step[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const meters = haversineMeters(a, b);

    const dtSec = a.t !== undefined && b.t !== undefined && b.t > a.t ? (b.t - a.t) / 1000 : 0;
    // No timing information: everything is movement (the distance is still real).
    if (dtSec === 0) {
      steps.push({ meters, movingSec: 0, stoppedSec: 0, ...zeroElevation(), continuous: true });
      continue;
    }

    if (dtSec > GAP_CUTOFF_SEC) {
      steps.push({
        meters: 0,
        movingSec: 0,
        stoppedSec: dtSec,
        ...zeroElevation(),
        continuous: false,
      });
      continue;
    }

    const speed = meters / dtSec;
    const stopped = speed < STOP_SPEED_MPS && dtSec >= MIN_STOP_SEC;
    steps.push(
      stopped
        ? { meters: 0, movingSec: 0, stoppedSec: dtSec, ...zeroElevation(), continuous: false }
        : { meters, movingSec: dtSec, stoppedSec: 0, ...zeroElevation(), continuous: true },
    );
  }
  applyElevation(points, steps);
  return steps;
}

function zeroElevation() {
  return { elevationGain: 0, elevationLoss: 0 };
}

/**
 * Elevation only counts a change once it has accumulated past
 * `ELE_THRESHOLD_M` since the last committed point — per-fix thresholding
 * would throw away a steady climb sampled a third of a metre at a time, while
 * committing every jitter would double the total. Pauses reset the series, so
 * standing still on a slope cannot invent vertical gain.
 */
function applyElevation(points: GeoPoint[], steps: Step[]) {
  let pending = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const a = points[i];
    const b = points[i + 1];
    if (!step.continuous || a.ele === undefined || b.ele === undefined) {
      pending = 0;
      continue;
    }
    pending += b.ele - a.ele;
    if (Math.abs(pending) < ELE_THRESHOLD_M) continue;
    if (pending > 0) step.elevationGain = pending;
    else step.elevationLoss = -pending;
    pending = 0;
  }
}

/**
 * Per-kilometre splits. Split duration is interpolated across the boundary
 * segment, so a 1.4 km run yields a 1 km split plus a 0.4 km partial one.
 */
function buildSplits(
  steps: Step[],
  splitDistanceKm = 1,
): { splits: RunSplit[]; bestPaceMinPerKm: number } {
  const splits: RunSplit[] = [];
  const totalMeters = steps.reduce((sum, s) => sum + s.meters, 0);
  if (totalMeters <= 0) return { splits, bestPaceMinPerKm: 0 };

  let index = 1;
  let runMeters = 0;
  let runSec = 0;
  let runGain = 0;
  const targetMeters = splitDistanceKm * 1000;

  for (const step of steps) {
    if (step.meters <= 0) continue;
    let remaining = step.meters;
    let remainingSec = step.movingSec;
    let remainingGain = step.elevationGain;

    while (remaining > 0) {
      const need = targetMeters - runMeters;
      if (remaining >= need) {
        const share = need / remaining;
        runMeters += need;
        runSec += remainingSec * share;
        runGain += remainingGain * share;
        remaining -= need;
        remainingSec -= remainingSec * share;
        remainingGain -= remainingGain * share;
        splits.push({
          index,
          distanceKm: splitDistanceKm,
          durationSec: Math.round(runSec),
          paceMinPerKm: runSec / 60 / splitDistanceKm,
          elevationGainM: Math.round(runGain),
          partial: false,
        });
        index += 1;
        runMeters = 0;
        runSec = 0;
        runGain = 0;
      } else {
        runMeters += remaining;
        runSec += remainingSec;
        runGain += remainingGain;
        remaining = 0;
      }
    }
  }

  // Trailing split: snapped up when it is within a couple of metres of a full
  // kilometre (float accumulation must not turn 5.000 km into 4 + 0.999 km),
  // otherwise kept as the partial split the athlete actually ran.
  if (runMeters > SPLIT_SNAP_M) {
    const complete = targetMeters - runMeters <= SPLIT_SNAP_M;
    const km = complete ? splitDistanceKm : runMeters / 1000;
    splits.push({
      index,
      distanceKm: km,
      durationSec: Math.round(runSec),
      paceMinPerKm: runSec / 60 / km,
      elevationGainM: Math.round(runGain),
      partial: !complete,
    });
  }

  const full = splits.filter((s) => !s.partial);
  const bestPaceMinPerKm = full.length > 0 ? Math.min(...full.map((s) => s.paceMinPerKm)) : 0;
  return { splits, bestPaceMinPerKm };
}

/**
 * Fastest contiguous windows for the standard distances, measured on the
 * moving timeline (paused stretches never flatter a best effort).
 */
function buildBestEfforts(points: GeoPoint[], steps: Step[]): RunBestEffort[] {
  // Timeline of (cumulative metres, cumulative moving seconds) built from the
  // same classification the splits use — segments after a pause simply chain
  // onto the previous point, exactly like a watch resume.
  const timeline: { meters: number; sec: number }[] = [{ meters: 0, sec: 0 }];
  let meters = 0;
  let sec = 0;
  for (const step of steps) {
    if (step.meters <= 0 && step.movingSec <= 0) continue;
    meters += step.meters;
    sec += step.movingSec;
    timeline.push({ meters, sec });
  }
  const totalKm = meters / 1000;
  if (totalKm <= 0 || points.length < 2) return [];

  const efforts: RunBestEffort[] = [];
  for (const target of BEST_EFFORT_TARGETS) {
    if (totalKm + EFFORT_SNAP_M / 1000 < target.distanceKm) continue;
    // Sampling rarely lands exactly on the boundary — allow the last few
    // metres, so a 5.00 km run still reports a 5 km effort.
    const targetMeters = Math.max(0, target.distanceKm * 1000 - EFFORT_SNAP_M);
    let best: number | null = null;
    let j = 1;
    for (let i = 0; i < timeline.length - 1; i++) {
      if (j <= i) j = i + 1;
      while (j < timeline.length && timeline[j].meters - timeline[i].meters < targetMeters) j++;
      if (j >= timeline.length) break;
      const windowSec = timeline[j].sec - timeline[i].sec;
      if (best === null || windowSec < best) best = windowSec;
    }
    if (best !== null && best > 0) {
      efforts.push({
        label: target.label,
        distanceKm: target.distanceKm,
        durationSec: Math.round(best),
        paceMinPerKm: best / 60 / target.distanceKm,
      });
    }
  }
  return efforts;
}

/**
 * Derive every run metric from a GPS trace. Returns zeroed stats for empty or
 * single-point traces so callers never have to guard.
 */
export function computeRunStats(points: GeoPoint[]): RunStats {
  const steps = classify(points);
  const distanceKm = steps.reduce((sum, s) => sum + s.meters, 0) / 1000;
  const movingSec = Math.round(steps.reduce((sum, s) => sum + s.movingSec, 0));
  const stoppedSec = Math.round(steps.reduce((sum, s) => sum + s.stoppedSec, 0));
  const elevationGainM = Math.round(steps.reduce((sum, s) => sum + s.elevationGain, 0));
  const elevationLossM = Math.round(steps.reduce((sum, s) => sum + s.elevationLoss, 0));

  const timed = points.filter((p) => p.t !== undefined);
  const startedAt = timed.length > 0 ? timed[0].t : undefined;
  const endedAt = timed.length > 0 ? timed[timed.length - 1].t : undefined;
  const elapsedSec =
    startedAt !== undefined && endedAt !== undefined ? Math.round((endedAt - startedAt) / 1000) : 0;

  const { splits, bestPaceMinPerKm } = buildSplits(steps);
  const bestEfforts = buildBestEfforts(points, steps);

  return {
    distanceKm,
    elapsedSec,
    movingSec,
    stoppedSec,
    avgPaceMinPerKm: distanceKm > 0 ? movingSec / 60 / distanceKm : 0,
    bestPaceMinPerKm,
    elevationGainM,
    elevationLossM,
    splits,
    bestEfforts,
    startedAt,
    endedAt,
  };
}

/** A session recorded by the run tracker (has splits, not just a distance). */
export function isTrackedRun(
  session: Pick<WorkoutSession, 'splits' | 'route' | 'distanceKm'>,
): boolean {
  return (session.splits?.length ?? 0) > 0 || (session.route?.length ?? 0) >= 2;
}

export interface RunAchievement {
  label: string;
  detail: string;
  /** The run just finished set it (vs. the history it was compared against). */
  isRecord: boolean;
}

/**
 * Compare a fresh run against the athlete's history and return the records it
 * set — Strava's gold badges, computed from their own data only.
 */
export function runAchievements(
  run: { distanceKm: number; stats?: RunStats | null; elevationGainM?: number },
  history: WorkoutSession[],
): RunAchievement[] {
  const previous = history.filter(isTrackedRun);
  const out: RunAchievement[] = [];

  const longest = previous.reduce((max, s) => Math.max(max, s.distanceKm ?? 0), 0);
  if (run.distanceKm > 0) {
    out.push({
      label: 'Longest run',
      detail: `${fmtKm(run.distanceKm)}${longest > 0 ? ` vs ${fmtKm(longest)} before` : ''}`,
      isRecord: run.distanceKm > longest && previous.length > 0,
    });
  }

  const climb = run.stats?.elevationGainM ?? run.elevationGainM ?? 0;
  if (climb > 0) {
    const best = previous.reduce((max, s) => Math.max(max, s.elevationGainM ?? 0), 0);
    out.push({
      label: 'Biggest climb',
      detail: `${Math.round(climb)} m${best > 0 ? ` vs ${Math.round(best)} m before` : ''}`,
      isRecord: climb > best && previous.length > 0,
    });
  }

  const pace = run.stats?.avgPaceMinPerKm ?? 0;
  if (pace > 0 && run.distanceKm >= 1) {
    const bestPace = previous.reduce((best, s) => {
      const km = s.distanceKm ?? 0;
      if (km < 1 || s.movingTimeMin === undefined || s.movingTimeMin <= 0) return best;
      return Math.min(best, s.movingTimeMin / km);
    }, Infinity);
    out.push({
      label: 'Fastest average pace',
      detail: `${fmtPace(pace)}${Number.isFinite(bestPace) ? ` vs ${fmtPace(bestPace)} before` : ''}`,
      isRecord: pace < bestPace && previous.length > 0,
    });
  }

  // Fastest 1 km / 5 km inside this run vs. the best window in history.
  for (const target of [
    { label: 'Fastest 1 km', distanceKm: 1 },
    { label: 'Fastest 5 km', distanceKm: 5 },
  ]) {
    const effort = run.stats?.bestEfforts.find((e) => e.distanceKm === target.distanceKm);
    if (!effort) continue;
    const best = previous.reduce((min, s) => {
      const split = s.splits?.filter((x) => !x.partial);
      if (!split || split.length === 0) return min;
      const window = fastestWindow(split, target.distanceKm);
      return window > 0 ? Math.min(min, window) : min;
    }, Infinity);
    out.push({
      label: target.label,
      detail: `${fmtDuration(effort.durationSec)}${Number.isFinite(best) ? ` vs ${fmtDuration(Math.round(best))} before` : ''}`,
      isRecord: effort.durationSec < best && previous.length > 0,
    });
  }

  return out;
}

/** Fastest averaged window over stored splits (moving-time minutes). */
function fastestWindow(splits: RunSplit[], distanceKm: number): number {
  if (distanceKm <= 1) {
    const best = splits.reduce((min, s) => Math.min(min, s.paceMinPerKm), Infinity);
    return Number.isFinite(best) ? best * distanceKm * 60 : 0;
  }
  let best = Infinity;
  for (let i = 0; i + distanceKm <= splits.length; i++) {
    let sec = 0;
    for (let k = i; k < i + distanceKm; k++) sec += splits[k].durationSec;
    best = Math.min(best, sec);
  }
  return Number.isFinite(best) ? best : 0;
}

/** Totals for one period of tracked runs (run tab header, share cards). */
export function runTotals(runs: WorkoutSession[]): {
  runs: number;
  distanceKm: number;
  movingMin: number;
  elevationGainM: number;
} {
  return runs.reduce(
    (acc, s) => ({
      runs: acc.runs + 1,
      distanceKm: acc.distanceKm + (s.distanceKm ?? 0),
      movingMin: acc.movingMin + (s.movingTimeMin ?? s.durationMin ?? 0),
      elevationGainM: acc.elevationGainM + (s.elevationGainM ?? 0),
    }),
    { runs: 0, distanceKm: 0, movingMin: 0, elevationGainM: 0 },
  );
}

/** "5.02 km" / "820 m" — run-scale distance that stays readable. */
export function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Math.round(km * 100) / 100} km`;
}

/** "27:31" / "1:02:15" — stopwatch formatting for durations. */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** "5:29 /km" — pace without the unit suffix (callers add their own). */
export function fmtPace(minPerKm: number): string {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '—';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
