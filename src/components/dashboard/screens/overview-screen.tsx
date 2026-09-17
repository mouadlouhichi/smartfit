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
  Timer,
  ArrowUpRight,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { CoachPanel } from '../coach-panel';
import { EmptyState } from '../empty-state';
import { TodaysWorkoutCard } from '../todays-workout-card';
import { CategoryIcon } from '@/components/category-icon';
import { ActivityRingsGraphic, ActivityRingsLegend } from '../activity-rings';
import { ReadinessCard } from '../readiness-card';
import { BodySelectHero } from '../body-select-hero';
import { Footprints, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricCard, MiniBars, GradeRing } from '@/components/volt/volt-kit';
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
  activityRings,
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
  const [programFilter, setProgramFilter] = useState('All type');

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

  // Today's closing rings (Apple-style) from the athlete's own goals.
  const rings = useMemo(() => activityRings(state, targetsForDays(state, 1)), [state]);

  // Per-day distance for the metric tile's mini bars (last 7 days).
  const dayDistances = useMemo(() => {
    const out: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const iso = toISODate(d);
      out.push(aggregate(sessionsInRange(state, iso, iso)).distance);
    }
    return out;
  }, [state]);

  // Today's next un-done scheduled slot. If the plan is already complete,
  // start a fresh session instead of showing a completed slot as if it were
  // still waiting to be logged.
  const nextSlot = useMemo(() => {
    const a = todaysAgenda(state);
    return a.find((x) => !x.done);
  }, [state]);
  const startToday = () =>
    nextSlot
      ? openWith({
          kind: 'runner',
          title: nextSlot.slot.title,
          categoryId: nextSlot.slot.categoryId,
          intensity: nextSlot.slot.intensity,
          scheduleId: nextSlot.slot.id,
          exercises: nextSlot.slot.exercises,
        })
      : openWith({
          kind: 'runner',
          title: focus ?? 'Today’s workout',
          categoryId: 'cat-strength',
          intensity: 'moderate',
        });

  const quickActions = [
    { label: 'Log workout', icon: Dumbbell, onClick: () => openModal('workout') },
    { label: 'Run', icon: Footprints, href: '/dashboard/run' },
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

  const agendaFiltered = useMemo(
    () =>
      programFilter === 'All type'
        ? agenda
        : agenda.filter((a) => categoryById(state, a.slot.categoryId)?.name === programFilter),
    [agenda, programFilter, state],
  );

  const hasData = state.sessions.length > 0;
  const recent = useMemo(() => state.sessions.slice(0, 4), [state.sessions]);
  const firstName = state.profile.name?.trim().split(' ')[0];

  return (
    <div className="grid max-w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <h1 className="sr-only">Overview</h1>

      {/* ── Body-select training hero ────────────────────────────────────
          The app's primary training action: pick a muscle, train it. Sits
          first so "train by body part" is the headline flow, not a tab. */}
      <BodySelectHero />
      {/* ── Center / left column ───────────────────────────────
          Separate surfaces: the white card covers only the greeting and
          weekly progress; start workout, today rings, plan, and summary
          live outside it as their own sections. */}
      <div className="grid max-w-full min-w-0 content-start gap-6">
        {/* ── Streak card — the reference "Running 7 days" tile ────────── */}
        <div className="bg-card border-border flex items-center gap-4 rounded-3xl border p-4 sm:p-5">
          <span className="bg-volt text-ink grid h-14 w-14 shrink-0 place-items-center rounded-2xl">
            <Footprints className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg leading-tight font-extrabold tracking-tight sm:text-xl">
              Training {streak} day{streak === 1 ? '' : 's'}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs sm:text-sm">
              {week.workouts} session{week.workouts === 1 ? '' : 's'} · {week.distance.toFixed(1)}{' '}
              {distanceUnit} · {formatMinutes(week.minutes)}
            </p>
          </div>
          <button
            type="button"
            onClick={startToday}
            aria-label={nextSlot ? `Start ${nextSlot.slot.title}` : 'Start another workout'}
            className="bg-volt text-ink press grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-[0_6px_18px_-8px_rgba(138,210,0,0.7)] transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            <ArrowUpRight className="h-5 w-5" strokeWidth={2.75} />
          </button>
        </div>

        {/* ── Health metrics — the reference 2×2 tile grid ─────────────── */}
        <section aria-label="Health metrics" className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold tracking-tight sm:text-lg">Health Metrics</h2>
            <Link
              href="/dashboard/progress"
              className="text-primary text-sm font-bold transition-colors hover:underline"
            >
              See All
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MetricCard
              icon={Timer}
              label="Active minutes"
              value={rangeAgg.minutes}
              unit="min"
              chart={<MiniBars values={series.slice(-7).map((x) => x.minutes)} />}
            />
            <MetricCard
              icon={Dumbbell}
              label="Sessions"
              value={rangeAgg.workouts}
              unit="workouts"
              chart={<MiniBars values={series.slice(-7).map((x) => x.workouts)} />}
            />
            <MetricCard
              icon={Footprints}
              label="Distance"
              value={week.distance.toFixed(1)}
              unit={distanceUnit}
              chart={<MiniBars values={dayDistances} />}
            />
            <MetricCard
              icon={Target}
              label="Weekly goal"
              value={`${goalPct}%`}
              unit="of target"
              chart={<GradeRing value={goalPct} size={44} stroke={6} label="Weekly goal" />}
            />
          </div>
        </section>

        {/* ── Workout programs: chips + the featured session card ──────── */}
        <section aria-label="Workout programs" className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold tracking-tight sm:text-lg">Workout Programs</h2>
            <Link
              href="/dashboard/plan"
              className="text-primary text-sm font-bold transition-colors hover:underline"
            >
              See All
            </Link>
          </div>
          {/* Icon-forward category tiles — the Axel program-library pattern.
              A snap rail on phones, a wrap grid from sm up. */}
          <div
            className="no-scrollbar -mx-1 mt-3 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible lg:grid-cols-7"
            role="tablist"
            aria-label="Program category"
          >
            {[
              {
                name: 'All type',
                icon: 'layout-grid',
                color: 'var(--primary)',
                count: state.sessions.length,
              },
              ...state.categories.map((c) => ({
                name: c.name,
                icon: c.icon,
                color: c.color,
                count: state.sessions.filter((s) => s.categoryId === c.id).length,
              })),
            ].map((c) => {
              const selected = programFilter === c.name;
              return (
                <button
                  key={c.name}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setProgramFilter(c.name)}
                  className={cn(
                    'group flex min-w-[5.5rem] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border px-3 py-3.5 text-center transition-all sm:min-w-0',
                    selected
                      ? 'border-volt/60 bg-charcoal shadow-[0_0_0_1px_var(--primary)]'
                      : 'border-border bg-card hover:border-volt/40 hover:bg-secondary/40',
                  )}
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl"
                    style={{ backgroundColor: `${c.color}1f`, color: c.color }}
                  >
                    <CategoryIcon name={c.icon} size={19} />
                  </span>
                  <span className="w-full truncate text-xs font-bold">{c.name}</span>
                  <span className="text-muted-foreground text-[10px] font-semibold tabular-nums">
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Today's workout — the reference workout-day sheet ── */}
          <TodaysWorkoutCard />
          {/* Today's plan — filtered by the chips above */}
          {agendaFiltered.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {agendaFiltered.map(({ slot, done }) => {
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
                          : 'border-border bg-card hover:border-volt/40',
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
          )}
        </section>

        {/* ── Today's closing rings ─────────────────────────────────────
            Dark volt hero: gradients + halo need the dark stage, and the
            legend reads in hero tones. Stacked on phones, side by side
            once there is room. */}
        <div className="card-hero p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-lg font-extrabold tracking-tight">Today</p>
              <p className="hero-muted text-xs">
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            {rings.closed && (
              <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--chart-3)' }} aria-hidden />
                All rings closed
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-col items-center gap-5 min-[480px]:flex-row min-[480px]:gap-6">
            <div className="shrink-0">
              <ActivityRingsGraphic rings={rings} size={168}>
                <p className="font-display text-2xl font-extrabold tabular-nums">
                  {rings.calories.target > 0
                    ? Math.round(rings.calories.value)
                    : rings.minutes.value}
                </p>
                <p className="hero-muted text-[10px] font-bold tracking-widest uppercase">
                  {rings.calories.target > 0 ? 'kcal' : 'min'}
                </p>
              </ActivityRingsGraphic>
            </div>
            <div className="w-full min-w-0 flex-1">
              <ActivityRingsLegend rings={rings} tone="onDark" />
            </div>
          </div>
        </div>

        {/* Readiness — the Pro shop window sits right under the rings. */}
        <ReadinessCard />

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-6 sm:gap-3">
          {quickActions.map((a) => {
            const inner = (
              <div className="group flex flex-col items-center gap-2 sm:gap-2.5">
                <span className="bg-secondary text-foreground group-hover:bg-volt group-hover:text-ink mx-auto flex aspect-square w-full max-w-14 items-center justify-center rounded-full shadow-sm transition-colors sm:aspect-auto sm:h-16 sm:w-16 sm:max-w-none">
                  <a.icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
                </span>
                <span className="text-muted-foreground text-center text-[10px] leading-tight font-semibold sm:text-xs">
                  {a.label}
                </span>
              </div>
            );
            return a.href ? (
              <Link key={a.label} href={a.href} className="group min-w-0">
                {inner}
              </Link>
            ) : (
              <button key={a.label} onClick={a.onClick} className="group min-w-0">
                {inner}
              </button>
            );
          })}
        </div>

        {/* Summary — its own section, separated from the plan items above. */}
        <section aria-label="Summary" className="min-w-0">
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
        </section>
      </div>

      {/* ── Coach ──────────────────────────────────────────────
          Mobile first: the coach is part of the feed on phones (a shorter,
          scroll-along panel) and becomes the sticky right column from lg up.
          Sticky needs self-start to have travel inside the grid area; the
          height overrides CoachPanel's h-full via tailwind-merge. */}
      <div className="min-w-0 lg:sticky lg:top-5 lg:self-start">
        <CoachPanel className="h-[70dvh] min-h-[420px] sm:h-[75dvh] lg:h-[min(760px,calc(100dvh-2.5rem))]" />
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
            'rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all min-[420px]:px-5 min-[420px]:py-2 min-[420px]:text-sm',
            value === r ? 'bg-volt text-ink shadow-sm' : 'text-muted-foreground',
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
        stroke="#2b2b2b"
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
