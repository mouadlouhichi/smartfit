/**
 * The weekly check-in.
 *
 * TapFit asks one question a week — how did it go? — and the answer is what
 * makes the plan feel like a conversation instead of a dashboard. SmartFit
 * made progress permanently visible but never *asked*, so nothing ever closed
 * the loop.
 *
 * This module is the whole feature minus the UI:
 *
 *   - `weeklyReview` computes the week that just ended (sessions, minutes,
 *     tonnage, weight delta, goal hits, streaks) so the flow arrives with the
 *     numbers already filled in — no self-reporting of data we already hold.
 *   - `checkInDue` decides whether to nudge, from the log rather than a timer:
 *     a check-in becomes due once a *completed* week has not been reviewed, and
 *     the nudge stops the moment it is answered.
 *   - `recordCheckIn` is the only writer, and it is pure — the store persists
 *     whatever it returns, exactly like every other domain mutation.
 */
import {
  aggregate,
  daysSinceLastSession,
  fromISODate,
  metricValue,
  sessionsInRange,
  startOfWeek,
  toISODate,
  weekStartOf,
} from './fitness';
import { totalVolume } from './training';
import { latestWeightKg } from './program';
import { createTranslator, type Translator, type Vars } from './i18n';
import type { FitnessState, WeeklyCheckIn } from './types';

const ENGLISH = createTranslator('en');

/** A localized sentence description kept separate from its computed inputs. */
export interface CheckInMessage {
  key: string;
  vars?: Vars;
}

const DAY_MS = 86_400_000;

/** The week a date belongs to, as its first day (ISO). */
export function weekOf(iso: string, weekStartsOn: 0 | 1): string {
  return toISODate(startOfWeek(fromISODate(iso), weekStartsOn));
}

export interface WeeklyReview {
  /** First day of the reviewed week. */
  weekOf: string;
  from: string;
  to: string;
  label: string;
  workouts: number;
  minutes: number;
  calories: number;
  volumeKg: number;
  /** Sessions the plan asked for, from the schedule or the plan's fork. */
  planned: number;
  /** Weight change across the week (canonical kg), when two weigh-ins exist. */
  weightDeltaKg: number | null;
  latestWeightKg: number | null;
  /** Goal metrics hit that week, described in plain words. */
  goalsHit: string[];
  goalsMissed: string[];
  /** Meals logged inside the window (the nutrition half of the week). */
  mealsLogged: number;
  /** True when a weigh-in landed inside the window. */
  weighedIn: boolean;
  /**
   * True when the week contains anything at all the athlete logged. A week of
   * food tracking with no training is still a week worth reviewing.
   */
  hasEntries: boolean;
  /** Best-effort streak continuity signal for the copy. */
  daysSinceLast: number | null;
  /** English compatibility copy; localized clients should use `headlineMessage`. */
  headline: string;
  /** The same evidence, as a catalog key and interpolation values. */
  headlineMessage: CheckInMessage;
}

/**
 * Review the week that ENDS on `now` (inclusive).
 *
 * The check-in is about a week you can actually judge, so the default caller
 * passes the last *complete* week (see `pendingCheckInWeek`) — but the maths
 * works for any 7-day window, which is what the tests use.
 */
