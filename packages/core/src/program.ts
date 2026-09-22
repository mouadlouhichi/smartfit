import type { FitnessState, Intensity, ScheduledWorkout, Weekday } from './types';
import { getPlan } from './fitness';
import { formatWeight } from './format';
import { round } from './utils';

/**
 * The suggested-week engine.
 *
 * A `GymProgram` is a gym's weekly timetable — the classes it runs and when.
 * The app builds them from **real tenants** (`/g/{slug}`, `gyms/{slug}` in
 * Firestore): the server maps each live gym's classes + scheduled slots into
 * this shape and hands the list to the member surfaces (onboarding picker,
 * Plan tab). Suggestions are *dynamic*: the mix of session types follows the
 * distance between the athlete's latest logged weight and their target
 * weight (`profile.targetWeightKg`) — a big gap biases the week toward burn
 * (HIIT/cardio/combat), closing in shifts strength up, and reaching the
 * target flips the plan to maintenance.
 */

export type ClassFocus = 'cardio' | 'hiit' | 'strength' | 'combat' | 'mind' | 'aqua';

export interface GymClass {
  id: string;
  name: string;
  focus: ClassFocus;
  intensity: Intensity;
  minutes: number;
}

export interface GymSlot {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** 24h "HH:MM" */
  time: string;
  classId: string;
}

export interface GymProgram {
  id: string;
  name: string;
  hours: string;
  classes: Record<string, GymClass>;
  week: GymSlot[];
}

export interface SuggestedSession {
  weekday: number;
  time: string;
  gymClass: GymClass;
}

export function latestWeightKg(state: FitnessState): number | null {
  const logs = state.bodyLogs
    .filter((l) => l.unit === 'weight')
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  return logs.length > 0 ? logs[0].value : null;
}

/**
 * Signed distance from the latest logged weight to the target weight
 * (positive = still to lose). Null when either side is missing.
 */
export function kgToTarget(state: FitnessState): number | null {
  const target = state.profile.targetWeightKg;
  const weight = latestWeightKg(state);
  if (target == null || weight == null) return null;
  return round(weight - target, 1);
}

const BURN_CYCLE: ClassFocus[] = ['hiit', 'cardio', 'combat'];
const RECOVERY_CYCLE: ClassFocus[] = ['mind', 'aqua'];
const FALLBACK: Record<ClassFocus, ClassFocus[]> = {
  hiit: ['cardio', 'combat', 'strength'],
  cardio: ['hiit', 'combat', 'aqua'],
  combat: ['hiit', 'cardio', 'strength'],
  strength: ['hiit', 'mind'],
  mind: ['aqua', 'strength'],
  aqua: ['mind', 'cardio'],
};

/** Maps a class focus onto the built-in activity category ids. */
export const FOCUS_CATEGORY: Record<ClassFocus, string> = {
  cardio: 'cat-cardio',
  hiit: 'cat-hiit',
  strength: 'cat-strength',
  combat: 'cat-sports',
  mind: 'cat-mobility',
  aqua: 'cat-cardio',
};

/**
 * The weekly session-type mix. Bigger gaps to the target weight bias the
 * week toward burn work; at (or past) the target the mix becomes a
 * maintenance split with more strength and recovery.
 */
export function weeklyMix(kgLeft: number | null, sessions: number): ClassFocus[] {
  const n = Math.max(2, Math.min(7, Math.round(sessions)));
  const burnShare = kgLeft == null ? 0.5 : kgLeft > 0 ? Math.min(0.75, 0.5 + kgLeft * 0.02) : 0.35;
  const strengthShare = kgLeft != null && kgLeft <= 0 ? 0.4 : 0.3;
  let burn = Math.round(n * burnShare);
  let strength = Math.round(n * strengthShare);
  if (burn + strength > n) strength = Math.max(1, n - burn);
  let recovery = n - burn - strength;
  if (recovery < 0) {
    burn += recovery;
    recovery = 0;
  }
  const mix: ClassFocus[] = [];
  for (let i = 0; i < burn; i++) mix.push(BURN_CYCLE[i % BURN_CYCLE.length]);
  for (let i = 0; i < strength; i++) mix.push('strength');
  for (let i = 0; i < recovery; i++) mix.push(RECOVERY_CYCLE[i % RECOVERY_CYCLE.length]);
  return mix;
}

