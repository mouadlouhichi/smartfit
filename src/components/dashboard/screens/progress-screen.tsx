'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Footprints, Timer, TrendingUp, Flame } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
} from '@smartfit/core';
import { formatCalories, formatDistance, formatMinutes } from '@smartfit/core';

type Range = 'daily' | 'weekly' | 'monthly';
const RANGES: { key: Range; label: string; days: number }[] = [
  { key: 'daily', label: 'Daily', days: 1 },
  { key: 'weekly', label: 'Weekly', days: 7 },
  { key: 'monthly', label: 'Monthly', days: 30 },
];

export function ProgressScreen() {
  const { state } = useStore();
  const [range, setRange] = useState<Range>('weekly');
  const days = RANGES.find((r) => r.key === range)!.days;

  const rangeAgg = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    return aggregate(sessionsInRange(state, toISODate(from), toISODate(new Date())));
  }, [state, days]);

  const breakdown = useMemo(
    () => categoryBreakdown(state, rangeDaysSessions(state, days)),
    [state, days],
  );
  const totalMin = breakdown.reduce((a, x) => a + x.minutes, 0);

  const series = useMemo(() => weeklySeries(state, 8), [state]);
  const intensityData = useMemo(() => {
    const order: (keyof typeof INTENSITY_META)[] = ['low', 'moderate', 'high'];
    return order
      .map((k) => ({
        name: INTENSITY_META[k].label,
        value: rangeDaysSessions(state, days).filter((s) => s.intensity === k).length,
        color: INTENSITY_META[k].color,
      }))
      .filter((x) => x.value > 0);
  }, [state, days]);

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
      <h1 className="font-display-tight text-xl font-extrabold tracking-tight sm:text-2xl">
        Your Stats
      </h1>

      {/* Segmented control */}
      <div className="bg-secondary mx-auto flex w-full max-w-sm rounded-full p-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              'flex-1 rounded-full py-2.5 text-sm font-bold transition-all',
              range === r.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Goal rings */}
      <Card className="p-5">
        <div className="flex items-center justify-around">
          <RingStat
            pct={minPct}
            label="Exercise"
            value={`${rangeAgg.minutes}/${targets.minutes}min`}
            icon={Timer}
          />
          <RingStat
            pct={calPct}
            label="Burned"
            value={formatCalories(rangeAgg.calories)}
            icon={Flame}
            big
          />
          <RingStat
            pct={distPct}
            label="Distance"
            value={formatDistance(rangeAgg.distance ?? 0, distanceUnit)}
            icon={Footprints}
          />
        </div>
        {targets.calories === 0 && targets.distanceKm === 0 && (
          <p className="text-muted-foreground mt-3 text-center text-xs">
            Burn and distance rings fill once you set a calories or distance goal.
          </p>
        )}
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={BarChart3}
          label="Sessions"
          value={`${rangeAgg.workouts}`}
          sub={`last ${days} day${days === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Timer}
          label="Active time"
          value={formatMinutes(rangeAgg.minutes)}
          sub={`last ${days} day${days === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Flame}
          label="Calories"
          value={formatCalories(rangeAgg.calories)}
          sub="burned"
        />
        <StatCard
          icon={Footprints}
          label="Distance"
          value={formatDistance(rangeAgg.distance ?? 0, distanceUnit)}
          sub="covered"
        />
      </div>

      {/* Weekly bar chart */}
      <Card className="p-5">
        <p className="font-display mb-4 flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="text-primary h-4 w-4" /> Active minutes · last 8 weeks
        </p>
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
                <Bar dataKey="minutes" fill="var(--chart-1)" radius={[7, 7, 0, 0]} name="Minutes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Activity mix */}
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
                  <span className="font-display text-lg font-extrabold">
                    {formatMinutes(totalMin)}
                  </span>
                  <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    total
                  </span>
                </div>
              </div>
              <div className="grid flex-1 gap-2">
                {breakdown.map((b) => (
                  <div key={b.category.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: b.category.color }}
                    />
                    <span className="flex-1 font-semibold">{b.category.name}</span>
                    <span className="text-muted-foreground">{formatMinutes(b.minutes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Intensity */}
        <Card className="p-5">
          <p className="font-display mb-4 text-sm font-bold">Intensity spread</p>
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
                return (
                  <div key={d.name}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-muted-foreground">
                        {d.value} · {Math.round((d.value / total) * 100)}%
                      </span>
                    </div>
                    <div className="bg-secondary mt-1.5 h-2.5 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(d.value / total) * 100}%`, backgroundColor: d.color }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-muted-foreground pt-1 text-xs">
                <Link href="/dashboard/body" className="text-primary hover:underline">
                  See body trends →
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function rangeDaysSessions(state: ReturnType<typeof useStore>['state'], days: number) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  return sessionsInRange(state, toISODate(from), toISODate(new Date()));
}

function RingStat({
  pct,
  label,
  value,
  icon: Icon,
  big,
}: {
  pct: number;
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Ring pct={pct} size={big ? 92 : 72} stroke={big ? 9 : 7}>
        <Icon className={big ? 'text-primary h-6 w-6' : 'text-terracotta h-5 w-5'} />
      </Ring>
      <p className="text-xs font-bold">{label}</p>
      <p className="text-muted-foreground text-xs">{value}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-semibold">{label}</p>
        <Icon className="text-terracotta h-4 w-4" />
      </div>
      <p className="font-display mt-2 text-lg font-extrabold tracking-tight sm:text-xl">{value}</p>
      <p className="text-muted-foreground text-xs">{sub}</p>
    </Card>
  );
}

function Donut({ data }: { data: { value: number; color: string }[] }) {
  const total = data.reduce((a, x) => a + x.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
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
