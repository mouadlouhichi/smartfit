/**
 * Goal deadlines.
 *
 * A cadence goal ("5 workouts a week") answers *how much*. A deadline goal
 * ("75 kg by 12 December") answers *by when* — and the only useful thing to
 * say about one is whether the current pace gets there. This module produces
 * exactly that: required pace, current pace, and a plain verdict.
 *
 * It is deliberately conservative about what it claims. When there is not
 * enough history to compute a pace, it says so instead of extrapolating from
 * one data point, because a countdown built on noise is worse than no
 * countdown.
 */
import { fromISODate, metricValue, toISODate } from './fitness';
import type { FitnessGoal, FitnessState, GoalMetric } from './types';

const DAY_MS = 86_400_000;

export interface GoalDeadline {
  /** Days from today to the deadline (negative = overdue). */
  daysLeft: number;
  /** Whole days elapsed since the goal started. */
  daysElapsed: number;
  /** Progress so far, in the goal's own metric. */
  current: number;
  target: number;
  /** What still has to happen. */
  remaining: number;
  /** Units per week needed to arrive on time. */
  requiredPerWeek: number;
  /**
   * Units per week the athlete is actually moving, measured over the goal so
   * far. `null` when the goal is younger than a week — one session is not a pace.
   */
  actualPerWeek: number | null;
  /** `ahead` reaches it with room, `on-track` roughly lands on it, else `behind`. */
  verdict: 'done' | 'ahead' | 'on-track' | 'behind' | 'overdue' | 'unknown';
  /** One line the UI can print verbatim. */
  message: string;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = fromISODate(fromIso).getTime();
  const b = fromISODate(toIso).getTime();
  return Math.round((b - a) / DAY_MS);
}

/** Rounded, unit-aware formatting for the pace lines. */
function fmt(n: number, metric: GoalMetric, state: FitnessState): string {
  const rounded = Math.round(n * 10) / 10;
  switch (metric) {
    case 'distance':
      return `${rounded} ${state.profile.distanceUnit}`;
    case 'minutes':
      return `${Math.round(rounded)} min`;
    case 'calories':
      return `${Math.round(rounded)} kcal`;
    default:
      return `${rounded}`;
  }
}

/**
 * Deadline maths for one goal. Returns `null` when the goal has no deadline —
 * callers then fall back to the plain cadence progress.
 */
export function goalDeadline(
  state: FitnessState,
  goal: FitnessGoal,
  now = new Date(),
): GoalDeadline | null {
  if (!goal.deadline) return null;

  const today = toISODate(now);
  const start = goal.startDate || today;
  // A deadline on a weekly/monthly goal is a *range* commitment: the metric
  // counts work done inside the current period, so the honest reading is
  // "keep hitting the weekly number until the deadline".
  const current = metricValue(state.sessions, goal.metric);
  const target = Math.max(0, goal.target);
  const remaining = Math.max(0, target - current);
  const daysLeft = daysBetween(today, goal.deadline);
  const daysElapsed = Math.max(0, daysBetween(start, today));
  const weeksLeft = daysLeft / 7;

  const requiredPerWeek = weeksLeft > 0 ? remaining / weeksLeft : remaining;
  const actualPerWeek = daysElapsed >= 7 ? current / (daysElapsed / 7) : null;

  let verdict: GoalDeadline['verdict'] = 'unknown';
  let message: string;

  if (daysLeft < 0) {
    verdict = 'overdue';
    message = `The deadline passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago — move it, or keep the goal and start a new deadline.`;
  } else if (remaining <= 0) {
    verdict = 'done';
    message = `Done with ${daysLeft} day${daysLeft === 1 ? '' : 's'} to spare.`;
  } else if (actualPerWeek == null) {
    message = `Log a full week and we can tell you whether ${fmt(requiredPerWeek, goal.metric, state)} a week is realistic.`;
  } else {
    const ratio = requiredPerWeek > 0 ? actualPerWeek / requiredPerWeek : Infinity;
    if (ratio >= 1.15) verdict = 'ahead';
    else if (ratio >= 0.9) verdict = 'on-track';
    else verdict = 'behind';
    message =
      verdict === 'behind'
        ? `You need ${fmt(requiredPerWeek, goal.metric, state)} a week from here; you are averaging ${fmt(actualPerWeek, goal.metric, state)}.`
        : `${fmt(actualPerWeek, goal.metric, state)} a week against the ${fmt(requiredPerWeek, goal.metric, state)} needed — ${verdict === 'ahead' ? 'comfortably on course' : 'on course'}.`;
  }

  return {
    daysLeft,
    daysElapsed,
    current,
    target,
    remaining,
    requiredPerWeek,
    actualPerWeek,
    verdict,
    message,
  };
}

/** Human countdown for a card badge: "12 days left", "overdue", "today". */
export function deadlineLabel(deadline: string, now = new Date()): string {
  const days = daysBetween(toISODate(now), deadline);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  // Days up to six weeks, then weeks up to a quarter, then months: past ~13
  // weeks "23 weeks left" stops meaning anything to a human.
  if (days < 45) return `${days} days left`;
  const weeks = Math.round(days / 7);
  return weeks <= 13 ? `${weeks} weeks left` : `${Math.round(days / 30)} months left`;
}

/**
 * A deadline that keeps the cadence sane: used by the goal form to suggest
 * "when should this be true?" from the target and the athlete's own pace.
 * Weeks are rounded to the nearest sensible unit (2, 4, 6, 8, 12, 16, 24…).
 */
export function suggestDeadline(
  state: FitnessState,
  metric: GoalMetric,
  target: number,
  now = new Date(),
): string {
  const recent = state.sessions.slice(0, 20);
  const weeks = recent.length >= 4 ? 4 : 1;
  const pace = metricValue(recent, metric) / weeks || 1;
  const neededWeeks = Math.max(1, Math.ceil(target / pace));
  const rounded = [1, 2, 4, 6, 8, 12, 16, 24, 36, 52].find((w) => w >= neededWeeks) ?? neededWeeks;
  const d = new Date(now);
  d.setDate(d.getDate() + rounded * 7);
  return toISODate(d);
}
