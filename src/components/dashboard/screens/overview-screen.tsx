'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Dumbbell,
  Target,
  CalendarCheck,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { CoachPanel } from '../coach-panel';
import { EmptyState } from '../empty-state';
import { cn } from '@/lib/utils';
import {
  currentStreak,
  getPlan,
  goalProgress,
  thisWeek,
  todaysFocus,
  weeklySeries,
  sessionsInRange,
  aggregate,
  toISODate,
  formatDistance,
  formatMinutes,
} from '@smartfit/core';

type Range = 'Daily' | 'Weekly' | 'Monthly';

export function OverviewScreen() {
  const { state } = useStore();
  const { openModal } = useModals();
  const [range, setRange] = useState<Range>('Weekly');

  const week = useMemo(() => thisWeek(state), [state]);
  const series = useMemo(() => weeklySeries(state, 8), [state]);
  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);

  // Summary aggregate for the selected range.
  const rangeAgg = useMemo(() => {
    const days = range === 'Daily' ? 1 : range === 'Weekly' ? 7 : 30;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    return aggregate(sessionsInRange(state, toISODate(from), toISODate(new Date())));
  }, [state, range]);

  // Weekly goal progress (workouts), falls back to 5/week.
  const weekGoal = state.goals.find((g) => g.cadence === 'weekly' && g.metric === 'workouts');
  const goalTarget = weekGoal?.target ?? 5;
  const goalPct = weekGoal
    ? Math.min(100, Math.round(goalProgress(state, weekGoal).pct))
    : Math.min(100, Math.round((week.workouts / goalTarget) * 100));

  const minTarget = range === 'Daily' ? 60 : range === 'Weekly' ? 300 : 1200;
  const minPct = Math.min(100, Math.round((rangeAgg.minutes / minTarget) * 100));
  const sessTarget = range === 'Daily' ? 1 : range === 'Weekly' ? goalTarget : 20;
  const sessPct = Math.min(100, Math.round((rangeAgg.workouts / sessTarget) * 100));

  const quickActions = [
    { label: 'Workout', icon: Dumbbell, onClick: () => openModal('workout') },
    { label: 'Goals', icon: Target, href: '/dashboard/goals' },
    { label: 'Plan', icon: CalendarCheck, href: '/dashboard/plan' },
    { label: 'Stats', icon: BarChart3, href: '/dashboard/progress' },
    { label: 'Coach', icon: Sparkles, href: '/dashboard/coach' },
  ];

  const hasData = state.sessions.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      {/* ── Center / left column ─────────────────────────────── */}
      <div className="rounded-[2rem] bg-card p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
            Let&apos;s start
            <br />
            strong!
          </h1>
          <p className="eyebrow hidden text-muted-foreground sm:block">{plan.name}</p>
        </div>

        {/* Daily / weekly goal card */}
        <div className="mt-8 rounded-3xl bg-secondary/70 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="max-w-[16rem] text-lg font-bold leading-snug sm:text-xl">
                You&apos;re {goalPct}% to your weekly goal
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{focus ?? 'Rest & recover day'}</p>
            </div>
            <button
              onClick={() => openModal('workout')}
              aria-label="Log workout"
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform active:scale-90"
              style={{ boxShadow: '0 0 0 6px rgba(224,94,54,0.18), 0 10px 24px -6px rgba(224,94,54,0.65)' }}
            >
              <Zap className="h-6 w-6" strokeWidth={2.6} fill="currentColor" />
            </button>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/80">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-700"
                style={{ width: `${Math.max(4, goalPct)}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">
              {week.workouts.toLocaleString()}/{goalTarget.toLocaleString()} workouts
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-7 grid grid-cols-5 gap-2 sm:gap-3">
          {quickActions.map((a) => {
            const inner = (
              <div className="group flex flex-col items-center gap-2.5">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-clay shadow-sm transition-colors group-hover:bg-primary group-hover:text-white sm:h-16 sm:w-16">
                  <a.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="text-[11px] font-semibold text-clay sm:text-xs">{a.label}</span>
              </div>
            );
            return a.href ? (
              <Link key={a.label} href={a.href} className="group">
                {inner}
              </Link>
            ) : (
              <button key={a.label} onClick={a.onClick} className="group">
                {inner}
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Summary</h2>
            <RangeToggle value={range} onChange={setRange} />
          </div>

          {!hasData ? (
            <EmptyState
              className="mt-5"
              icon={Dumbbell}
              title="No workouts yet"
              body="Tap the bolt to log your first session. Your streak, volume and distance will appear here."
            />
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {/* Arc ring card */}
              <div className="relative overflow-hidden rounded-3xl bg-secondary/70 p-5">
                <SummaryArc activePct={minPct} sessPct={sessPct} />
                <div className="relative ml-auto w-[78%] rounded-3xl bg-card p-4 shadow-sm">
                  <StatDot color="var(--primary)" label="Active" value={`${rangeAgg.minutes}/${minTarget}min`} />
                  <div className="my-3 h-px bg-border" />
                  <StatDot color="var(--foreground)" label="Sessions" value={`${rangeAgg.workouts}/${sessTarget}`} />
                </div>
              </div>

              {/* Bar chart card */}
              <div className="flex flex-col rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border">
                <p className="text-sm text-muted-foreground">Sessions</p>
                <p className="font-display text-3xl font-extrabold tracking-tight">{rangeAgg.workouts}</p>
                <div className="mt-auto flex h-24 items-end justify-between gap-1 pt-4">
                  {series.slice(-8).map((s, i) => {
                    const max = Math.max(1, ...series.map((x) => x.minutes));
                    const h = Math.max(6, Math.round((s.minutes / max) * 100));
                    const hot = s.minutes >= max * 0.6;
                    return (
                      <div
                        key={i}
                        className={cn('w-full rounded-full', hot ? 'bg-foreground' : 'bg-secondary')}
                        style={{ height: `${h}%` }}
                        title={`${s.label}: ${formatMinutes(s.minutes)}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Dark distance card */}
              <div className="flex flex-col rounded-3xl bg-charcoal p-5 text-white shadow-sm">
                <RouteGraphic />
                <p className="mt-auto text-sm text-white/70">Distance</p>
                <p className="font-display text-3xl font-extrabold tracking-tight">{formatDistance(rangeAgg.distance)}</p>
                <p className="mt-1 text-xs text-white/50">{streak}-day streak</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right column: AI Chatbot (desktop) ───────────────── */}
      <div className="hidden lg:block">
        <CoachPanel />
      </div>
    </div>
  );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const ranges: Range[] = ['Daily', 'Weekly', 'Monthly'];
  return (
    <div className="flex rounded-full bg-secondary p-1">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'rounded-full px-5 py-2 text-sm font-semibold transition-all',
            value === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function StatDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

function SummaryArc({ activePct, sessPct }: { activePct: number; sessPct: number }) {
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Partial donut (~270°), two progress segments over a gray track.
  const frac = 0.75;
  const activeLen = (Math.min(100, activePct) / 100) * c * frac;
  const sessLen = (Math.min(100, sessPct) / 100) * c * frac;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="absolute -bottom-6 -left-8 h-44 w-44 -rotate-[135deg]"
      aria-hidden
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2b2725" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${activeLen} ${c}`} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${sessLen} ${c}`} />
    </svg>
  );
}

function RouteGraphic() {
  return (
    <svg viewBox="0 0 120 80" className="h-16 w-full" aria-hidden>
      <path
        d="M8 60 C 30 10, 50 70, 70 30 S 105 20, 112 50"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="60" r="4" fill="#fff" fillOpacity="0.5" />
      <circle cx="112" cy="50" r="4" fill="var(--primary)" />
    </svg>
  );
}
