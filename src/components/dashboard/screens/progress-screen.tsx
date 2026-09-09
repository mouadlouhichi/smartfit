'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Dumbbell as DumbbellIcon,
  Flame,
  Footprints,
  Lock,
  Medal,
  Timer,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ring } from '../ring';
import { EmptyState } from '../empty-state';
import { ConsistencyHeatmap } from '../consistency-heatmap';
import { AchievementWall } from '../achievement-wall';
import { cn } from '@/lib/utils';
import { INTENSITY_META } from '@smartfit/core';
import {
  sessionsInRange,
  toISODate,
  categoryBreakdown,
  aggregate,
  weeklySeries,
  targetsForDays,
  currentStreak,
  hasProAccess,
  consistencyHeatmap,
  heatmapActiveDays,
  personalRecords,
  computeAchievements,
  muscleVolume,
  FREE_RECORDS,
  FREE_ACHIEVEMENTS,
} from '@smartfit/core';
import { useModals } from '../modal-context';
import {
  formatCalories,
  formatDistance,
  formatMinutes,
  formatWeight,
  formatVolume,
  relativeDay,
} from '@smartfit/core';

type Range = 'daily' | 'weekly' | 'monthly' | 'quarter' | 'year';
const RANGES: { key: Range; label: string; short: string; days: number; pro?: boolean }[] = [
  { key: 'daily', label: 'Daily', short: 'Day', days: 1 },
  { key: 'weekly', label: 'Weekly', short: 'Week', days: 7 },
  { key: 'monthly', label: 'Monthly', short: 'Month', days: 30 },
  { key: 'quarter', label: 'Quarter', short: 'Qtr', days: 90, pro: true },
  { key: 'year', label: 'Year', short: 'Year', days: 364, pro: true },
];

/** Sessions in the `days`-long window ending today. */
function rangeDaysSessions(state: ReturnType<typeof useStore>['state'], days: number, offset = 0) {
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() - offset);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return sessionsInRange(state, toISODate(from), toISODate(to));
}

