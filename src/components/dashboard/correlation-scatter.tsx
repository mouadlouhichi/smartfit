'use client';

import { useMemo, useState } from 'react';
import { HelpCircle, ScatterChart as ScatterIcon, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store-context';
import {
  dailyReadiness,
  dailyStrain,
  sleepOn,
  sleepScore,
  toISODate,
  vitalsOn,
  aggregate,
  sessionsInRange,
} from '@smartfit/core';
import { cn } from '@/lib/utils';

type MetricKey =
  | 'readiness'
  | 'strain'
  | 'sleepHours'
  | 'sleepScore'
  | 'rhr'
  | 'hrv'
  | 'resp'
  | 'spo2'
  | 'steps'
  | 'calories';

const METRICS: {
  key: MetricKey;
  label: string;
  unit: string;
  group: 'perf' | 'sleep' | 'vitals';
}[] = [
  { key: 'readiness', label: 'Recovery score', unit: '/100', group: 'perf' },
  { key: 'strain', label: 'Strain', unit: ' pts', group: 'perf' },
  { key: 'sleepHours', label: 'Sleep duration', unit: 'h', group: 'sleep' },
  { key: 'sleepScore', label: 'Sleep score', unit: '/100', group: 'sleep' },
  { key: 'rhr', label: 'Resting HR', unit: ' bpm', group: 'vitals' },
  { key: 'hrv', label: 'HRV (SDNN)', unit: ' ms', group: 'vitals' },
  { key: 'resp', label: 'Resp rate', unit: ' br/min', group: 'vitals' },
  { key: 'spo2', label: 'SpO₂', unit: '%', group: 'vitals' },
  { key: 'steps', label: 'Steps', unit: '', group: 'vitals' },
  { key: 'calories', label: 'Active cal', unit: ' kcal', group: 'perf' },
];

function metricValue(state: any, date: string, key: MetricKey): number | null {
  const sleep = sleepOn(state, date);
  const v = vitalsOn(state, date);
  const readiness = dailyReadiness(state, date);
  const strain = dailyStrain(state, date);
  const dayAgg = aggregate(sessionsInRange(state, date, date));
  switch (key) {
    case 'readiness':
      return readiness.score;
    case 'strain':
      return strain.score;
    case 'sleepHours':
      return sleep ? +(sleep.durationMin / 60).toFixed(2) : null;
    case 'sleepScore':
      return sleep ? sleepScore(sleep) : null;
    case 'rhr':
      return v?.restingHR ?? null;
    case 'hrv':
      return v?.hrvRmssd ?? null;
    case 'resp':
      return v?.respiratoryRate ?? null;
    case 'spo2':
      return v?.spo2 != null ? Math.round(v.spo2) : null;
    case 'steps':
      return v?.steps ?? null;
    case 'calories':
      return Math.round((v?.activeCalories ?? 0) + (dayAgg.calories || 0));
  }
}

function pearson(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return { r: 0, n };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return { r: den === 0 ? 0 : num / den, n };
}

export function CorrelationScatter({ days = 30 }: { days?: number }) {
  const { state } = useStore();
  const [xKey, setXKey] = useState<MetricKey>('sleepScore');
  const [yKey, setYKey] = useState<MetricKey>('readiness');

  const { points, stats } = useMemo(() => {
    const today = new Date();
    const xs: number[] = [],
      ys: number[] = [];
    const pts: { x: number; y: number; date: string; z: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = toISODate(d);
      const x = metricValue(state, iso, xKey);
      const y = metricValue(state, iso, yKey);
      if (x != null && y != null && Number.isFinite(x) && Number.isFinite(y)) {
        xs.push(x);
        ys.push(y);
        pts.push({ x, y, date: iso, z: 6 });
      }
    }
    const { r, n } = pearson(xs, ys);
    return { points: pts, stats: { r, n } };
  }, [state, xKey, yKey, days]);

  const xDef = METRICS.find((m) => m.key === xKey)!;
  const yDef = METRICS.find((m) => m.key === yKey)!;

  const strength = Math.abs(stats.r);
  const direction = stats.r > 0 ? 'positive' : 'negative';
  const label =
    !isFinite(stats.r) || stats.n < 3
      ? 'Need at least 3 days of data for both metrics'
      : strength < 0.2
        ? 'No meaningful relationship in this window'
        : strength < 0.4
          ? `Weak ${direction} trend`
          : strength < 0.6
            ? `Moderate ${direction} relationship`
            : `Strong ${direction} relationship`;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ScatterIcon className="text-[#8AD200]" size={18} />
              <h3 className="text-foreground text-base font-bold">Multi-metric correlation</h3>
            </div>
            <p className="text-muted-foreground text-xs">
              Pick two metrics to see how they&rsquo;ve moved together over the last {days} days.
              Pearson r is a simple linear signal, not causation &mdash; treat it as a hypothesis
              generator.
            </p>
          </div>
          <div title="Pearson correlation r ranges from -1 to 1; closer to ±1 means the two metrics moved together more tightly.">
            <HelpCircle size={16} className="text-muted-foreground" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricPicker label="X axis" value={xKey} onChange={setXKey} />
          <MetricPicker label="Y axis" value={yKey} onChange={setYKey} exclude={xKey} />
        </div>

        <div className="bg-volt-ground/40 rounded-xl p-3">
          <div className="flex items-center gap-2 text-xs">
            {stats.r >= 0 ? (
              <TrendingUp size={14} className="text-[#8AD200]" />
            ) : (
              <TrendingDown size={14} className="text-[#f97316]" />
            )}
            <span className="text-foreground font-semibold">
              r = {stats.n < 3 ? '—' : stats.r.toFixed(2)}
            </span>
            <span className="text-muted-foreground">
              · {stats.n} day{stats.n === 1 ? '' : 's'}
            </span>
            <span className="text-muted-foreground ml-auto">{label}</span>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 24, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="x"
                type="number"
                name={xDef.label}
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                label={{
                  value: xDef.label + xDef.unit,
                  position: 'bottom',
                  offset: 4,
                  fill: '#9ca3af',
                  fontSize: 11,
                }}
              />
              <YAxis
                dataKey="y"
                type="number"
                name={yDef.label}
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                width={44}
              />
              <ZAxis dataKey="z" range={[30, 30]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ''}
                formatter={(value: number, name: string) => [
                  `${value}${name === xDef.label ? xDef.unit : yDef.unit}`,
                  name,
                ]}
              />
              <Scatter data={points} fill="#8AD200" fillOpacity={0.85} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {points.length === 0 && (
          <p className="text-muted-foreground -mt-10 text-center text-xs">
            Log a few days of sleep, vitals, and workouts to populate this chart.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricPicker({
  label,
  value,
  onChange,
  exclude,
}: {
  label: string;
  value: MetricKey;
  onChange: (k: MetricKey) => void;
  exclude?: MetricKey;
}) {
  const groups: { title: string; items: typeof METRICS }[] = [
    { title: 'Performance', items: METRICS.filter((m) => m.group === 'perf' && m.key !== exclude) },
    { title: 'Sleep', items: METRICS.filter((m) => m.group === 'sleep' && m.key !== exclude) },
    { title: 'Vitals', items: METRICS.filter((m) => m.group === 'vitals' && m.key !== exclude) },
  ];
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {groups
          .flatMap((g) => g.items)
          .map((m) => (
            <Button
              key={m.key}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onChange(m.key)}
              className={cn(
                'h-7 rounded-full px-2.5 text-[11px]',
                value === m.key ? 'bg-[#8AD200] text-black hover:bg-[#b0ff4d]' : '',
              )}
            >
              {m.label}
            </Button>
          ))}
      </div>
    </div>
  );
}
