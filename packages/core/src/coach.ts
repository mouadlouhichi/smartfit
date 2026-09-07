/**
 * The coach engine.
 *
 * One deterministic, testable function shared by every surface (the web coach
 * page, the dashboard panel and — in future — mobile). It is intentionally
 * rule-based and runs entirely on-device: no model, no network, no data
 * leaving the client. Everything it reports is derived from real state, and
 * every chip carries a real percentage.
 */
import {
  categoryBreakdown,
  categoryById,
  currentStreak,
  daysSinceLastSession,
  endOfWeek,
  getPlan,
  goalProgress,
  startOfWeek,
  thisWeek,
  todaysAgenda,
  todaysFocus,
  toISODate,
  weekStartOf,
  weeklyStreak,
} from './fitness';
import { formatCalories, formatDistance, formatMinutes, relativeDay } from './format';
import type { FitnessState } from './types';

export interface CoachChip {
  label: string;
  value: string;
  /** Share of the period total, 0-100 — a real number, never decorative. */
  pct: number;
}

export interface CoachAnswer {
  text: string;
  chips?: CoachChip[];
}

/** Suggested prompts. Every one of these is actually answered below. */
export const COACH_QUICK_REPLIES = [
  'How am I doing this week?',
  'What should I train today?',
  'How many calories did I burn?',
  'Am I on track for my goals?',
] as const;