export function ProgressScreen() {
  const { state } = useStore();
  const { openWith } = useModals();
  const pro = hasProAccess(state);
  const [range, setRange] = useState<Range>('weekly');
  const days = RANGES.find((r) => r.key === range)!.days;

  const rangeAgg = useMemo(() => aggregate(rangeDaysSessions(state, days)), [state, days]);
  // The equally-sized window immediately before — for honest "vs previous"
  // deltas on the stat tiles (hidden when the previous window was empty).
  const prevAgg = useMemo(() => aggregate(rangeDaysSessions(state, days, days)), [state, days]);

  const breakdown = useMemo(
    () => categoryBreakdown(state, rangeDaysSessions(state, days)),
    [state, days],
  );
  const totalMin = breakdown.reduce((a, x) => a + x.minutes, 0);

  const series = useMemo(() => weeklySeries(state, 8), [state]);
  const seriesMinutes = series.reduce((a, w) => a + w.minutes, 0);
  const intensityData = useMemo(() => {
    const order: (keyof typeof INTENSITY_META)[] = ['low', 'moderate', 'high'];
    return order
      .map((k) => ({
        key: k,
        name: INTENSITY_META[k].label,
        value: rangeDaysSessions(state, days).filter((s) => s.intensity === k).length,
        color: INTENSITY_META[k].color,
      }))
      .filter((x) => x.value > 0);
  }, [state, days]);

  const streak = useMemo(() => currentStreak(state), [state]);

  // New engine surfaces: consistency grid, records, achievements, muscle mix.
  const heatmap = useMemo(() => consistencyHeatmap(state, 18), [state]);
  const heatDays = useMemo(() => heatmapActiveDays(heatmap), [heatmap]);
  const records = useMemo(() => personalRecords(state), [state]);
  const achievements = useMemo(() => computeAchievements(state), [state]);
  const muscles = useMemo(() => muscleVolume(state, days), [state, days]);

  // Targets come from the user's goals (falling back to their plan) — the same
  // source the overview uses. Calories and distance rings only fill when the
  // user actually set a goal for them (targetsForDays returns 0 otherwise),
  // rather than against numbers invented here.
  const targets = useMemo(() => targetsForDays(state, days), [state, days]);
  const distanceUnit = state.profile.distanceUnit;
  const minPct = Math.min(100, Math.round((rangeAgg.minutes / Math.max(1, targets.minutes)) * 100));
  const calPct =
    targets.calories > 0
      ? Math.min(100, Math.round((rangeAgg.calories / targets.calories) * 100))
      : 0;
  const distPct =
    targets.distanceKm > 0
      ? Math.min(100, Math.round(((rangeAgg.distance ?? 0) / targets.distanceKm) * 100))
      : 0;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display-tight text-xl font-extrabold tracking-tight sm:text-2xl">
            Your Stats
          </h1>
          <p className="text-muted-foreground text-sm">
            {state.sessions.length} session{state.sessions.length === 1 ? '' : 's'} logged all-time
            {streak > 0 ? ` · ${streak}-day streak` : ''}
          </p>
        </div>

        {/* Segmented control — five full labels never fit a phone, so
            narrow screens get compact short labels (Day/Week/Month/Qtr/Year)
            with a hidden-scrollbar swipe row as the backstop. */}
        <div
          className="bg-secondary no-scrollbar flex w-full max-w-sm overflow-x-auto rounded-full p-1 sm:w-auto sm:flex-none sm:overflow-visible"
          role="tablist"
          aria-label="Stats range"
        >
          {RANGES.map((r) => {
            const locked = !!r.pro && !pro;
            return (
              <button
                key={r.key}
                role="tab"
                aria-selected={range === r.key}
                onClick={() => (locked ? openWith({ kind: 'pro' }) : setRange(r.key))}
                className={cn(
                  'flex flex-1 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-2 text-xs font-bold whitespace-nowrap transition-all sm:flex-none sm:px-4 sm:text-sm',
                  range === r.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {locked && <Lock className="h-3 w-3 shrink-0" aria-hidden />}
                <span className="sm:hidden">{r.short}</span>
                <span className="hidden sm:inline">{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Hero: goal rings on warm charcoal with an ember glow ─────────── */}
      <section className="card-hero p-4 min-[420px]:p-6 sm:p-8" aria-label="Goal rings">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
          <p className="eyebrow hero-muted">
            Last {days} day{days === 1 ? '' : 's'}
          </p>
          {streak > 0 && (
            <span className="hero-tile inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
              <Flame className="h-3.5 w-3.5 text-[#f0a37f]" aria-hidden />
              {streak}-day streak
            </span>
          )}
        </div>
        {/* Three rings plus their value captions must share ~240px on a
            320px phone — compact dials and one-line captions keep them in. */}
        <div className="flex items-start justify-between gap-1 sm:gap-2">
          <RingStat
            pct={minPct}
            label="Exercise"
            value={`${rangeAgg.minutes}/${targets.minutes}min`}
            icon={Timer}
            color="#f0a37f"
          />
          <RingStat
            pct={calPct}
            label="Burned"
            value={formatCalories(rangeAgg.calories)}
            icon={Flame}
            color="#ee7d5a"
            big
          />
          <RingStat
            pct={distPct}
            label="Distance"
            value={formatDistance(rangeAgg.distance ?? 0, distanceUnit)}
            icon={Footprints}
            color="#cdaca4"
          />
        </div>
        {targets.calories === 0 && targets.distanceKm === 0 && (
          <p className="hero-muted mt-5 text-center text-xs">
            Burn and distance rings fill once you set a calories or distance goal.
          </p>
        )}
      </section>

      {/* ── Stat tiles with deltas vs the previous window ────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={CalendarDays}
          tile="bg-primary/10 text-primary"
          label="Sessions"
          value={`${rangeAgg.workouts}`}
          sub={`last ${days} day${days === 1 ? '' : 's'}`}
          current={rangeAgg.workouts}
          previous={prevAgg.workouts}
        />
        <StatCard
          icon={Timer}
          tile="bg-chart-2/10 text-chart-2"
          label="Active time"
          value={formatMinutes(rangeAgg.minutes)}
          sub={`last ${days} day${days === 1 ? '' : 's'}`}
          current={rangeAgg.minutes}
          previous={prevAgg.minutes}
        />
        <StatCard
          icon={Flame}
          tile="bg-chart-4/10 text-chart-4"
          label="Calories"
          value={formatCalories(rangeAgg.calories)}
          sub="burned"
          current={rangeAgg.calories}
          previous={prevAgg.calories}
        />
        <StatCard
          icon={Footprints}
          tile="bg-clay/10 text-clay"
          label="Distance"
          value={formatDistance(rangeAgg.distance ?? 0, distanceUnit)}
          sub="covered"
          current={rangeAgg.distance ?? 0}
          previous={prevAgg.distance ?? 0}
        />
      </div>

      {/* ── Weekly volume ────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display flex items-center gap-2 text-sm font-bold">
            <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-xl">
              <TrendingUp className="h-4 w-4" aria-hidden />
            </span>
            Active minutes · last 8 weeks
          </p>
          {seriesMinutes > 0 && (
            <span className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-bold tabular-nums">
              {formatMinutes(seriesMinutes)} total
            </span>
          )}
        </div>
        {state.sessions.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            body="Log workouts to see your weekly volume trend."
          />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.72} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                />
                <Tooltip
                  cursor={{ fill: 'var(--secondary)', opacity: 0.5 }}
                  contentStyle={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="minutes"
                  fill="url(#volumeFill)"
                  radius={[7, 7, 0, 0]}
                  name="Minutes"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ── Consistency heatmap (the retention grid) ─────────────────── */}
      <Card className="p-5">
        <p className="font-display mb-4 flex items-center gap-2 text-sm font-bold">
          <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-xl">
            <CalendarDays className="h-4 w-4" aria-hidden />
          </span>
          Consistency
        </p>
        {state.sessions.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No days trained yet"
            body="Your training grid fills in as you log sessions — a visual streak to protect."
          />
        ) : (
          <ConsistencyHeatmap
            weeks={heatmap}
            activeDays={heatDays}
            weekStartsOn={state.profile.weekStartsOn}
          />
        )}
      </Card>

      {/* ── Personal records & 1RM (Pro shows the full history) ──────── */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display flex items-center gap-2 text-sm font-bold">
            <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-xl">
              <Trophy className="h-4 w-4" aria-hidden />
            </span>
            Personal records
          </p>
          {!pro && records.length > FREE_RECORDS && (
            <Button size="sm" onClick={() => openWith({ kind: 'pro' })}>
              <Lock className="h-3.5 w-3.5" /> Unlock all {records.length}
            </Button>
          )}
        </div>
        {records.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No records yet"
            body="Log a set with a weight and rep count and SmartFit scores your one-rep max."
          />
        ) : (
          <ul className="grid gap-2">
            {(pro ? records : records.slice(0, FREE_RECORDS)).map((r, i) => (
              <li
                key={r.name}
                className="bg-secondary/60 flex items-center gap-3 rounded-xl px-3 py-2.5"
              >
                <span className="bg-primary/10 text-primary w-6 text-center text-sm font-extrabold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{r.name}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {r.bestReps} × {formatWeight(r.bestWeight, state.profile.weightUnit)} ·{' '}
                    {relativeDay(r.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-extrabold tabular-nums">
                    {formatWeight(r.bestE1rm, state.profile.weightUnit)}
                  </p>
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">e1RM</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!pro && records.length > FREE_RECORDS && (
          <button
            onClick={() => openWith({ kind: 'pro' })}
            className="bg-secondary/70 hover:bg-secondary mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold"
          >
            <Lock className="h-4 w-4" aria-hidden /> {records.length - FREE_RECORDS} more records
            are a Pro feature
          </button>
        )}
      </Card>

      {/* ── Achievements wall (Pro unlocks the full wall) ────────────── */}
      <Card className="p-5">
        <p className="font-display mb-4 flex items-center gap-2 text-sm font-bold">
          <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-xl">
            <Medal className="h-4 w-4" aria-hidden />
          </span>
          Achievements
        </p>
        <AchievementWall
          achievements={pro ? achievements : achievements.slice(0, FREE_ACHIEVEMENTS)}
          lockedNote="Pro"
        />
        {!pro && achievements.length > FREE_ACHIEVEMENTS && (
          <button
            onClick={() => openWith({ kind: 'pro' })}
            className="bg-secondary/70 hover:bg-secondary mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold"
          >
            <Lock className="h-4 w-4" aria-hidden /> Unlock all {achievements.length} badges
          </button>
        )}
      </Card>

      {/* ── Muscle-group volume ──────────────────────────────────────── */}
      {muscles.length > 0 && (
        <Card className="p-5">
          <p className="font-display mb-4 flex items-center gap-2 text-sm font-bold">
            <span className="bg-chart-4/10 text-chart-4 flex h-8 w-8 items-center justify-center rounded-xl">
              <DumbbellIcon className="h-4 w-4" aria-hidden />
            </span>
            Volume by muscle · last {days} days
          </p>
          <ul className="grid gap-2.5">
            {muscles.slice(0, 8).map((m) => {
              const max = muscles[0]?.volume ?? 1;
              return (
                <li key={m.muscle} className="grid gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{m.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatVolume(m.volume, state.profile.weightUnit)} · {m.sets} sets
                    </span>
                  </div>
                  <div className="bg-secondary h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-chart-4 h-full rounded-full"
                      style={{ width: `${Math.max(4, Math.round((m.volume / max) * 100))}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Activity mix ─────────────────────────────────────────────── */}
        <Card className="p-5">
          <p className="font-display mb-4 text-sm font-bold">Time by activity</p>
          {breakdown.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Nothing logged"
              body="Your activity mix will appear here."
            />
          ) : (
            <div className="flex flex-col gap-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-5">
              <div className="relative mx-auto h-36 w-36 shrink-0 min-[480px]:mx-0">
                <Donut
                  data={breakdown.map((b) => ({ value: b.minutes, color: b.category.color }))}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-lg font-extrabold tabular-nums">
                    {formatMinutes(totalMin)}
                  </span>
                  <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    total
                  </span>
                </div>
              </div>
              <div className="grid w-full min-w-0 flex-1 gap-2.5">
                {breakdown.map((b) => (
                  <div key={b.category.id} className="grid gap-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: b.category.color }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate font-semibold">{b.category.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatMinutes(b.minutes)}
                      </span>
                    </div>
                    <div
                      className="bg-secondary ml-4.5 h-1.5 overflow-hidden rounded-full"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(3, Math.round((b.minutes / totalMin) * 100))}%`,
                          backgroundColor: b.category.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* ── Intensity ────────────────────────────────────────────────── */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="font-display text-sm font-bold">Intensity spread</p>
            <Link
              href="/dashboard/body"
              className="text-primary text-xs font-semibold hover:underline"
            >
              See body trends →
            </Link>
          </div>
          {intensityData.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="No sessions"
              body="Intensity distribution shows up after logging."
            />
          ) : (
            <div className="space-y-4">
              {intensityData.map((d) => {
                const total = intensityData.reduce((a, x) => a + x.value, 0);
                const pct = Math.round((d.value / total) * 100);
                return (
                  <div key={d.key}>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 font-semibold">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: d.color }}
                          aria-hidden
                        />
                        {d.name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {d.value} session{d.value === 1 ? '' : 's'} · {pct}%
                      </span>
                    </div>
                    <div
                      className="bg-secondary mt-1.5 h-2.5 w-full overflow-hidden rounded-full"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: d.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Ring stat for the dark hero card — bright warm strokes on charcoal. */
function RingStat({
  pct,
  label,
  value,
  icon: Icon,
  color,
  big,
}: {
  pct: number;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  big?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center sm:gap-2">
      <Ring
        pct={pct}
        size={big ? 88 : 64}
        stroke={big ? 9 : 7}
        color={color}
        track="rgba(247,242,234,0.14)"
      >
        {big ? (
          <span className="text-center">
            <Icon className="mx-auto h-5 w-5" style={{ color }} aria-hidden />
            <span className="mt-0.5 block text-sm font-extrabold tabular-nums">{pct}%</span>
          </span>
        ) : (
          <Icon className="h-4 w-4" style={{ color }} aria-hidden />
        )}
      </Ring>
      <p className="text-xs font-bold">{label}</p>
      <p className="hero-muted text-[11px] whitespace-nowrap tabular-nums sm:text-xs">{value}</p>
    </div>
  );
}

/** Light stat tile: tinted icon chip, big tabular value, delta vs previous. */
function StatCard({
  icon: Icon,
  tile,
  label,
  value,
  sub,
  current,
  previous,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tile: string;
  label: string;
  value: string;
  sub: string;
  current: number;
  previous: number;
}) {
  const delta =
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? null : 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-semibold">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', tile)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="font-display mt-2 text-lg font-extrabold tracking-tight tabular-nums sm:text-xl">
        {value}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
              delta > 0 ? 'bg-primary/10 text-primary' : 'bg-clay/10 text-clay',
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDownRight className="h-3 w-3" aria-hidden />
            )}
            {Math.abs(delta)}%
          </span>
        )}
        <p className="text-muted-foreground text-xs">{sub}</p>
      </div>
    </Card>
  );
}

function Donut({ data }: { data: { value: number; color: string }[] }) {
  const total = data.reduce((a, x) => a + x.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--secondary)" strokeWidth="16" />
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const seg = (
          <circle
            key={i}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={d.color}
            strokeWidth="16"
            strokeDasharray={`${len - 3} ${c - len + 3}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}
