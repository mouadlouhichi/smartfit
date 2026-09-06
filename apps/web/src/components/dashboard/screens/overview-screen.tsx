'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck2,
  Clock,
  Flame,
  Footprints,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { StatCard } from '../stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CategoryIcon } from '@/components/category-icon';
import { INTENSITY_META, WEEKDAYS_LONG } from '@smartfit/core';
import {
  categoryBreakdown,
  currentStreak,
  getPlan,
  goalProgress,
  thisWeek,
  todaysFocus,
  weeklySeries,
} from '@smartfit/core';
import { formatCalories, formatDistance, formatMinutes, relativeDay } from '@smartfit/core';
import { cn } from '@/lib/utils';
import type { WorkoutSession } from '@smartfit/core';

const METRIC_OPTIONS = [
  { key: 'minutes', label: 'Minutes', color: 'var(--chart-1)' },
  { key: 'calories', label: 'Calories', color: 'var(--chart-3)' },
  { key: 'workouts', label: 'Workouts', color: 'var(--chart-2)' },
  { key: 'distance', label: 'Distance', color: 'var(--chart-4)' },
] as const;

export function OverviewScreen() {
  const { state } = useStore();
  const { openModal } = useModals();
  const [metric, setMetric] = useState<(typeof METRIC_OPTIONS)[number]['key']>('minutes');

  const week = useMemo(() => thisWeek(state), [state]);
  const series = useMemo(() => weeklySeries(state, 8), [state]);
  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);
  const weekBreakdown = useMemo(() => {
    const s = series[series.length - 1];
    return categoryBreakdown(state, state.sessions.filter((x) => x.date >= s.key)).sort(
      (a, b) => b.minutes - a.minutes,
    );
  }, [state, series]);

  const recent = state.sessions.slice(0, 5);
  const topGoals = state.goals
    .map((g) => ({ g, p: goalProgress(state, g) }))
    .sort((a, b) => a.p.pct - b.p.pct)
    .slice(0, 3);

  const todayScheduled = state.schedule
    .filter((s) => s.active && s.weekday === new Date().getDay())
    .sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));

  const activeColor = METRIC_OPTIONS.find((m) => m.key === metric)!.color;

  return (
    <div className="grid gap-5">
      {/* Today banner */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary-foreground/80">
              {WEEKDAYS_LONG[new Date().getDay()]} · {plan.name}
            </p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">{focus ?? 'Rest & recover day'}</h2>
            <p className="mt-1 text-sm text-primary-foreground/80">
              {todayScheduled.length
                ? `${todayScheduled.map((s) => `${s.timeOfDay} — ${s.title}`).join(' · ')}`
                : 'No session on the schedule today — light movement still counts.'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="lg"
            className="shrink-0 self-start rounded-full bg-white text-emerald-800 hover:bg-white/90 sm:self-center"
            onClick={() => openModal('workout')}
          >
            <Plus className="h-5 w-5" /> Log workout
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Flame} label="Streak" value={`${streak}`} sub="consecutive days" accent="#f59e0b" />
        <StatCard icon={CalendarCheck2} label="Workouts" value={week.workouts} sub="this week" accent="#16a34a" />
        <StatCard icon={Clock} label="Active time" value={formatMinutes(week.minutes)} sub="this week" accent="#0ea5e9" />
        <StatCard
          icon={Footprints}
          label="Distance"
          value={formatDistance(week.distance)}
          sub={`${formatCalories(week.calories)} burned`}
          accent="#8b5cf6"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Weekly trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Last 8 weeks
            </CardTitle>
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    metric === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={activeColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={activeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke={activeColor}
                    strokeWidth={2.5}
                    fill="url(#metricFill)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Goals
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => openModal('goal')}>
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {topGoals.length === 0 && (
              <p className="text-sm text-muted-foreground">No goals yet. Set one to stay accountable.</p>
            )}
            {topGoals.map(({ g, p }) => (
              <div key={g.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" /> {g.name}
                  </span>
                  <span className="text-muted-foreground">
                    {p.current}/{p.target}
                  </span>
                </div>
                <Progress value={p.pct} className="mt-2" indicatorClassName={p.done ? 'bg-primary' : undefined} />
              </div>
            ))}
            <Link href="/dashboard/goals" className="text-xs font-medium text-primary hover:underline">
              View all goals →
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent workouts */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent workouts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing logged yet — start your first session.</p>
            )}
            {recent.map((s) => (
              <WorkoutRow key={s.id} session={s} />
            ))}
            <Link href="/dashboard/plan" className="mt-1 text-xs font-medium text-primary hover:underline">
              See full training log →
            </Link>
          </CardContent>
        </Card>

        {/* Weekly split */}
        <Card>
          <CardHeader>
            <CardTitle>This week's mix</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {weekBreakdown.length === 0 && <p className="text-sm text-muted-foreground">No training yet this week.</p>}
            {weekBreakdown.map(({ category, minutes }) => {
              const total = weekBreakdown.reduce((a, x) => a + x.minutes, 0) || 1;
              return (
                <div key={category.id} className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${category.color}1a`, color: category.color }}
                  >
                    <CategoryIcon name={category.icon} size={16} />
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{category.name}</span>
                      <span className="text-muted-foreground">{formatMinutes(minutes)}</span>
                    </div>
                    <Progress value={(minutes / total) * 100} className="mt-1.5 h-1.5" indicatorClassName="" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WorkoutRow({ session }: { session: WorkoutSession }) {
  const { state, deleteSession } = useStore();
  const category = state.categories.find((c) => c.id === session.categoryId);
  const meta = INTENSITY_META[session.intensity];

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-secondary/50">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${category?.color}1a`, color: category?.color }}
      >
        <CategoryIcon name={category?.icon ?? 'activity'} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{session.title}</p>
        <p className="text-xs text-muted-foreground">
          {relativeDay(session.date)} · {formatMinutes(session.durationMin)} ·{' '}
          <span style={{ color: meta.color }}>{meta.label}</span>
          {session.distanceKm ? ` · ${formatDistance(session.distanceKm)}` : ''} · {formatCalories(session.calories)}
        </p>
      </div>
      <Badge variant="secondary" className="hidden sm:inline-flex">
        {category?.name}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => deleteSession(session.id)}
        aria-label="Delete workout"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