export function coachGreeting(name: string | undefined, now = new Date()): string {
  const h = now.getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const who = name?.trim() ? `, ${name.trim()}` : '';
  return `Good ${part}${who}! Ask me about your week, today's session, calories or your goals — it's all worked out on this device.`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

function weekSessions(state: FitnessState, now: Date) {
  const ws = weekStartOf(state);
  const from = toISODate(startOfWeek(now, ws));
  const to = toISODate(endOfWeek(now, ws));
  return state.sessions.filter((s) => s.date >= from && s.date <= to);
}

/** Category chips for the current week, weighted by real calorie share. */
function calorieChips(state: FitnessState, now: Date): CoachChip[] {
  const sessions = weekSessions(state, now);
  const total = sessions.reduce((a, s) => a + s.calories, 0);
  if (total <= 0) return [];

  const byCat = new Map<string, number>();
  for (const s of sessions) byCat.set(s.categoryId, (byCat.get(s.categoryId) ?? 0) + s.calories);

  return [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([categoryId, kcal]) => ({
      label: categoryById(state, categoryId).name,
      value: formatCalories(kcal),
      pct: Math.round((kcal / total) * 100),
    }));
}

function answerToday(state: FitnessState, now: Date): CoachAnswer {
  const focus = todaysFocus(state, now);
  const agenda = todaysAgenda(state, now);
  const streak = currentStreak(state, now);
  const plan = getPlan(state.profile.planId);

  const pending = agenda.filter((a) => !a.done);
  const done = agenda.filter((a) => a.done);

  if (agenda.length > 0) {
    const parts: string[] = [];
    if (focus) parts.push(`Today's focus is ${focus}.`);
    if (pending.length) {
      parts.push(
        `You've got ${pending.map((a) => `${a.slot.title} at ${a.slot.timeOfDay}`).join(' and ')} still to do.`,
      );
    }
    if (done.length) {
      parts.push(`${done.map((a) => a.slot.title).join(', ')} — already logged, nice work.`);
    }
    parts.push(
      pending.length
        ? 'Warm up properly, hit your working sets, and log it when you finish.'
        : `That's your plan complete for today. Streak: ${streak} ${plural(streak, 'day')}.`,
    );
    return { text: parts.join(' ') };
  }

  if (focus) {
    return {
      text: `Today's focus is ${focus} on your ${plan.name} plan, though nothing is scheduled. Log whatever you get done and it still counts toward your ${streak}-day streak.`,
    };
  }

  return {
    text: `Nothing's scheduled today on ${plan.name} — this is a rest day. Recovery is part of the plan; a walk or some mobility work keeps your ${streak}-day streak alive without adding fatigue.`,
  };
}

function answerGoals(state: FitnessState, now: Date): CoachAnswer {
  if (state.goals.length === 0) {
    return {
      text: "You haven't set a goal yet. Add one from the Goals tab — a weekly workout or active-minutes target is the easiest place to start — and I'll keep you honest.",
    };
  }

  const rows = state.goals.map((g) => ({ goal: g, progress: goalProgress(state, g, now) }));
  const done = rows.filter((r) => r.progress.done).length;
  const detail = rows
    .map(
      (r) =>
        `${r.goal.name}: ${r.progress.current}/${r.progress.target} (${Math.round(r.progress.pct)}%)`,
    )
    .join('. ');

  const chips: CoachChip[] = rows.slice(0, 4).map((r) => ({
    label: r.goal.name,
    value: `${r.progress.current}/${r.progress.target}`,
    pct: Math.round(r.progress.pct),
  }));

  const lead =
    done === rows.length
      ? `Every goal is complete — ${rows.length} out of ${rows.length}.`
      : `You're tracking ${rows.length} ${plural(rows.length, 'goal')}, ${done} complete.`;

  return { text: `${lead} ${detail}.`, chips };
}

function answerCalories(state: FitnessState, now: Date): CoachAnswer {
  const week = thisWeek(state, now);
  const latest = state.sessions[0];
  const chips = calorieChips(state, now);
  return {
    text: `You burned ${formatCalories(week.calories)} across ${week.workouts} ${plural(
      week.workouts,
      'session',
    )} this week${latest ? ` — the last one was ${formatCalories(latest.calories)} on ${relativeDay(latest.date)}` : ''}.${
      chips.length ? " Here's where it came from:" : ''
    }`,
    chips: chips.length ? chips : undefined,
  };
}

function answerWeek(state: FitnessState, now: Date): CoachAnswer {
  const week = thisWeek(state, now);
  const streak = currentStreak(state, now);
  const weeks = weeklyStreak(state, now);
  const breakdown = categoryBreakdown(state, weekSessions(state, now));
  const top = breakdown[0];

  const bits = [
    `${week.workouts} ${plural(week.workouts, 'workout')}`,
    formatMinutes(week.minutes) + ' active',
  ];
  if (week.distance > 0)
    bits.push(formatDistance(week.distance, state.profile.distanceUnit) + ' covered');

  const tail =
    week.workouts === 0
      ? 'Nothing logged yet this week — one session today puts you back on the board.'
      : weeks > 1
        ? `That's ${weeks} weeks running where you've hit your target. Consistency is the whole game.`
        : 'Keep the momentum going — consistency beats intensity.';

  return {
    text: `Here's your week: ${bits.join(', ')}, and a ${streak}-day streak.${
      top ? ` Most of your time went to ${top.category.name}.` : ''
    } ${tail}`,
  };
}

/**
 * Answer a free-text question about the athlete's own training.
 * Deterministic and pure — the same state and question always give the same
 * answer, which is what makes it testable.
 */
export function answerCoach(question: string, state: FitnessState, now = new Date()): CoachAnswer {
  const q = question.toLowerCase();

  if (state.sessions.length === 0) {
    const plan = getPlan(state.profile.planId);
    return {
      text: `You haven't logged a session yet, so there's nothing for me to analyse. Your plan is "${plan.name}" — log your first workout and I'll start tracking volume, calories, streaks and goal progress from there.`,
    };
  }

  if (/(calor|kcal|burn|energy)/.test(q)) return answerCalories(state, now);
  if (/(goal|target|on track)/.test(q)) return answerGoals(state, now);
  if (/(today|train|workout|should i|session|plan|schedule)/.test(q))
    return answerToday(state, now);

  if (/(rest|recover|sleep|sore|tired)/.test(q)) {
    const gap = daysSinceLastSession(state, now);
    return {
      text: `Recovery is training. Aim for 7–9 hours of sleep after hard sessions and keep one or two genuinely easy days a week.${
        gap !== null
          ? gap === 0
            ? " You trained today — if you're feeling beaten up, tomorrow is a good day to go light."
            : ` Your last session was ${gap} ${plural(gap, 'day')} ago.`
          : ''
      }`,
    };
  }

  if (/(streak|momentum|consisten)/.test(q)) {
    const streak = currentStreak(state, now);
    const weeks = weeklyStreak(state, now);
    return {
      text: `You're on a ${streak}-day training streak, and you've hit your weekly target ${weeks} ${plural(
        weeks,
        'week',
      )} in a row. Rest days you've planned for don't break it — only disappearing does.`,
    };
  }

  return answerWeek(state, now);
}
