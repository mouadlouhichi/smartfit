'use client';

import { useMemo } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { Heart, Flame, Moon } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { strainRecoverySeries } from '@smartfit/core';
import { cn } from '@/lib/utils';

/**
 * 28-day strain vs recovery dual-line chart. Mirrors the "Your Charts" weekly
 * visualizer from Sonar Trends, overlaying cardiovascular strain (orange,
 * 0–21) against recovery (volt, 0–100) on a shared timeline.
 */
export function RecoveryTrendsCard({ days = 28 }: { days?: number }) {
  const { state } = useStore();

  const series = useMemo(() => strainRecoverySeries(state, days), [state, days]);

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        date: p.date.slice(5), // MM-DD for compact axis
        recovery: p.recovery,
        strain: p.strain,
      })),
    [series],
  );

  const avgRecovery = Math.round(
    series.reduce((a, b) => a + b.recovery, 0) / Math.max(1, series.length),
  );
  const avgStrain = (series.reduce((a, b) => a + b.strain, 0) / Math.max(1, series.length)).toFixed(
    1,
  );

  const hasAnyData = series.some((p) => p.strain > 0 || p.recovery !== 75);

  return (
    <section
      aria-label="Recovery & strain trends"
      className="bg-card min-w-0 rounded-[2rem] p-5 shadow-sm min-[420px]:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <Heart className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight">
              Recovery & Strain
            </p>
            <p className="text-muted-foreground text-xs">Last {days} days</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <TrendStat
          icon={Heart}
          label="Avg recovery"
          value={`${avgRecovery}`}
          unit="/100"
          color="var(--volt)"
        />
        <TrendStat icon={Flame} label="Avg strain" value={avgStrain} unit="/21" color="#f97316" />
        <TrendStat
          icon={Moon}
          label="Days logged"
          value={series.filter((p) => p.strain > 0 || p.recovery < 100).length.toString()}
          unit={`of ${days}`}
          color="#8b5cf6"
        />
      </div>

      <div className="mt-5">
        <div className={cn('h-48 w-full', !hasAnyData && 'pointer-events-none opacity-60')}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.45)' }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(days / 7)}
              />
              <YAxis
                yAxisId="rec"
                domain={[0, 100]}
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="str"
                domain={[0, 21]}
                orientation="right"
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                yAxisId="str"
                y={14}
                stroke="rgba(249,115,22,0.25)"
                strokeDasharray="3 3"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  borderColor: 'var(--border)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--foreground)', fontWeight: 700 }}
              />
              <Line
                yAxisId="rec"
                type="monotone"
                dataKey="recovery"
                stroke="var(--volt)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--volt)' }}
              />
              <Line
                yAxisId="str"
                type="monotone"
                dataKey="strain"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#f97316' }}
                strokeDasharray="4 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[11px]">
          <LegendSwatch color="var(--volt)" label="Recovery" />
          <LegendSwatch color="#f97316" label="Strain" dashed />
        </div>
      </div>
    </section>
  );
}

function TrendStat({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="bg-secondary rounded-xl px-2 py-2.5">
      <div className="flex items-center justify-center gap-1">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          {label}
        </p>
      </div>
      <p className="font-display mt-1 text-lg leading-tight font-extrabold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-[10px]">{unit}</p>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 font-semibold">
      <span
        className="h-0.5 w-4 rounded-full"
        style={{
          backgroundColor: dashed ? 'transparent' : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}
