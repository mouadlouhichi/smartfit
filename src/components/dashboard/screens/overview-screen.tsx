'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Zap,
  Dumbbell,
  Target,
  CalendarCheck,
  BarChart3,
  Sparkles,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { CoachPanel } from '../coach-panel';
import { EmptyState } from '../empty-state';
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';
import {
  currentStreak,
  getPlan,
  goalProgress,
  thisWeek,
  todaysAgenda,
  todaysFocus,
  weeklySeries,
  sessionsInRange,
  aggregate,
  categoryById,
  targetsForDays,
  toISODate,
  formatDistance,
  formatMinutes,
  relativeDay,
} from '@smartfit/core';

type Range = 'Daily' | 'Weekly' | 'Monthly';
const RANGE_DAYS: Record<Range, number> = { Daily: 1, Weekly: 7, Monthly: 30 };

export function OverviewScreen() {
  const { state } = useStore();
  const { openModal, openWith } = useModals();
  const [range, setRange] = useState<Range>('Weekly');

  const week = useMemo(() => thisWeek(state), [state]);
  const series = useMemo(() => weeklySeries(state, 8), [state]);
  const streak = currentStreak(state);
  const plan = getPlan(state.profile.planId);
  const focus = todaysFocus(state);
  const agenda = useMemo(() => todaysAgenda(state), [state]);
  const distanceUnit = state.profile.distanceUnit;

  const days = RANGE_DAYS[range];

  // Summary aggregate for the selected range.
  const rangeAgg = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    return aggregate(sessionsInRange(state, toISODate(from), toISODate(new Date())));
  }, [state, days]);

  // Targets come from the user's goals (falling back to their plan), never
  // from hardcoded numbers.
  const targets = useMemo(() => targetsForDays(state, days), [state, days]);

  const weekGoal = state.goals.find((g) => g.cadence === 'weekly' && g.metric === 'workouts');
  const weeklyTarget = useMemo(() => targetsForDays(state, 7).workouts, [state]);
  const goalPct = weekGoal
    ? Math.round(goalProgress(state, weekGoal).pct)
    : Math.min(100, Math.round((week.workouts / Math.max(1, weeklyTarget)) * 100));

  const minPct = Math.min(100, Math.round((rangeAgg.minutes / Math.max(1, targets.minutes)) * 100));
  const sessPct = Math.min(
    100,
    Math.round((rangeAgg.workouts / Math.max(1, targets.workouts)) * 100),
  );

  const quickActions = [
    { label: 'Workout', icon: Dumbbell, onClick: () => openModal('workout') },
    { label: 'Goals', icon: Target, href: '/dashboard/goals' },
    { label: 'Plan', icon: CalendarCheck, href: '/dashboard/plan' },
    { label: 'Stats', icon: BarChart3, href: '/dashboard/progress' },
    { label: 'Coach', icon: Sparkles, href: '/dashboard/coach' },
  ];

  // The PWA manifest exposes a "Log a workout" shortcut to /dashboard?log=1.
  // Read it from location rather than useSearchParams so this page can stay
  // statically prerendered without a Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('log')) return;
    openModal('workout');
    params.delete('log');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [openModal]);

  const hasData = state.sessions.length > 0;
  const recent = useMemo(() => state.sessions.slice(0, 4), [state.sessions]);
  const firstName = state.profile.name?.trim().split(' ')[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      {/* ── Center / left column ─────────────────────────────── */}
      <div className="bg-card rounded-[2rem] p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-display text-[2rem] leading-[1.05] font-extrabold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {firstName ? `Let's go,` : `Let's start`}
            <br />
            {firstName ? `${firstName}!` : 'strong!'}
          </h1>
          <p className="eyebrow text-muted-foreground hidden sm:block">{plan.name}</p>
        </div>

        {/* Weekly goal card */}
        <div className="bg-secondary/70 mt-8 rounded-3xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="max-w-[16rem] text-base leading-snug font-bold sm:text-[17px]">
                You&apos;re {goalPct}% to your weekly goal
              </p>
              <p className="text-muted-foreground mt-1 text-sm">{focus ?? 'Rest & recover day'}</p>
            </div>
            <button
              onClick={() => openModal('workout')}
              aria-label="Log workout"
              className="bg-primary relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-90"
              style={{
                boxShadow: '0 0 0 6px rgba(224,94,54,0.18), 0 10px 24px -6px rgba(224,94,54,0.65)',
              }}
            >
              <Zap className="h-6 w-6" strokeWidth={2.6} fill="currentColor" />
            </button>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div
              className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/80"
              role="progressbar"
              aria-valuenow={goalPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Weekly goal progress"
            >
              <div
                className="bg-foreground h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(4, goalPct)}%` }}
              />
            </div>
            <span className="text-muted-foreground shrink-0 text-sm font-semibold">
              {week.workouts.toLocaleString()}/{weeklyTarget.toLocaleString()} workouts
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-7 grid grid-cols-5 gap-2 sm:gap-3">
          {quickActions.map((a) => {
            const inner = (
              <div className="group flex flex-col items-center gap-2.5">
                <span className="bg-secondary text-clay group-hover:bg-primary flex h-14 w-14 items-center justify-center rounded-full shadow-sm transition-colors group-hover:text-white sm:h-16 sm:w-16">
                  <a.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="text-clay text-[11px] font-semibold sm:text-xs">{a.label}</span>
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

        {/* Today's plan — the bridge between the schedule and the log. */}
        {agenda.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-xl font-extrabold tracking-tight sm:text-[1.35rem]">
              On today&apos;s plan
            </h2>
            <ul className="mt-4 grid gap-2">
              {agenda.map(({ slot, done }) => {
                const cat = categoryById(state, slot.categoryId);
                return (
                  <li key={slot.id}>
                    <button
                      onClick={() =>
                        done
                          ? openWith({ kind: 'session-detail', session: done })
                          : openWith({
                              kind: 'workout',
                              prefill: {
                                title: slot.title,
                                categoryId: slot.categoryId,
                                durationMin: slot.durationMin,
                                intensity: slot.intensity,
                                scheduleId: slot.id,
                              },
                            })
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                        done
                          ? 'bg-secondary/60 border-transparent'
                          : 'border-border bg-card hover:border-primary/50',
                      )}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${cat.color}1f`, color: cat.color }}
                      >
                        <CategoryIcon name={cat.icon} size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-sm font-semibold',
                            done && 'text-muted-foreground line-through',
                          )}
                        >
                          {slot.title}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {slot.timeOfDay} · {formatMinutes(slot.durationMin)}
                        </span>
                      </span>
                      {done ? (
                        <span className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold">
                          <Check className="h-3 w-3" /> Done
                        </span>
                      ) : (
                        <span className="text-primary text-[11px] font-bold">Log it</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Summary */}
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-xl font-extrabold tracking-tight sm:text-[1.35rem]">
              Summary
            </h2>
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
            <>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {/* Arc ring card */}
                <div className="bg-secondary/70 relative overflow-hidden rounded-3xl p-5">
                  <SummaryArc activePct={minPct} sessPct={sessPct} />
                  <div className="bg-card relative ml-auto w-[78%] rounded-3xl p-4 shadow-sm">
                    <StatDot
                      color="var(--primary)"
                      label="Active"
                      value={`${rangeAgg.minutes}/${targets.minutes}min`}
                    />
                    <div className="bg-border my-3 h-px" />
                    <StatDot
                      color="var(--foreground)"
                      label="Sessions"
                      value={`${rangeAgg.workouts}/${targets.workouts}`}
                    />
                  </div>
                </div>

                {/* Bar chart card */}
                <div className="bg-card ring-border flex flex-col rounded-3xl p-5 shadow-sm ring-1">
                  <p className="text-muted-foreground text-xs">Sessions</p>
                  <p className="font-display text-2xl font-extrabold tracking-tight">
                    {rangeAgg.workouts}
                  </p>
                  <div className="mt-auto flex h-24 items-end justify-between gap-1 pt-4">
                    {series.slice(-8).map((s, i) => {
                      const max = Math.max(1, ...series.map((x) => x.minutes));
                      const h = Math.max(6, Math.round((s.minutes / max) * 100));
                      const hot = s.minutes >= max * 0.6;
                      return (
                        <div
                          key={i}
                          className={cn(
                            'w-full rounded-full',
                            hot ? 'bg-foreground' : 'bg-secondary',
                          )}
                          style={{ height: `${h}%` }}
                          title={`${s.label}: ${formatMinutes(s.minutes)}`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Dark distance card */}
                <div className="bg-charcoal flex flex-col rounded-3xl p-5 text-white shadow-sm">
                  <RouteGraphic />
                  <p className="mt-auto text-xs text-white/70">Distance</p>
                  <p className="font-display text-2xl font-extrabold tracking-tight">
                    {formatDistance(rangeAgg.distance, distanceUnit)}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {streak}-day streak
                    {!targets.fromGoals && ' · set goals to tune these targets'}
                  </p>
                </div>
              </div>

              {/* Recent activity — tapping a row opens the full session. */}
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-extrabold tracking-tight">
                    Recent activity
                  </h3>
                  <Link
                    href="/dashboard/plan"
                    className="text-primary flex items-center gap-0.5 text-xs font-semibold hover:underline"
                  >
                    See all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <ul className="mt-3 grid gap-2">
                  {recent.map((s) => {
                    const cat = categoryById(state, s.categoryId);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => openWith({ kind: 'session-detail', session: s })}
                          className="hover:bg-secondary/70 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${cat.color}1f`, color: cat.color }}
                          >
                            <CategoryIcon name={cat.icon} size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{s.title}</span>
                            <span className="text-muted-foreground block text-xs">
                              {relativeDay(s.date)} · {formatMinutes(s.durationMin)}
                            </span>
                          </span>
                          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right column: coach (desktop) ────────────────────── */}
      <div className="hidden lg:block">
        <CoachPanel />
      </div>
    </div>
  );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const ranges: Range[] = ['Daily', 'Weekly', 'Monthly'];
  return (
    <div className="bg-secondary flex rounded-full p-1" role="tablist" aria-label="Summary range">
      {ranges.map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={value === r}
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
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tracking-tight">{value}</p>
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
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.06)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#2b2725"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${activeLen} ${c}`}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${sessLen} ${c}`}
      />
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
