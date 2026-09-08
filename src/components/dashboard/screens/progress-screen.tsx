'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Flame,
  Footprints,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store-context';
import { Card, CardContent } from '@/components/ui/card';
import { Ring } from '../ring';
import { EmptyState } from '../empty-state';
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
} from '@smartfit/core';
import { formatCalories, formatDistance, formatMinutes } from '@smartfit/core';

type Range = 'daily' | 'weekly' | 'monthly';
const RANGES: { key: Range; label: string; days: number }[] = [
  { key: 'daily', label: 'Daily', days: 1 },
  { key: 'weekly', label: 'Weekly', days: 7 },
  { key: 'monthly', label: 'Monthly', days: 30 },
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

        {/* Segmented control */}
        <div
          className="bg-secondary flex w-full max-w-sm rounded-full p-1 sm:w-auto sm:flex-none"
          role="tablist"
          aria-label="Stats range"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                'flex-1 rounded-full px-5 py-2 text-sm font-bold transition-all sm:flex-none',
                range === r.key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero: goal rings on warm charcoal with an ember glow ─────────── */}
      <section className="card-hero p-6 sm:p-8" aria-label="Goal rings">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center justify-around gap-2">
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
            <div className="flex items-center gap-5">
              <div className="relative h-36 w-36 shrink-0">
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
              <div className="grid flex-1 gap-2.5">
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
    <div className="flex flex-col items-center gap-2">
      <Ring
        pct={pct}
        size={big ? 104 : 76}
        stroke={big ? 10 : 7}
        color={color}
        track="rgba(247,242,234,0.14)"
      >
        {big ? (
          <span className="text-center">
            <Icon className="mx-auto h-5 w-5" style={{ color }} aria-hidden />
            <span className="mt-0.5 block text-sm font-extrabold tabular-nums">{pct}%</span>
          </span>
        ) : (
          <Icon className="h-5 w-5" style={{ color }} aria-hidden />
        )}
      </Ring>
      <p className="text-xs font-bold">{label}</p>
      <p className="hero-muted text-xs tabular-nums">{value}</p>
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
