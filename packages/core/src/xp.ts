import type { FitnessState, WorkoutSession } from './types';
import { computeAchievements, bestStreak, personalRecords, totalVolume } from './training';

/**
 * XP and levels — the gamification layer TapFit ships and SmartFit did not.
 *
 * Design rules, inherited from the achievement wall:
 *
 *  1. **Derived, never stored.** XP is a pure function of the log, exactly like
 *     `computeAchievements`. Nothing to migrate, nothing to drift, and
 *     re-importing a backup restores the exact same level.
 *  2. **Monotonic.** Every award is counted from a quantity that only ever
 *     grows — sessions, minutes, tonnage, records, *best* streak, meals,
 *     weigh-ins, badges, check-ins. Deleting a session can still cost XP (that
 *     is honest), but a week rolling over can never silently demote someone,
 *     which is what makes check-in-free level maths safe.
 *  3. **Explainable.** `xpBreakdown` returns every line with its award rate, so
 *     the UI can print "where the number comes from" — the same transparency
 *     rule the nutrition targets follow. No black-box score.
 *
 * The curve is deliberately gentle at the start (level 2 after roughly one
 * solid week) and linear thereafter, so progress never stalls for months.
 */

/** What one unit of progress is worth. Exported so the UI can quote the rates. */
export const XP_AWARDS = {
  /** Every logged session, before duration/intensity modifiers. */
  session: 30,
  /** Per training minute, on top of the session award. */
  perMinute: 1,
  /** Extra for a hard session — the effort nobody can see in the log. */
  intensity: { low: 0, moderate: 10, high: 25 },
  /** Per 250 kg of lifetime tonnage. */
  perVolumeKg: 250,
  volume: 1,
  /** Each lift that holds a personal record. */
  record: 25,
  /** Per day of the athlete's *best* streak (not the current one — see 2). */
  streakDay: 15,
  /** Each logged meal. */
  meal: 5,
  /** Each weigh-in the athlete bothered to record. */
  weighIn: 10,
  /** Each unlocked badge. */
  achievement: 50,
  /** Each weekly check-in answered. */
  checkIn: 30,
} as const;

/** Cost of going from `level` to `level + 1`. */
export const LEVEL_BASE_XP = 300;
/** How much more each subsequent level costs. */
export const LEVEL_STEP_XP = 150;

/** Highest level that still has a bespoke title. */
export const LEVEL_TITLES = [
  'Groundwork',
  'Warm-Up',
  'Steady',
  'Consistent',
  'Committed',
  'Strong',
  'Relentless',
  'Ironclad',
  'Elite',
  'Titan',
] as const;

/** Title for a level (1-based). Past the list, the last title sticks. */
export function levelTitle(level: number): string {
  const i = Math.max(1, Math.trunc(level)) - 1;
  return LEVEL_TITLES[Math.min(i, LEVEL_TITLES.length - 1)];
}

/** Cumulative XP needed to *be* at `level`. Level 1 starts at 0 XP. */
export function xpToReachLevel(level: number): number {
  const n = Math.max(1, Math.trunc(level)) - 1;
  // Sum of an arithmetic series: n steps starting at LEVEL_BASE_XP, +STEP each.
  return (n * (2 * LEVEL_BASE_XP + (n - 1) * LEVEL_STEP_XP)) / 2;
}

/** The level an XP total sits at, with everything the UI needs to draw it. */
export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level costs in total. */
  needed: number;
  /** Absolute XP at which the next level starts (used for the ring label). */
  nextLevelAt: number;
  /** 0–100, for the progress bar. */
  progressPct: number;
  /** XP still missing for the next level. */
  remaining: number;
}

export function levelInfo(xp: number): LevelInfo {
  const total = Math.max(0, Math.round(xp));
  let level = 1;
  // Cost grows linearly, so the walk is O(level) — a handful of iterations even
  // for years of logging. A closed form would be opaque; this stays readable.
  while (level < 200 && total >= xpToReachLevel(level + 1)) level += 1;
  const at = xpToReachLevel(level);
  const nextLevelAt = xpToReachLevel(level + 1);
  const needed = nextLevelAt - at;
  const into = total - at;
  return {
    level,
    title: levelTitle(level),
    xp: total,
    into,
    needed,
    nextLevelAt,
    progressPct: needed > 0 ? Math.min(100, Math.round((into / needed) * 100)) : 0,
    remaining: Math.max(0, needed - into),
  };
}

/** One line of the XP statement: where the points came from. */
export interface XpSource {
  id: string;
  label: string;
  /** Catalog key for the label, so the statement localises like everything else. */
  labelKey: string;
  /** The arithmetic, in words — "12 sessions × 30". */
  detail: string;
  xp: number;
}

/**
 * XP contributed by one session, using the same rates as the breakdown.
 * Public so the post-workout celebration can say "+65 XP" for the session that
 * was just finished, without recomputing the whole statement twice.
 */
export function xpForSession(session: WorkoutSession): number {
  const minutes = Math.max(0, Math.round(session.durationMin));
  const intensity = XP_AWARDS.intensity[session.intensity] ?? 0;
  return XP_AWARDS.session + minutes * XP_AWARDS.perMinute + intensity;
}

/**
 * The full XP statement, itemised.
 *
 * Every count is monotonic by construction (see the header). Check-ins are the
 * one source that needs stored history — that is what `FitnessState.checkIns`
 * is for, and an empty/absent list simply contributes nothing.
 */
