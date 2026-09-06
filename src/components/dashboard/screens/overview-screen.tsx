'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarCheck2,
  Clock,
  Dumbbell,
  Flame,
  Footprints,
  Plus,
  Target,
  Trash2,
  Sparkles,
  Activity,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Ring } from '../ring';
import { EmptyState } from '../empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/category-icon';
import { INTENSITY_META } from '@smartfit/core';
import { categoryBreakdown, currentStreak, getPlan, thisWeek, todaysFocus, goalProgress } from '@smartfit/core';
import { formatCalories, formatDistance, formatMinutes, relativeDay } from '@smartfit/core';
import type { WorkoutSession } from '@smartfit/core';

const QUICK = [
  { label: 'Workout', icon: Dumbbell, modal: 'workout' as const },
  { label: 'Goals', icon: Target, modal: 'goal' as const, href: '/dashboard/goals' },
  { label: 'Schedule', icon: CalendarCheck2, modal: 'schedule' as const, href: '/dashboard/plan' },
  { label: 'Stats', icon: Activity, href: '/dashboard/progress' },
];

export function OverviewScreen() {
  const { state } = useStore();
  const { openModal } = useModals();

  const week = useMemo(() => thisWeek(state), [state]);
  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);
  const hasData = state.sessions.length > 0;

  const weekGoal = state.goals.find((g) => g.cadence === 'weekly' && g.metric === 'workouts');
  const goalPct = weekGoal
    ? Math.min(100, Math.round(goalProgress(state, weekGoal).pct))
    : Math.min(100, Math.round((week.workouts / 5) * 100));
  const goalTarget = weekGoal?.target ?? 5;

  const stats = [
    { icon: Flame, label: 'Streak', value: `${streak}`, unit: 'days' },
    { icon: CalendarCheck2, label: 'Workouts', value: `${week.workouts}`, unit: 'this week' },
    { icon: Clock, label: 'Active', value: formatMinutes(week.minutes), unit: 'this week' },
    { icon: Footprints, label: 'Calories', value: formatCalories(week.calories), unit: 'burned' },
  ];

  const recent = state.sessions.slice(0, 4);
  const today = new Date().toLocaleDateString([], { weekday: 'long' });

  return (
    <div className="grid gap-5">
      {/* Greeting + headline */}
      <div>
        <p className="eyebrow text-muted-foreground">{today} · {plan.name}</p>
        <h1 className="mt-1 font-display-tight text-4xl font-extrabold sm:text-[2.75rem]">
          Let&apos;s start<br />strong!
        </h1>
      </div>

      {/* Daily goal card */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Ring pct={goalPct} size={76} stroke={8}>
            <span className="text-sm font-extrabold">{goalPct}%</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">
              You&apos;re {goalPct}% to your weekly goal
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {week.workouts}/{goalTarget} workouts logged
            </p>
          </div>
          <button
            onClick={() => openModal('workout')}
            aria-label="Log workout"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
          >
            <Plus className="h-6 w-6" strokeWidth={2.8} />
          </button>
        </div>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((q) => {
          const inner = (
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-sm text-clay transition-colors group-hover:border-primary group-hover:text-primary">
                <q.icon className="h-6 w-6" strokeWidth={2} />
              </span>
              <span className="text-[11px] font-semibold text-clay">{q.label}</span>
            </div>
          );
          return q.modal ? (
            <button key={q.label} onClick={() => openModal(q.modal)} className="group">
              {inner}
            </button>
          ) : (
            <Link key={q.label} href={q.href!} className="group">
              {inner}
            </Link>
          );
        })}
      </div>

      {/* Tip banner */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-ember to-ember-bright p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-display text-lg font-bold leading-snug">
              {focus ? `Today: ${focus}.` : 'Consistency beats intensity.'}
            </p>
            <p className="mt-1 text-sm text-primary-foreground/85">
              {hasData
                ? 'You’re building real momentum. Warm up, hit your working sets, and log it when you’re done.'
                : 'Log your first session and I’ll start tracking streaks, volume and trends for you.'}
            </p>
          </div>
        </div>
      </div>

      {/* Daily summary stat cards */}
      <div>
        <h2 className="mb-3 font-display text-xl font-extrabold tracking-tight">Daily Summary</h2>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-terracotta" />
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.unit}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent workouts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold tracking-tight">Recent activity</h2>
          <Link href="/dashboard/progress" className="text-xs font-bold text-primary hover:underline">
            See stats →
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            body="Tap the + button to log your first session. Your streak, volume and trends will start building here."
            action={
              <Button onClick={() => openModal('workout')} className="rounded-full">
                <Plus className="h-4 w-4" /> Log workout
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="grid divide-y divide-border p-2">
              {recent.map((s) => (
                <WorkoutRow key={s.id} session={s} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WorkoutRow({ session }: { session: WorkoutSession }) {
  const { state, deleteSession } = useStore();
  const category = state.categories.find((c) => c.id === session.categoryId);
  const meta = INTENSITY_META[session.intensity];

  return (
    <div className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-secondary/60">
      <Ring pct={70} size={46} stroke={5} color={category?.color ?? 'var(--primary)'}>
        <CategoryIcon name={category?.icon ?? 'activity'} size={18} />
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{session.title}</p>
        <p className="text-xs text-muted-foreground">
          {relativeDay(session.date)} · {formatMinutes(session.durationMin)} ·{' '}
          <span style={{ color: meta.color }} className="font-semibold">
            {meta.label}
          </span>
          {session.distanceKm ? ` · ${formatDistance(session.distanceKm)}` : ''} · {formatCalories(session.calories)}
        </p>
      </div>
      <button
        onClick={() => deleteSession(session.id)}
        aria-label="Delete workout"
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
