'use client';

import { Activity, Flame, Timer } from 'lucide-react';
import type { ActivityRings } from '@smartfit/core';
import { formatCalories, formatMinutes } from '@smartfit/core';

/**
 * Three concentric closing rings — the retention visual the whole category
 * converged on (Apple Fitness+). Order matters: Move (calories, ember) on the
 * outside, Exercise (minutes, terracotta) middle, Sessions (chart gold) core,
 * matching Apple's Move/Exercise/Stand reading order.
 *
 * A ring whose target is 0 is rendered as a dim track with its icon in the
 * centre — present but honest, never faked as "closed".
 */
export function ActivityRingsGraphic({
  rings,
  size = 168,
}: {
  rings: ActivityRings;
  size?: number;
}) {
  const stroke = Math.max(10, Math.round(size * 0.075));
  const gap = Math.round(stroke * 0.6);
  const cx = size / 2;
  const outer = size / 2 - stroke / 2;

  const ringsData = [
    {
      key: 'calories',
      r: outer,
      pct: rings.calories.pct,
      color: 'var(--chart-1)',
      active: rings.calories.target > 0,
    },
    {
      key: 'minutes',
      r: outer - (stroke + gap),
      pct: rings.minutes.pct,
      color: 'var(--chart-2)',
      active: rings.minutes.target > 0,
    },
    {
      key: 'sessions',
      r: outer - 2 * (stroke + gap),
      pct: rings.sessions.pct,
      color: 'var(--chart-3)',
      active: rings.sessions.target > 0,
    },
  ];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="-rotate-90"
      role="img"
      aria-label="Today's activity rings"
    >
      {ringsData.map((ring) => {
        const c = 2 * Math.PI * ring.r;
        const clamped = Math.min(100, ring.pct);
        return (
          <g key={ring.key}>
            {/* Track is always visible so a 0-target ring still reads as a dial. */}
            <circle
              cx={cx}
              cy={cx}
              r={ring.r}
              fill="none"
              stroke="rgba(127,127,127,0.18)"
              strokeWidth={stroke}
            />
            {ring.active && (
              <circle
                cx={cx}
                cy={cx}
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c - (c * clamped) / 100}
                style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)' }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The legend beside the rings — icon, label, value/target for each dial,
 * using the same colour mapping as the graphic.
 */
export function ActivityRingsLegend({ rings }: { rings: ActivityRings }) {
  const rows = [
    {
      icon: Flame,
      color: 'var(--chart-1)',
      label: 'Move',
      value: rings.calories.target > 0 ? formatCalories(rings.calories.value) : '—',
      target: rings.calories.target > 0 ? formatCalories(rings.calories.target) : 'set a goal',
    },
    {
      icon: Timer,
      color: 'var(--chart-2)',
      label: 'Exercise',
      value: formatMinutes(rings.minutes.value),
      target: rings.minutes.target > 0 ? formatMinutes(rings.minutes.target) : 'set a goal',
    },
    {
      icon: Activity,
      color: 'var(--chart-3)',
      label: 'Sessions',
      value: `${rings.sessions.value}`,
      target: rings.sessions.target > 0 ? `${rings.sessions.target} this week` : 'set a goal',
    },
  ];

  return (
    <ul className="grid gap-2.5">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: `color-mix(in oklab, ${row.color} 18%, transparent)`,
              color: row.color,
            }}
          >
            <row.icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {row.label}
            </p>
            <p className="text-sm font-bold tabular-nums">
              {row.value}
              <span className="text-muted-foreground font-medium"> / {row.target}</span>
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: row.color }}>
            {Math.min(100, ringPct(row.label, rings))}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function ringPct(label: string, rings: ActivityRings): number {
  if (label === 'Move') return rings.calories.pct;
  if (label === 'Exercise') return rings.minutes.pct;
  return rings.sessions.pct;
}