const slotKey = (s: GymSlot) => `${s.weekday}-${s.time}-${s.classId}`;
/** Prefer the ~18:00 window, then earlier slots. */
const timeScore = (t: string) => Math.abs(Number(t.slice(0, 2)) - 18);

/**
 * One deterministic suggested week: the strategy's training days (topped up
 * with timetable days if the plan trains fewer), each matched to a real class
 * of the needed focus at a real timetable slot of the given gym.
 */
export function suggestProgram(state: FitnessState, program: GymProgram): SuggestedSession[] {
  const plan = getPlan(state.profile.planId);
  const mix = weeklyMix(kgToTarget(state), plan.sessionsPerWeek);
  const days: number[] = plan.split.map((s) => s.weekday);
  for (let d = 1; d <= 6 && days.length < plan.sessionsPerWeek; d++) {
    if (!days.includes(d)) days.push(d);
  }
  if (days.length < plan.sessionsPerWeek && !days.includes(0)) days.push(0);

  const taken = new Set<string>();
  const out: SuggestedSession[] = [];
  days.slice(0, plan.sessionsPerWeek).forEach((day, i) => {
    const wanted = mix[i] ?? 'cardio';
    for (const focus of [wanted, ...(FALLBACK[wanted] ?? [])]) {
      const slot = program.week
        .filter(
          (s) =>
            s.weekday === day &&
            !taken.has(slotKey(s)) &&
            program.classes[s.classId]?.focus === focus,
        )
        .sort((a, b) => timeScore(a.time) - timeScore(b.time) || a.time.localeCompare(b.time))[0];
      if (slot) {
        taken.add(slotKey(slot));
        out.push({ weekday: day, time: slot.time, gymClass: program.classes[slot.classId] });
        return;
      }
    }
  });
  return out.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
}

/** Turns a suggestion into schedule rows the plan screen already renders. */
export function suggestedToSchedule(
  suggested: SuggestedSession[],
): Omit<ScheduledWorkout, 'id' | 'createdAt'>[] {
  return suggested.map((s) => ({
    title: s.gymClass.name,
    categoryId: FOCUS_CATEGORY[s.gymClass.focus],
    weekday: s.weekday as Weekday,
    timeOfDay: s.time,
    durationMin: s.gymClass.minutes,
    intensity: s.gymClass.intensity,
    active: true,
  }));
}

/**
 * Resolves the athlete's selected gym (`profile.gymId`, a tenant slug) from
 * the live gym list the server loaded — or null. There is no static registry:
 * the list is the source of truth, so a gym that closes stops resolving.
 */
export function findGymProgram(
  programs: GymProgram[],
  gymId: string | undefined | null,
): GymProgram | null {
  if (!gymId) return null;
  return programs.find((p) => p.id === gymId) ?? null;
}

/**
 * One-line summary of how the current gap to the target weight shapes the
 * suggested mix — shared by the Plan card and the Profile preview so both
 * always tell the same story.
 */
export function suggestSummary(state: FitnessState): string {
  const kgLeft = kgToTarget(state);
  const unit = state.profile.weightUnit;
  const target = state.profile.targetWeightKg;
  if (kgLeft == null) {
    return 'Set a target weight and log your weight — the mix then adapts automatically. This is a balanced starting week.';
  }
  if (kgLeft > 0) {
    return `${formatWeight(kgLeft, unit)} to your ${
      target != null ? formatWeight(target, unit) : 'target'
    } — burn-focused mix (HIIT · cardio · combat).`;
  }
  return 'Target reached — maintenance mix keeps strength high and recovery light.';
}
