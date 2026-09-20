'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Activity, Flame, Timer } from 'lucide-react';
import type { ActivityRings } from '@smartfit/core';
import { formatCalories, formatMinutes } from '@smartfit/core';
import { cn } from '@/lib/utils';

/**
 * Three concentric closing rings — the retention visual the whole category
 * converged on (Apple Fitness+). Order matters: Move (calories, volt) on the
 * outside, Exercise (minutes, terracotta) middle, Sessions (chart gold) core,
 * matching Apple's Move/Exercise/Stand reading order.
 *
 * Rendered for a dark stage (the overview's volt hero): gradient strokes,
 * tinted tracks and a soft halo under each arc that brightens once the ring
 * closes. Arcs sweep from 0 on mount (instant under reduced motion).
 *
 * A ring whose target is 0 is rendered as a dim track — present but honest,
 * never faked as "closed".
 */
export function ActivityRingsGraphic({
  rings,
  size = 168,
  children,
}: {
  rings: ActivityRings;
  size?: number;
  /** Centre overlay (the Move total) — HTML, absolutely centred over the dial. */
  children?: ReactNode;
}) {
  const uid = useId().replace(/:/g, '');
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (reduceMotion) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAnimate(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [reduceMotion]);

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
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`Today's activity: Move ${Math.round(rings.calories.pct)} percent, Exercise ${Math.round(rings.minutes.pct)} percent, Sessions ${Math.round(rings.sessions.pct)} percent`}
      >
        <defs>
          {ringsData.map((ring) => (
            <linearGradient key={ring.key} id={`${uid}-${ring.key}`} x1="0" y1="0" x2="1" y2="1">
              <stop
                offset="0%"
                style={{ stopColor: `color-mix(in oklab, ${ring.color} 55%, white)` }}
              />
              <stop offset="100%" style={{ stopColor: ring.color }} />
            </linearGradient>
          ))}
        </defs>
        {ringsData.map((ring) => {
          const c = 2 * Math.PI * ring.r;
          const complete = ring.pct >= 100;
          const shown = animate || reduceMotion ? Math.min(100, ring.pct) : 0;
          const offset = c - (c * shown) / 100;
          const sweep = reduceMotion
            ? undefined
            : { transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' };
          return (
            <g key={ring.key}>
              {/* Tinted track so a 0-target ring still reads as a dial. */}
              <circle
                cx={cx}
                cy={cx}
                r={ring.r}
                fill="none"
                strokeWidth={stroke}
                style={{ stroke: `color-mix(in oklab, ${ring.color} 16%, transparent)` }}
              />
              {ring.active && (
                <>
                  {/* Soft halo under the arc — brighter once the ring closes. */}
                  <circle
                    cx={cx}
                    cy={cx}
                    r={ring.r}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    opacity={complete ? 0.5 : 0.28}
                    style={{ filter: 'blur(5px)', ...sweep }}
                  />
                  <circle
                    cx={cx}
                    cy={cx}
                    r={ring.r}
                    fill="none"
                    stroke={`url(#${uid}-${ring.key})`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={offset}
                    style={sweep}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>
      {children && (
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-1 text-center">
          <span className="flex max-w-[70%] flex-col items-center justify-center overflow-hidden">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * The legend beside the rings — icon, label, value/target plus a % pill for
 * each dial, using the same colour mapping as the graphic. `onDark` reads in
 * hero tones on the volt card; `default` suits light surfaces.
 */
export function ActivityRingsLegend({
  rings,
  tone = 'default',
}: {
  rings: ActivityRings;
  tone?: 'default' | 'onDark';
}) {
  const dark = tone === 'onDark';
  const rows = [
    {
      icon: Flame,
      color: 'var(--chart-1)',
      label: 'Move',
      pct: rings.calories.pct,
      value: rings.calories.target > 0 ? formatCalories(rings.calories.value) : '—',
      target: rings.calories.target > 0 ? formatCalories(rings.calories.target) : 'set a goal',
    },
    {
      icon: Timer,
      color: 'var(--chart-2)',
      label: 'Exercise',
      pct: rings.minutes.pct,
      value: formatMinutes(rings.minutes.value),
      target: rings.minutes.target > 0 ? formatMinutes(rings.minutes.target) : 'set a goal',
    },
    {
      icon: Activity,
      color: 'var(--chart-3)',
      label: 'Sessions',
      pct: rings.sessions.pct,
      value: `${rings.sessions.value}`,
      target: rings.sessions.target > 0 ? `${rings.sessions.target} this week` : 'set a goal',
    },
  ];

  return (
    <ul className="grid gap-2.5" aria-label="Today's activity details">
      {rows.map((row) => (
        <li
          key={row.label}
          className={cn(
            'flex items-center gap-3',
            dark && 'border-b border-[rgba(247,242,234,0.1)] pb-2.5 last:border-b-0 last:pb-0',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              dark && 'hero-tile',
            )}
            style={
              dark
                ? { color: row.color }
                : {
                    backgroundColor: `color-mix(in oklab, ${row.color} 18%, transparent)`,
                    color: row.color,
                  }
            }
          >
            <row.icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'text-xs font-semibold tracking-wide uppercase',
                dark ? 'hero-muted' : 'text-muted-foreground',
              )}
            >
              {row.label}
            </p>
            <p className="truncate text-sm font-bold tabular-nums">
              {row.value}
              <span className={cn('font-medium', dark ? 'hero-muted' : 'text-muted-foreground')}>
                {' '}
                / {row.target}
              </span>
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-1 text-xs font-extrabold tabular-nums"
            style={{
              backgroundColor: `color-mix(in oklab, ${row.color} 20%, transparent)`,
              color: row.color,
            }}
          >
            {Math.min(100, Math.round(row.pct))}%
          </span>
        </li>
      ))}
    </ul>
  );
}
