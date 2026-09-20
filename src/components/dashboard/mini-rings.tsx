'use client';

import type { DayRings } from '@smartfit/core';

/**
 * Apple Watch-style micro dial: three concentric arcs (Move / Exercise /
 * Showed-up) sized for history strips and week grids. Static by design —
 * at 20–40 px the shape *is* the message, and forty animated SVGs in a grid
 * would cost more than they say. Closed days get a soft halo per arc.
 */
export function MiniRings({
  rings,
  size = 28,
  label,
  className,
}: {
  rings: DayRings;
  size?: number;
  /** Accessible summary; defaults to the three percentages. */
  label?: string;
  className?: string;
}) {
  const stroke = Math.max(2.5, size * 0.14);
  const gap = stroke * 0.35;
  const cx = size / 2;
  const data = [
    {
      r: cx - stroke / 2,
      pct: rings.calories.pct,
      active: rings.calories.target > 0,
      color: 'var(--chart-1)',
    },
    {
      r: cx - stroke / 2 - (stroke + gap),
      pct: rings.minutes.pct,
      active: rings.minutes.target > 0,
      color: 'var(--chart-2)',
    },
    {
      r: cx - stroke / 2 - 2 * (stroke + gap),
      pct: rings.showedUp.pct,
      active: true,
      color: 'var(--chart-3)',
    },
  ].filter((d) => d.r > 0);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`-rotate-90 ${className ?? ''}`}
      role="img"
      aria-label={
        label ??
        `Rings: move ${rings.calories.pct}%, exercise ${rings.minutes.pct}%, showed up ${rings.showedUp.pct}%${rings.closed ? ' — all closed' : ''}`
      }
    >
      {data.map((d, i) => {
        const c = 2 * Math.PI * d.r;
        const shown = Math.min(100, d.pct);
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={cx}
              r={d.r}
              fill="none"
              strokeWidth={stroke}
              style={{ stroke: `color-mix(in oklab, ${d.color} 20%, transparent)` }}
            />
            {d.active && shown > 0 && (
              <circle
                cx={cx}
                cy={cx}
                r={d.r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c - (c * shown) / 100}
                style={{
                  stroke: d.color,
                  filter: rings.closed ? `drop-shadow(0 0 2.5px ${d.color})` : undefined,
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
