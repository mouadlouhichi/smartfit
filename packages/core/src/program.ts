import type { FitnessState, Intensity, ScheduledWorkout, Weekday } from './types';
import { getPlan } from './fitness';
import { formatWeight } from './format';
import { round } from './utils';

/**
 * Gym programs & the suggested-week engine.
 *
 * The first shipped program is the Zone Fight gym weekly timetable
 * (transcribed from the gym's posted schedule). Suggestions are *dynamic*:
 * the mix of session types follows the distance between the athlete's latest
 * logged weight and their target weight (`profile.targetWeightKg`) — a big
 * gap biases the week toward burn (HIIT/cardio/combat), closing in shifts
 * strength up, and reaching the target flips the plan to maintenance.
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

const c = (
  id: string,
  name: string,
  focus: ClassFocus,
  intensity: Intensity,
  minutes: number,
): GymClass => ({ id, name, focus, intensity, minutes });

const ZONE_FIGHT_CLASSES: Record<string, GymClass> = Object.fromEntries(
  [
    c('fat-burner', 'Fat Burner', 'cardio', 'high', 50),
    c('tbc', 'TBC', 'strength', 'moderate', 50),
    c('xtrem-abdos', 'Xtrem Abdos', 'strength', 'high', 30),
    c('hiit-fusion', 'HIIT Fusion', 'hiit', 'high', 45),
    c('spinning', 'Spinning', 'cardio', 'high', 45),
    c('aqua-gym', 'Aqua Gym', 'aqua', 'moderate', 45),
    c('caf', 'CAF', 'strength', 'moderate', 45),
    c('aqua-dynamic', 'Aqua Dynamic', 'aqua', 'moderate', 45),
    c('power-circuit', 'Power Circuit', 'hiit', 'high', 50),
    c('body-sculpt', 'Body Sculpt', 'strength', 'moderate', 50),
    c('fight-combat', 'Fight Combat', 'combat', 'high', 45),
    c('boxe', 'Boxe', 'combat', 'high', 60),
    c('mma', 'MMA', 'combat', 'high', 60),
    c('power-pump', 'Power Pump', 'strength', 'moderate', 50),
    c('aqua-combat', 'Aqua Combat', 'aqua', 'moderate', 45),
    c('xtrem-fit', 'Xtrem Fit', 'hiit', 'high', 45),
    c('tabata', 'Tabata', 'hiit', 'high', 30),
    c('cardio-training', 'Cardio Training', 'cardio', 'moderate', 50),
    c('pilates', 'Pilates', 'mind', 'low', 50),
    c('self-defense', 'Self Defense', 'combat', 'moderate', 45),
    c('stretching', 'Stretching', 'mind', 'low', 30),
    c('special-abdos', 'Special Abdos', 'strength', 'moderate', 30),
    c('taf', 'TAF', 'strength', 'moderate', 45),
    c('cross-training', 'Cross Training', 'hiit', 'high', 60),
    c('aqua-fitness', 'Aqua Fitness', 'aqua', 'moderate', 45),
  ].map((k) => [k.id, k]),
);

const w = (weekday: number, time: string, classId: string): GymSlot => ({ weekday, time, classId });

/** Zone Fight's posted weekly grid, Monday-first rows → weekday indexes. */
export const ZONE_FIGHT: GymProgram = {
  id: 'zone-fight',
  name: 'Zone Fight gym',
  hours: 'Mon–Fri 06:00–22:00 · Sat 09:00–20:00 · Sun 09:00–18:00',
  classes: ZONE_FIGHT_CLASSES,
  week: [
    // Lundi
    w(1, '08:00', 'fat-burner'),
    w(1, '09:00', 'tbc'),
    w(1, '10:00', 'xtrem-abdos'),
    w(1, '12:00', 'hiit-fusion'),
    w(1, '16:30', 'tabata'),
    w(1, '17:30', 'body-sculpt'),
    w(1, '18:30', 'mma'),
    w(1, '19:30', 'power-pump'),
    w(1, '20:30', 'stretching'),
    // Mardi
    w(2, '08:00', 'spinning'),
    w(2, '09:00', 'aqua-gym'),
    w(2, '10:00', 'caf'),
    w(2, '12:00', 'tbc'),
    w(2, '12:00', 'aqua-dynamic'),
    w(2, '16:30', 'power-circuit'),
    w(2, '17:30', 'aqua-gym'),
    w(2, '17:30', 'fight-combat'),
    w(2, '18:30', 'boxe'),
    w(2, '19:30', 'spinning'),
    w(2, '19:30', 'aqua-combat'),
    w(2, '20:30', 'xtrem-abdos'),
    // Mercredi
    w(3, '08:00', 'cardio-training'),
    w(3, '09:00', 'body-sculpt'),
    w(3, '10:00', 'xtrem-abdos'),
    w(3, '12:00', 'xtrem-fit'),
    w(3, '16:30', 'pilates'),
    w(3, '17:30', 'hiit-fusion'),
    w(3, '18:30', 'tbc'),
    w(3, '19:30', 'power-circuit'),
    w(3, '19:30', 'self-defense'),
    w(3, '20:30', 'stretching'),
    // Jeudi
    w(4, '08:00', 'spinning'),
    w(4, '09:00', 'aqua-gym'),
    w(4, '10:00', 'tbc'),
    w(4, '12:00', 'body-sculpt'),
    w(4, '12:00', 'aqua-fitness'),
    w(4, '16:30', 'tabata'),
    w(4, '17:30', 'caf'),
    w(4, '18:30', 'aqua-gym'),
    w(4, '18:30', 'power-pump'),
    w(4, '19:30', 'spinning'),
    w(4, '19:30', 'boxe'),
    w(4, '20:30', 'special-abdos'),
    // Vendredi
    w(5, '08:00', 'power-circuit'),
    w(5, '09:00', 'pilates'),
    w(5, '10:00', 'boxe'),
    w(5, '12:00', 'hiit-fusion'),
    w(5, '16:30', 'taf'),
    w(5, '17:30', 'xtrem-fit'),
    w(5, '18:30', 'mma'),
    w(5, '19:30', 'cross-training'),
    w(5, '20:30', 'stretching'),
    // Samedi
    w(6, '10:00', 'spinning'),
    w(6, '12:00', 'power-circuit'),
    w(6, '16:30', 'aqua-gym'),
    // Dimanche
    w(0, '10:00', 'cross-training'),
    w(0, '12:00', 'tbc'),
    w(0, '16:30', 'xtrem-abdos'),
  ],
};

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

/** Maps a suggested class focus onto the app's built-in categories. */
export const FOCUS_CATEGORY: Record<ClassFocus, string> = {
  cardio: 'cat-cardio',
  hiit: 'cat-hiit',
  strength: 'cat-strength',
  combat: 'cat-sports',
  mind: 'cat-mobility',
  aqua: 'cat-cardio',
};

/** Latest canonical body weight (kg) from the logs, or null. */
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
 * with timetable days if the plan trains fewer), each matched to a real Zone
 * Fight class of the needed focus at a real timetable slot.
 */
export function suggestProgram(
  state: FitnessState,
  program: GymProgram = ZONE_FIGHT,
): SuggestedSession[] {
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

/** Every gym program the app can build a suggested week from. */
export const GYM_PROGRAMS: GymProgram[] = [ZONE_FIGHT];

/** Resolves the athlete's selected gym (`profile.gymId`), or null. */
export function getGymProgram(gymId: string | undefined | null): GymProgram | null {
  if (!gymId) return null;
  return GYM_PROGRAMS.find((p) => p.id === gymId) ?? null;
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
