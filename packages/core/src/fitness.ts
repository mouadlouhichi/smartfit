import { INTENSITY_META, PLANS } from './constants';
import type {
  FitnessState,
  GoalMetric,
  Intensity,
  WorkoutSession,
} from './types';
import { round } from './utils';

/** Estimated calories for a session: MET-ish multiplier × hours × ~body-weight factor. */
export function estimateCalories(durationMin: number, intensity: Intensity): number {
  const perMin = INTENSITY_META[intensity].multiplier; // kcal / ~10 min baseline
  return Math.round((durationMin * perMin) / 10) * 10;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Sunday
  return x;
}

export function weekKey(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const s = startOfWeek(d);
  return toISODate(s);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // yyyy-mm
}

export interface WeekAggregate {
  key: string;
  label: string;
  workouts: number;
  minutes: number;
  calories: number;
  distance: number;
}

export function sessionsInRange(state: FitnessState, fromISO: string, toISO: string): WorkoutSession[] {
  return state.sessions.filter((s) => s.date >= fromISO && s.date <= toISO);
}

export function aggregate(sessions: WorkoutSession[]): Omit<WeekAggregate, 'key' | 'label'> {
  return {
    workouts: sessions.length,
    minutes: sessions.reduce((a, s) => a + s.durationMin, 0),
    calories: sessions.reduce((a, s) => a + s.calories, 0),
    distance: round(sessions.reduce((a, s) => a + (s.distanceKm ?? 0), 0), 1),
  };
}

/** Last `n` weeks of aggregates, oldest first — the chart series. */
export function weeklySeries(state: FitnessState, n = 8): WeekAggregate[] {
  const out: WeekAggregate[] = [];
  const start = startOfWeek();
  for (let i = n - 1; i >= 0; i--) {
    const ws = new Date(start);
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const from = toISODate(ws);
    const to = toISODate(we);
    const agg = aggregate(sessionsInRange(state, from, to));
    out.push({
      key: from,
      label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ...agg,
    });
  }
  return out;
}

export function thisWeek(state: FitnessState): WeekAggregate {
  const s = startOfWeek();
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const from = toISODate(s);
  const to = toISODate(e);
  return { key: from, label: 'This week', ...aggregate(sessionsInRange(state, from, to)) };
}

/** Consecutive days (ending today or yesterday) with at least one session. */
export function currentStreak(state: FitnessState): number {
  if (state.sessions.length === 0) return 0;
  const days = new Set(state.sessions.map((s) => s.date));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow the streak to survive a not-yet-trained today.
  if (!days.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function totalWorkouts(state: FitnessState): number {
  return state.sessions.length;
}

export function metricValue(sessions: WorkoutSession[], metric: GoalMetric): number {
  switch (metric) {
    case 'workouts':
      return sessions.length;
    case 'minutes':
      return sessions.reduce((a, s) => a + s.durationMin, 0);
    case 'calories':
      return sessions.reduce((a, s) => a + s.calories, 0);
    case 'distance':
      return round(sessions.reduce((a, s) => a + (s.distanceKm ?? 0), 0), 1);
  }
}

export interface GoalProgress {
  current: number;
  target: number;
  pct: number;
  done: boolean;
}

export function goalProgress(
  state: FitnessState,
  goal: { metric: GoalMetric; cadence: 'weekly' | 'monthly'; target: number },
  now = new Date(),
): GoalProgress {
  let sessions: WorkoutSession[];
  if (goal.cadence === 'weekly') {
    const s = startOfWeek(now);
    const e = new Date(s);
    e.setDate(e.getDate() + 6);
    sessions = sessionsInRange(state, toISODate(s), toISODate(e));
  } else {
    const first = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const last = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    sessions = sessionsInRange(state, first, last);
  }
  const current = metricValue(sessions, goal.metric);
  const pct = goal.target > 0 ? Math.min(100, (current / goal.target) * 100) : 0;
  return { current, target: goal.target, pct: round(pct, 0), done: current >= goal.target };
}

/** Category breakdown for the current week (or supplied sessions). */
export function categoryBreakdown(state: FitnessState, sessions?: WorkoutSession[]) {
  const list = sessions ?? state.sessions;
  const map = new Map<string, number>();
  for (const s of list) {
    map.set(s.categoryId, (map.get(s.categoryId) ?? 0) + s.durationMin);
  }
  return state.categories
    .map((c) => ({
      category: c,
      minutes: map.get(c.id) ?? 0,
    }))
    .filter((x) => x.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export function getPlan(planId: string) {
  return PLANS.find((p) => p.id === planId) ?? PLANS[2];
}

export function todaysFocus(state: FitnessState, now = new Date()): string | null {
  const plan = getPlan(state.profile.planId);
  const wd = now.getDay();
  const slot = plan.split.find((s) => s.weekday === wd);
  return slot ? slot.focus : null;
}

export function latestBodyValue(state: FitnessState, unit: string): number | null {
  const logs = state.bodyLogs
    .filter((l) => l.unit === unit)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return logs.length ? logs[0].value : null;
}