export function xpBreakdown(state: FitnessState): XpSource[] {
  const sources: XpSource[] = [];
  const sessions = state.sessions.length;
  const minutes = state.sessions.reduce(
    (sum, s) => sum + Math.max(0, Math.round(s.durationMin)),
    0,
  );
  const volumeKg = Math.round(totalVolume(state.sessions));
  const records = personalRecords(state).length;
  const streak = bestStreak(state);
  const meals = state.meals.length;
  const weighIns = state.bodyLogs.filter((l) => l.unit === 'weight').length;
  const badges = computeAchievements(state).filter((a) => a.unlocked).length;
  const checkIns = state.checkIns?.length ?? 0;

  const sessionXp =
    state.sessions.reduce((sum, s) => sum + XP_AWARDS.session, 0) +
    minutes * XP_AWARDS.perMinute +
    state.sessions.reduce((sum, s) => sum + (XP_AWARDS.intensity[s.intensity] ?? 0), 0);
  if (sessionXp > 0) {
    sources.push({
      id: 'sessions',
      label: 'Sessions logged',
      labelKey: 'xp.source.sessions',
      detail: `${sessions} × ${XP_AWARDS.session} XP, plus ${minutes} min × ${XP_AWARDS.perMinute} XP and intensity bonuses`,
      xp: sessionXp,
    });
  }

  const volumeXp = Math.floor(volumeKg / XP_AWARDS.perVolumeKg) * XP_AWARDS.volume;
  if (volumeXp > 0) {
    sources.push({
      id: 'volume',
      label: 'Tonnage moved',
      labelKey: 'xp.source.volume',
      detail: `${(volumeKg / 1000).toFixed(1)} t ÷ ${XP_AWARDS.perVolumeKg} kg × ${XP_AWARDS.volume} XP`,
      xp: volumeXp,
    });
  }

  if (records > 0) {
    sources.push({
      id: 'records',
      label: 'Personal records',
      labelKey: 'xp.source.records',
      detail: `${records} × ${XP_AWARDS.record} XP`,
      xp: records * XP_AWARDS.record,
    });
  }

  if (streak > 0) {
    sources.push({
      id: 'streak',
      label: 'Best streak',
      labelKey: 'xp.source.streak',
      detail: `${streak} days × ${XP_AWARDS.streakDay} XP`,
      xp: streak * XP_AWARDS.streakDay,
    });
  }

  if (meals > 0) {
    sources.push({
      id: 'meals',
      label: 'Meals logged',
      labelKey: 'xp.source.meals',
      detail: `${meals} × ${XP_AWARDS.meal} XP`,
      xp: meals * XP_AWARDS.meal,
    });
  }

  if (weighIns > 0) {
    sources.push({
      id: 'weigh-ins',
      label: 'Weigh-ins',
      labelKey: 'xp.source.weighIns',
      detail: `${weighIns} × ${XP_AWARDS.weighIn} XP`,
      xp: weighIns * XP_AWARDS.weighIn,
    });
  }

  if (checkIns > 0) {
    sources.push({
      id: 'check-ins',
      label: 'Weekly check-ins',
      labelKey: 'xp.source.checkIns',
      detail: `${checkIns} × ${XP_AWARDS.checkIn} XP`,
      xp: checkIns * XP_AWARDS.checkIn,
    });
  }

  if (badges > 0) {
    sources.push({
      id: 'achievements',
      label: 'Badges earned',
      labelKey: 'xp.source.badges',
      detail: `${badges} × ${XP_AWARDS.achievement} XP`,
      xp: badges * XP_AWARDS.achievement,
    });
  }

  return sources;
}

/** Convenience: the whole gamification state in one call. */
export interface XpSummary extends LevelInfo {
  sources: XpSource[];
  /** XP earned in the last 7 days (sessions, meals, weigh-ins, check-ins). */
  thisWeek: number;
}

export function totalXp(state: FitnessState): number {
  return xpBreakdown(state).reduce((sum, s) => sum + s.xp, 0);
}

export function xpSummary(state: FitnessState, now = new Date()): XpSummary {
  const sources = xpBreakdown(state);
  const total = sources.reduce((sum, s) => sum + s.xp, 0);

  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  const fromIso = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  const since = (iso: string) => iso >= fromIso;

  const weekSessions = state.sessions.filter((s) => since(s.date));
  const thisWeek =
    weekSessions.reduce((sum, s) => sum + xpForSession(s), 0) +
    state.meals.filter((m) => since(m.date)).length * XP_AWARDS.meal +
    state.bodyLogs.filter((l) => l.unit === 'weight' && since(l.date)).length * XP_AWARDS.weighIn +
    (state.checkIns ?? []).filter((c) => since(c.date)).length * XP_AWARDS.checkIn;

  return { ...levelInfo(total), sources, thisWeek };
}

/**
 * XP difference between two states — how the post-workout celebration reports
 * "+65 XP" without storing a counter. Returns 0 when the delta is negative
 * (a deleted session), because celebrating a demotion would be absurd.
 */
export function xpDelta(before: FitnessState, after: FitnessState): number {
  return Math.max(0, totalXp(after) - totalXp(before));
}

/** True when `after` crossed into a new level, with the new level info. */
export function levelUp(
  before: FitnessState,
  after: FitnessState,
): { from: LevelInfo; to: LevelInfo } | null {
  const from = levelInfo(totalXp(before));
  const to = levelInfo(totalXp(after));
  return to.level > from.level ? { from, to } : null;
}
