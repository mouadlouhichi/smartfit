'use client';

/** Lightweight console charts. Values are printed as text as well as encoded
 * geometrically, so data remains available without color or hover. */

import { useId } from 'react';
import { cn } from '@/lib/utils';

export interface BarDatum {
  label: string;
  value: number;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = magnitude / 2;
  return Math.ceil(max / step) * step;
}

/** CSS columns keep bar widths responsive without stretching axis text. */
export function BarChart({
  data,
  ariaLabel,
  formatValue,
  height = 180,
  className,
}: {
  data: readonly BarDatum[];
  ariaLabel: string;
  /** Prints the y-axis ceiling and every bar's hover title. */
  formatValue: (v: number) => string;
  height?: number;
  className?: string;
}) {
  const gradientId = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  return (
    <div className={cn('space-y-3', className)}>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>0</span>
        <span>{formatValue(max)}</span>
      </div>
      <div
        role="img"
        aria-label={ariaLabel}
        className="border-border flex items-end gap-3 border-b"
        style={{ height }}
      >
        {data.map((d, i) => (
          <div
            key={`${gradientId}-${i}`}
            className="group flex h-full min-w-0 flex-1 items-end"
            title={`${d.label}: ${formatValue(d.value)}`}
          >
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-lime-700/80 to-lime-700 transition-colors dark:from-lime-500/40 dark:to-lime-500 dark:group-hover:to-lime-400"
              style={{ height: `${Math.max(0, (d.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {data.map((d, i) => (
          <div key={i} className="min-w-0 flex-1 text-center text-xs">
            <span className="text-muted-foreground block">{d.label}</span>
            <span className="mt-1 block font-medium break-words tabular-nums">
              {formatValue(d.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

/**
 * Donut with an HTML legend beside it. The centre shows the total; every
 * segment's value is repeated in the legend so nothing is colour-only.
 */
export function DonutChart({
  data,
  ariaLabel,
  formatValue,
  centerLabel,
  size = 148,
}: {
  data: readonly DonutDatum[];
  ariaLabel: string;
  formatValue: (v: number) => string;
  /** Printed under the total in the hole, e.g. "tenants". */
  centerLabel: string;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 140 140"
          width={size}
          height={size}
          role="img"
          aria-label={ariaLabel}
          className="shrink-0 -rotate-90"
        >
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="16"
          />
          {total > 0 &&
            data.map((d) => {
              const frac = d.value / total;
              const seg = (
                <circle
                  key={d.label}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="16"
                  strokeDasharray={`${frac * c} ${c}`}
                  strokeDashoffset={-offset * c}
                  strokeLinecap="butt"
                >
                  <title>{`${d.label}: ${formatValue(d.value)}`}</title>
                </circle>
              );
              offset += frac;
              return seg;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-lg tabular-nums">{formatValue(total)}</strong>
          <span className="text-muted-foreground text-xs">{centerLabel}</span>
        </div>
      </div>
      <div className="min-w-40 space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="truncate capitalize">{d.label.replace('_', ' ')}</span>
            </span>
            <span className="font-semibold tabular-nums">{formatValue(d.value)}</span>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-muted-foreground text-sm">Nothing to chart yet.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Labelled horizontal bars — the print-friendly cousin of the bar chart.
 * Used where labels matter more than shape (MRR by plan, revenue by gym).
 */
export function HBars({
  data,
  formatValue,
  className,
}: {
  data: readonly BarDatum[];
  formatValue: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn('space-y-2.5', className)}>
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium capitalize">{d.label.replace('_', ' ')}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatValue(d.value)}</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full" role="presentation">
            <div
              className="bg-primary/70 h-full rounded-full"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-muted-foreground text-sm">Nothing to chart yet.</p>}
    </div>
  );
}
