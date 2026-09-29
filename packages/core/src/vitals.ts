/**
 * Vitals, Sleep, Recovery & Strain algorithms.
 *
 * Implements Sonar-style biometric modelling using data the user may enter
 * manually (for now) or sync from HealthKit/Google Health Connect/wearables.
 *
 *  - Rolling personal baselines (14-day / 30-day)
 *  - Out-of-range anomaly detection
 *  - Daily Readiness / Recovery score (0–100) combining HRV, RHR, sleep, strain
 *  - Daily Strain score (0–21) from HR-zone minutes
 *  - Acute-to-Chronic Workload Ratio (ACWR)
 *  - Sleep debt and circadian consistency
 */
import type { DailyReadiness, DailyStrain, FitnessState, SleepLog, VitalsLog } from './types';
import { toISODate, fromISODate, sessionsInRange, startOfDay } from './fitness';
import { sessionVolume } from './training';
import { round } from './utils';

/* ── Retrieval helpers ────────────────────────────────────────────────── */

export function sleepOn(state: FitnessState, iso: string): SleepLog | null {
  const all = state.sleepLogs ?? [];
  return all.filter((s) => s.date === iso).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export function vitalsOn(state: FitnessState, iso: string): VitalsLog | null {
  const all = state.vitalsLogs ?? [];
  return all.filter((v) => v.date === iso).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Sleep logs in the trailing `days` window, inclusive of `endIso`. */
export function sleepWindow(state: FitnessState, days: number, endIso: string): SleepLog[] {
  const end = fromISODate(endIso);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const startIso = toISODate(start);
  return (state.sleepLogs ?? []).filter((s) => s.date >= startIso && s.date <= endIso);
}

/** Vitals logs in the trailing `days` window, inclusive of `endIso`. */
export function vitalsWindow(state: FitnessState, days: number, endIso: string): VitalsLog[] {
  const end = fromISODate(endIso);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const startIso = toISODate(start);
  return (state.vitalsLogs ?? []).filter((v) => v.date >= startIso && v.date <= endIso);
}

/* ── Baselines ────────────────────────────────────────────────────────── */

export interface Baseline {
  mean: number;
  /** Sample standard deviation (0 if fewer than 2 samples). */
  sd: number;
  /** Number of samples used. */
  n: number;
}

function baseline(values: number[]): Baseline {
  const xs = values.filter((x) => Number.isFinite(x));
  if (xs.length === 0) return { mean: 0, sd: 0, n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd =
    xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1)) : 0;
  return { mean: round(mean, 2), sd: round(sd, 2), n: xs.length };
}

/** Rolling 14-day baselines for the canonical vital metrics. */
export function personalBaselines(
  state: FitnessState,
  iso: string,
  windowDays = 14,
): {
  hrv: Baseline;
  rhr: Baseline;
  respiratoryRate: Baseline;
  spo2: Baseline;
  sleepDuration: Baseline;
} {
  const win = vitalsWindow(state, windowDays, iso);
  const swin = sleepWindow(state, windowDays, iso);
  return {
    hrv: baseline(win.map((v) => v.hrvRmssd).filter((x): x is number => !!x)),
    rhr: baseline(win.map((v) => v.restingHR).filter((x): x is number => !!x)),
    respiratoryRate: baseline(win.map((v) => v.respiratoryRate).filter((x): x is number => !!x)),
    spo2: baseline(win.map((v) => v.spo2).filter((x): x is number => !!x)),
    sleepDuration: baseline(swin.map((s) => s.durationMin)),
  };
}

/* ── Anomaly detection ────────────────────────────────────────────────── */

export type AnomalyKind =
  'hrv-low' | 'rhr-high' | 'resp-high' | 'spo2-low' | 'temp-elevated' | 'sleep-low';

export interface Anomaly {
  kind: AnomalyKind;
  message: string;
  /** How far the reading is from baseline, in SDs. */
  zScore: number;
}

/**
 * Flag vitals that deviate more than `threshold` standard deviations from the
 * personal baseline. Mirrors Oura/Whoop "Pay attention" tags.
 */
export function detectAnomalies(state: FitnessState, iso: string, threshold = 1.5): Anomaly[] {
  const v = vitalsOn(state, iso);
  const s = sleepOn(state, iso);
  if (!v && !s) return [];
  const b = personalBaselines(state, iso);
  const out: Anomaly[] = [];
  const z = (val: number | undefined, base: Baseline) => {
    if (val === undefined || !base.n || base.sd === 0) return 0;
    return (val - base.mean) / base.sd;
  };
  const zHrv = z(v?.hrvRmssd, b.hrv);
  const zRhr = z(v?.restingHR, b.rhr);
  const zResp = z(v?.respiratoryRate, b.respiratoryRate);
  const zSpo2 = z(v?.spo2, b.spo2);
  const zSleep = z(s?.durationMin, b.sleepDuration);

  if (zHrv <= -threshold)
    out.push({
      kind: 'hrv-low',
      message: `HRV is ${Math.abs(round(zHrv, 1))}σ below your 14-day baseline`,
      zScore: zHrv,
    });
  if (zRhr >= threshold)
    out.push({
      kind: 'rhr-high',
      message: `Resting HR is ${round(zRhr, 1)}σ above baseline — a possible sign of fatigue`,
      zScore: zRhr,
    });
  if (zResp >= threshold)
    out.push({
      kind: 'resp-high',
      message: 'Respiratory rate elevated overnight',
      zScore: zResp,
    });
  if (zSpo2 <= -threshold)
    out.push({
      kind: 'spo2-low',
      message: 'Blood oxygen dipped below your usual range',
      zScore: zSpo2,
    });
  if (v?.skinTempDelta && v.skinTempDelta >= 0.5)
    out.push({
      kind: 'temp-elevated',
      message: 'Wrist temperature elevated — possible early illness sign',
      zScore: v.skinTempDelta,
    });
  if (zSleep <= -threshold)
    out.push({
      kind: 'sleep-low',
      message: `Slept ${Math.abs(round(zSleep, 1))}σ less than your recent average`,
      zScore: zSleep,
    });
  return out;
}

/* ── Sleep scoring ────────────────────────────────────────────────────── */

const IDEAL_SLEEP_MIN = 8 * 60; // 8h target — will be personalized
const MIN_SLEEP_MIN = 5 * 60;

/** 0–100 sleep score combining duration and stage composition. */
export function sleepScore(sleep: SleepLog | null): number {
  if (!sleep || sleep.durationMin <= 0) return 0;
  // Duration component: linear up to ideal, then plateau
  let dur = Math.min(100, (sleep.durationMin / IDEAL_SLEEP_MIN) * 100);
  let stageBonus = 0;
  if (sleep.stages) {
    const asleep = sleep.stages.deep + sleep.stages.rem + sleep.stages.light;
    const eff = asleep > 0 ? asleep / sleep.durationMin : 0;
    const deepPct = asleep > 0 ? sleep.stages.deep / asleep : 0;
    const remPct = asleep > 0 ? sleep.stages.rem / asleep : 0;
    // Healthy targets: ~15–25% deep, ~20–25% REM, efficiency > 85%
    const deepScore = Math.min(100, (deepPct / 0.2) * 100);
    const remScore = Math.min(100, (remPct / 0.22) * 100);
    const effScore = Math.min(100, (eff / 0.9) * 100);
    stageBonus = round((deepScore + remScore + effScore) / 3, 0);
    return round(dur * 0.5 + stageBonus * 0.5, 0);
  }
  if (sleep.quality) dur = dur * 0.7 + (sleep.quality / 5) * 100 * 0.3;
  return Math.max(0, Math.min(100, round(dur, 0)));
}

/**
 * Rolling sleep debt, in minutes, relative to IDEAL over `windowDays`
 * (default 7). Negative values = deficit, positive = surplus.
 */
export function sleepDebt(state: FitnessState, iso: string, windowDays = 7): number {
  const win = sleepWindow(state, windowDays, iso);
  if (win.length === 0) return 0;
  const total = win.reduce((a, s) => a + s.durationMin, 0);
  return total - IDEAL_SLEEP_MIN * win.length;
}

/* ── HR-zone → Strain (0–21) ─────────────────────────────────────────── */

/**
 * Convert HR-zone minutes into a cardiovascular strain score on the WHOOP-style
 * 0–21 scale. Uses the Banister TRIMP weighting: Z1=1, Z2=2, Z3=3, Z4=4, Z5=5,
 * then normalises so that ~50 hard zone minutes ≈ score 14 and ~90 min ≈ 20.
 */
const ZONE_WEIGHTS = { z1: 1, z2: 2, z3: 3, z4: 4, z5: 5 } as const;
const STRAIN_NORM = 30; // minutes of Z3-equivalent per strain unit (tunable)

export function strainFromZoneMinutes(zm: {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
}): number {
  const weighted =
    zm.z1 * ZONE_WEIGHTS.z1 +
    zm.z2 * ZONE_WEIGHTS.z2 +
    zm.z3 * ZONE_WEIGHTS.z3 +
    zm.z4 * ZONE_WEIGHTS.z4 +
    zm.z5 * ZONE_WEIGHTS.z5;
  // Map raw weighted-minutes to 0–21 with a saturating curve.
  const raw = (weighted / STRAIN_NORM) * 1;
  const score = 21 * (1 - Math.exp(-raw / 5.5));
  return Math.max(0, Math.min(21, round(score, 1)));
}

/** Estimate zone minutes from a session's intensity & duration, as a fallback. */
function estimatedZoneMinutesFromSession(s: {
  durationMin: number;
  intensity: 'low' | 'moderate' | 'high';
}): { z1: number; z2: number; z3: number; z4: number; z5: number } {
  const d = Math.max(0, s.durationMin);
  switch (s.intensity) {
    case 'low':
      return { z1: d * 0.7, z2: d * 0.3, z3: 0, z4: 0, z5: 0 };
    case 'moderate':
      return { z1: d * 0.2, z2: d * 0.4, z3: d * 0.3, z4: d * 0.1, z5: 0 };
    case 'high':
      return { z1: d * 0.1, z2: d * 0.2, z3: d * 0.3, z4: d * 0.3, z5: d * 0.1 };
  }
}

function addZoneMinutes(
  a: { z1: number; z2: number; z3: number; z4: number; z5: number },
  b: { z1: number; z2: number; z3: number; z4: number; z5: number },
) {
  return {
    z1: a.z1 + b.z1,
    z2: a.z2 + b.z2,
    z3: a.z3 + b.z3,
    z4: a.z4 + b.z4,
    z5: a.z5 + b.z5,
  };
}

/** Compute daily strain for an ISO date. Uses VitalsLog zone minutes if
 *  available, otherwise falls back to logged sessions. */
export function dailyStrain(state: FitnessState, iso: string): DailyStrain {
  const v = vitalsOn(state, iso);
  let zm = v?.hrZoneMinutes ?? { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  if (!v?.hrZoneMinutes) {
    const sessions = state.sessions.filter((s) => s.date === iso);
    for (const s of sessions) {
      zm = addZoneMinutes(zm, estimatedZoneMinutesFromSession(s));
    }
  }
  const score = strainFromZoneMinutes(zm);

  // ACWR: 7-day daily avg strain vs 28-day
  const end = fromISODate(iso);
  const acuteStart = toISODate(new Date(end.getTime() - 6 * 86_400_000));
  const chronicStart = toISODate(new Date(end.getTime() - 27 * 86_400_000));
  const acuteSessions = sessionsInRange(state, acuteStart, iso);
  const chronicSessions = sessionsInRange(state, chronicStart, iso);

  // Simple proxy: sum tonnage acute / chronic until we have real strain history.
  const acuteVol = acuteSessions.reduce((a, s) => a + sessionVolume(s), 0) / 7;
  const chronicVol = chronicSessions.reduce((a, s) => a + sessionVolume(s), 0) / 28;
  const acwr = chronicVol > 0 ? round(acuteVol / chronicVol, 2) : 1;

  return { date: iso, score, zoneMinutes: zm, acwr };
}

/* ── Daily Readiness / Recovery (0–100) ───────────────────────────────── */

function hrvScoreFor(v: VitalsLog | null, base: Baseline): number {
  if (!v?.hrvRmssd || !base.n) return 60; // neutral when not enough data
  const z = base.sd > 0 ? (v.hrvRmssd - base.mean) / base.sd : 0;
  const s = 70 + z * 10; // +1σ = 80, -1σ = 60
  return Math.max(10, Math.min(100, round(s, 0)));
}

function rhrScoreFor(v: VitalsLog | null, base: Baseline): number {
  if (!v?.restingHR || !base.n) return 60;
  const z = base.sd > 0 ? (v.restingHR - base.mean) / base.sd : 0;
  // High RHR is bad — invert the z
  const s = 70 - z * 10;
  return Math.max(10, Math.min(100, round(s, 0)));
}

/**
 * Pull together HRV, RHR, sleep, and recent strain into a single 0–100
 * readiness score. With no biometric data we degrade gracefully using the
 * training-only readiness already implemented in training.ts.
 */
export function dailyReadiness(state: FitnessState, iso: string, now = new Date()): DailyReadiness {
  const v = vitalsOn(state, iso);
  const s = sleepOn(state, iso);
  const hasBiometrics = !!(v && (v.hrvRmssd || v.restingHR));
  const base = personalBaselines(state, iso);

  const hrvS = hrvScoreFor(v ?? null, base.hrv);
  const rhrS = rhrScoreFor(v ?? null, base.rhr);
  const sleepS = sleepScore(s);
  const anomalies = detectAnomalies(state, iso);

  // Strain balance: how aligned is yesterday's strain with prior recovery?
  const yesterday = new Date(fromISODate(iso));
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = toISODate(yesterday);
  const yestStrain = dailyStrain(state, yesterdayIso);
  const priorRecovery =
    iso !== toISODate(now) && state.sleepLogs?.length
      ? sleepScore(sleepOn(state, yesterdayIso))
      : 50;
  let strainBalance = 70;
  if (yestStrain.score > 14 && priorRecovery < 55) strainBalance = 40;
  else if (yestStrain.score > 14 && priorRecovery >= 70) strainBalance = 65;
  else if (yestStrain.score < 7 && priorRecovery >= 65) strainBalance = 85;

  // Composite: weight components (HRV/RHR anchor when present; sleep always)
  let composite: number;
  if (hasBiometrics) {
    composite = hrvS * 0.3 + rhrS * 0.25 + sleepS * 0.25 + strainBalance * 0.2;
  } else if (s) {
    // Only sleep available
    composite = sleepS * 0.6 + strainBalance * 0.4;
  } else {
    // Fall back to training-derived heuristic
    const daysSince = daysSinceHardSession(state, now);
    if (daysSince <= 0) composite = 55;
    else if (daysSince === 1) composite = 65;
    else if (daysSince <= 3) composite = 80;
    else composite = 75;
  }

  // Penalty for anomalies
  composite -= anomalies.length * 4;
  composite = Math.max(5, Math.min(100, round(composite, 0)));

  const factors: string[] = [];
  if (anomalies.length) {
    factors.push(anomalies[0].message);
  }
  if (sleepS < 55) factors.push('Short sleep last night — consider an easy day');
  else if (sleepS >= 85 && composite >= 75) factors.push('Solid night of sleep');
  if (hrvS <= 55) factors.push('HRV is below your baseline');
  else if (hrvS >= 80) factors.push('HRV trending up — a strong day to train');
  if (yestStrain.acwr > 1.4) factors.push('Training load climbing — watch for overreaching');

  // Label
  let label: DailyReadiness['label'];
  let recMin: number;
  let recMax: number;
  let recommendation: string;
  if (!v && !s && state.sessions.length < 3) {
    label = 'Calibrating';
    recMin = 8;
    recMax = 14;
    recommendation = 'Log a few sessions or connect a wearable to calibrate';
  } else if (composite >= 80) {
    label = 'Optimal';
    recMin = 12;
    recMax = 20;
    recommendation = 'Heavy lift or high-intensity day — push it';
  } else if (composite >= 65) {
    label = 'Good';
    recMin = 9;
    recMax = 15;
    recommendation = 'Normal training day — stick to the plan';
  } else if (composite >= 50) {
    label = 'Moderate';
    recMin = 6;
    recMax = 11;
    recommendation = 'Moderate session — focus on technique and mobility';
  } else {
    label = 'Low';
    recMin = 0;
    recMax = 7;
    recommendation = 'Active recovery or rest — let the body catch up';
  }

  return {
    date: iso,
    score: composite,
    label,
    hrvScore: hrvS,
    rhrScore: rhrS,
    sleepScore: sleepS,
    strainBalanceScore: strainBalance,
    factors: factors.slice(0, 3),
    recommendedStrainMin: recMin,
    recommendedStrainMax: recMax,
    recommendation,
  };
}

function daysSinceHardSession(state: FitnessState, now: Date): number {
  const today = toISODate(now);
  const list = state.sessions
    .filter((s) => s.date <= today && s.intensity === 'high')
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (list.length === 0) return 99;
  const last = list[0];
  return daysBetween(fromISODate(last.date), startOfDay(now));
}

/* ── Weekly strain series (for the trends chart) ──────────────────────── */

export interface StrainPoint {
  date: string;
  strain: number;
  recovery: number;
}

export function strainRecoverySeries(
  state: FitnessState,
  days = 28,
  now = new Date(),
): StrainPoint[] {
  const out: StrainPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(startOfDay(now));
    d.setDate(d.getDate() - i);
    const iso = toISODate(d);
    out.push({
      date: iso,
      strain: dailyStrain(state, iso).score,
      recovery: dailyReadiness(state, iso, d).score,
    });
  }
  return out;
}

/* ── Seed helpers (manual entry defaults) ─────────────────────────────── */

/** Baseline vital reference ranges for a generic 30-year-old adult.
 *  Used only when the user has no data yet, so empty cards show "-". */
export const POPULATION_RANGES = {
  hrvRmssd: { min: 30, max: 80, typical: 50 },
  restingHR: { min: 45, max: 70, typical: 58 },
  respiratoryRate: { min: 12, max: 18, typical: 15 },
  spo2: { min: 95, max: 99, typical: 97 },
  sleepMin: { min: 6 * 60, max: 9 * 60, typical: 8 * 60 },
};