export function weeklyReview(state: FitnessState, now = new Date()): WeeklyReview {
  const ws = weekStartOf(state);
  const to = toISODate(now);
  const from = toISODate(startOfWeek(now, ws));
  const sessions = sessionsInRange(state, from, to);
  const agg = aggregate(sessions);

  const activeSchedule = state.schedule.filter((s) => s.active);
  const planned = activeSchedule.length > 0 ? activeSchedule.length : 0;

  // Weight delta uses the weigh-ins inside the window, falling back to the
  // most recent ones either side so a quiet week still reports something true.
  const inWeek = state.bodyLogs
    .filter((l) => l.unit === 'weight' && l.date >= from && l.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const before = state.bodyLogs
    .filter((l) => l.unit === 'weight' && l.date < from)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .at(-1);
  const first = inWeek[0] ?? before;
  const last = inWeek.at(-1);
  const weightDeltaKg =
    first && last && first !== last ? Math.round((last.value - first.value) * 10) / 10 : null;

  const mealsLogged = state.meals.filter((m) => m.date >= from && m.date <= to).length;
  const weighedIn = state.bodyLogs.some(
    (l) => l.unit === 'weight' && l.date >= from && l.date <= to,
  );

  const goalsHit: string[] = [];
  const goalsMissed: string[] = [];
  for (const goal of state.goals.filter((item) => item.cadence === 'weekly')) {
    const value = metricValue(sessions, goal.metric);
    const line = `${goal.name} (${Math.round(value)}/${goal.target})`;
    if (value >= goal.target) goalsHit.push(line);
    else goalsMissed.push(line);
  }

  const daysSinceLast = daysSinceLastSession(state, now);
  const hitRate = planned > 0 ? agg.workouts / planned : null;

  const headlineMessage: CheckInMessage =
    agg.workouts === 0
      ? { key: 'checkin.headline.blank' }
      : hitRate != null && hitRate >= 1
        ? { key: 'checkin.headline.planMet', vars: { count: agg.workouts } }
        : hitRate != null && hitRate >= 0.6
          ? { key: 'checkin.headline.nearPlan', vars: { count: agg.workouts, planned } }
          : { key: 'checkin.headline.sessions', vars: { count: agg.workouts } };
  const headline = ENGLISH(headlineMessage.key, headlineMessage.vars);

  return {
    weekOf: from,
    from,
    to,
    label: weekLabel(from, to),
    workouts: agg.workouts,
    minutes: agg.minutes,
    calories: agg.calories,
    volumeKg: Math.round(totalVolume(sessions)),
    planned,
    weightDeltaKg,
    latestWeightKg: latestWeightKg(state),
    goalsHit,
    goalsMissed,
    mealsLogged,
    weighedIn,
    hasEntries: agg.workouts > 0 || mealsLogged > 0 || weighedIn,
    daysSinceLast,
    headline,
    headlineMessage,
  };
}

/** "1 – 7 Sep" style label for a week window. */
function weekLabel(from: string, to: string): string {
  const a = fromISODate(from);
  const b = fromISODate(to);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${a.getDate()} – ${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

export interface PendingCheckIn {
  /** The completed week awaiting a check-in. */
  weekOf: string;
  review: WeeklyReview;
  /** True once that week has been answered. */
  answered: boolean;
  /** Days since the week ended — drives how insistent the copy is. */
  daysWaiting: number;
}

/**
 * Whether a completed week is waiting to be reviewed.
 *
 * Due when the *previous* week has no check-in. The current week is never
 * asked about: reviewing a week you are still inside produces noise, and the
 * whole point of a check-in is that it closes something.
 */
export function pendingCheckIn(state: FitnessState, now = new Date()): PendingCheckIn | null {
  const ws = weekStartOf(state);
  const thisWeekStart = startOfWeek(now, ws);
  const lastWeekEnd = new Date(thisWeekStart.getTime() - DAY_MS);
  const review = weeklyReview(state, lastWeekEnd);
  const answered = (state.checkIns ?? []).some((c) => c.weekOf === review.weekOf);
  if (answered) return null;

  /*
   * Don't open a review the athlete has no material for.
   *
   * Without this, every brand-new account is greeted by "your week is
   * waiting" on its first day — asking someone to reflect on a week that
   * predates their account. The rule is: the account must have something
   * logged, and the reviewed week must either contain something OR the athlete
   * must already be in the habit (a blank week is worth reviewing once you
   * have a routine to protect; it is noise when you do not).
   */
  const hasHistory =
    state.sessions.length > 0 || state.meals.length > 0 || state.bodyLogs.length > 0;
  const inHabit = (state.checkIns ?? []).length > 0;
  if (!hasHistory) return null;
  if (!review.hasEntries && !inHabit) return null;
  const daysWaiting = Math.max(
    0,
    Math.round((thisWeekStart.getTime() - new Date(review.to + 'T00:00:00').getTime()) / DAY_MS),
  );
  return { weekOf: review.weekOf, review, answered, daysWaiting };
}

/** Check-ins newest first — the history list on the progress screen. */
export function checkInHistory(state: FitnessState): WeeklyCheckIn[] {
  return [...(state.checkIns ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** How many weeks in a row the athlete has answered, counting back from this one. */
export function checkInStreak(state: FitnessState, now = new Date()): number {
  const answered = new Set((state.checkIns ?? []).map((c) => c.weekOf));
  const ws = weekStartOf(state);
  let streak = 0;
  const cursor = new Date(startOfWeek(now, ws));
  // Walk backwards: the current week counts only if already answered, then
  // every earlier week that has a check-in keeps the count going.
  for (let i = 0; i < 260; i++) {
    if (answered.has(toISODate(cursor))) streak += 1;
    else if (i > 0) break;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

/** The shape the check-in form submits; the store turns it into a record. */
export interface CheckInInput {
  feeling: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

/**
 * Build the record to persist. Pure: the caller supplies the new id and the
 * timestamp, so the store keeps owning identity (same as every other mutation).
 */
export function recordCheckIn(
  state: FitnessState,
  input: CheckInInput,
  now = new Date(),
): Omit<WeeklyCheckIn, 'id'> {
  const ws = weekStartOf(state);
  const thisWeekStart = startOfWeek(now, ws);
  const lastWeekEnd = new Date(thisWeekStart.getTime() - DAY_MS);
  const review = weeklyReview(state, lastWeekEnd);
  return {
    date: toISODate(now),
    weekOf: review.weekOf,
    feeling: input.feeling,
    notes: input.notes?.trim().slice(0, 400) || undefined,
    workouts: review.workouts,
    minutes: review.minutes,
    weightKg: review.latestWeightKg ?? undefined,
    createdAt: now.getTime(),
  };
}

/**
 * What the check-in should suggest for next week, from what the week shows.
 * Returns at most two actions — a check-in that asks for five changes is a
 * check-in nobody completes twice.
 */
export function checkInActionMessages(state: FitnessState, review: WeeklyReview): CheckInMessage[] {
  const actions: CheckInMessage[] = [];

  if (review.workouts === 0) {
    const schedule = state.schedule.filter((s) => s.active).slice(0, 2);
    if (schedule.length > 0) {
      actions.push({
        key: 'checkin.action.scheduleFirst',
        vars: { names: schedule.map((s) => s.title).join(', ') },
      });
    } else {
      actions.push({ key: 'checkin.action.bookOne' });
    }
  } else if (review.planned > 0 && review.workouts < review.planned) {
    actions.push({
      key: 'checkin.action.moveMissed',
      vars: { workouts: review.workouts, planned: review.planned },
    });
  }

  if (review.daysSinceLast != null && review.daysSinceLast >= 5) {
    actions.push({ key: 'checkin.action.shortStart' });
  }

  const targets = state.goals.filter((g) => g.cadence === 'weekly');
  if (targets.length > 0 && review.goalsMissed.length > 0) {
    actions.push({ key: 'checkin.action.trimTarget', vars: { goal: review.goalsMissed[0] } });
  }

  if (actions.length === 0) {
    const next = state.goals.find((g) => g.cadence === 'weekly');
    actions.push(
      next
        ? { key: 'checkin.action.holdGoal', vars: { name: next.name } }
        : { key: 'checkin.action.consistency' },
    );
  }

  // Nothing above can produce an empty list; two is the ceiling by design.
  return actions.slice(0, 2);
}

/** Localized copy for the suggestions, with English retained as the default. */
export function checkInActions(
  state: FitnessState,
  review: WeeklyReview,
  translate: Translator = ENGLISH,
): string[] {
  return checkInActionMessages(state, review).map(({ key, vars }) => translate(key, vars));
}

/** Sentiment of a feeling score, for colour choices in the UI. */
export function feelingLabel(feeling: number): string {
  if (feeling <= 1) return 'Rough';
  if (feeling === 2) return 'Below par';
  if (feeling === 3) return 'Fine';
  if (feeling === 4) return 'Good';
  return 'Excellent';
}
