'use client';

import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand';

/* ═══════════════════════════════════════════════════════════════════════
   Volt kit — the reference design language as shared primitives.

   Every surface in the product (login → onboarding → dashboard → report)
   is composed from these pieces so the whole app reads as one design:
   graphite cards on the ink canvas, volt accents, fused pill CTAs,
   orbit-ring heroes, chip filters and ring gauges.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── Orbit hero ─────────────────────────────────────────────────────────
   The reference welcome art: two crossed elliptical orbits around the brand
   mark, drawn as vectors (no image decode) with a volt→lime gradient. */
export function OrbitHero({
  size = 260,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      aria-hidden={children ? undefined : true}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="orbit-a" x1="0" y1="0" x2="200" y2="200">
            <stop offset="0%" stopColor="#f3ff47" />
            <stop offset="100%" stopColor="#f7ff85" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="orbit-b" x1="200" y1="0" x2="0" y2="200">
            <stop offset="0%" stopColor="#cbe02c" />
            <stop offset="100%" stopColor="#f3ff47" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <ellipse
          cx="100"
          cy="100"
          rx="88"
          ry="46"
          transform="rotate(-28 100 100)"
          stroke="url(#orbit-a)"
          strokeWidth="2.5"
        />
        <ellipse
          cx="100"
          cy="100"
          rx="88"
          ry="46"
          transform="rotate(32 100 100)"
          stroke="url(#orbit-b)"
          strokeWidth="2.5"
        />
        <circle cx="100" cy="100" r="3.5" fill="#f3ff47" opacity="0.9" />
        <circle cx="31" cy="150" r="3" fill="#f7ff85" opacity="0.7" />
        <circle cx="172" cy="56" r="3" fill="#cbe02c" opacity="0.7" />
      </svg>
      {children ?? (
        <span className="animate-float relative">
          <Logo size={size * 0.26} />
        </span>
      )}
    </div>
  );
}

/* ── Headline with volt accents ──────────────────────────────────────
   "Fitness made simple: your path to Health and Happiness" — the accent
   words wear volt, magazine-style. */
export function VoltHeadline({ className }: { className?: string }) {
  return (
    <h1
      className={cn(
        'text-3xl leading-[1.12] font-extrabold tracking-tight text-balance sm:text-4xl',
        className,
      )}
    >
      Fitness made simple: your path to <span className="text-volt">Health</span> and{' '}
      <span className="text-volt">Happiness</span>
    </h1>
  );
}

/* ── Fused pill CTA ────────────────────────────────────────────────
   The reference button: a volt pill with a darker circular play cap fused
   to its right end. `cap` swaps the icon; `capClass` its colors. */
export function PillCta({
  label,
  onClick,
  disabled,
  loading,
  type = 'button',
  className,
  cap = 'play',
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  cap?: 'play' | 'arrow' | 'none';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'press bg-volt text-ink relative inline-flex h-14 items-center rounded-full pr-16 pl-7 text-base font-extrabold tracking-tight',
        'shadow-[0_10px_30px_-10px_rgba(243,255,71,0.55)] transition-transform hover:-translate-y-0.5 active:translate-y-0',
        'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      {loading ? (
        <span
          className="border-ink/30 border-ink-t h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
          aria-hidden
        />
      ) : (
        label
      )}
      {cap !== 'none' && (
        <span
          className="bg-ink absolute top-1/2 right-1.5 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full"
          aria-hidden
        >
          {cap === 'play' ? (
            <Play className="fill-volt text-volt h-4.5 w-4.5" />
          ) : (
            <span className="bg-volt absolute h-2 w-2 -translate-x-1 rotate-45" />
          )}
        </span>
      )}
    </button>
  );
}

/* ── Metric card ─────────────────────────────────────────────────────
   The reference health-metric tile: label + icon chip on top, the big
   number, and a unit pill at the bottom (optional sparkline on the right). */
export function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  chart,
  onClick,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  unit?: string;
  chart?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground truncate text-sm font-semibold">{label}</p>
        <span className="bg-primary/10 text-primary grid h-8 w-8 shrink-0 place-items-center rounded-lg">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[1.7rem] leading-none font-extrabold tracking-tight tabular-nums">
            {value}
          </p>
          {unit && (
            <span className="bg-secondary text-muted-foreground mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-bold">
              {unit}
            </span>
          )}
        </div>
        {chart && <div className="shrink-0">{chart}</div>}
      </div>
    </>
  );
  const cls = cn(
    'bg-card border-border min-w-0 rounded-3xl border p-4 transition-colors sm:p-5',
    onClick && 'hover:border-volt/40 cursor-pointer text-left',
    className,
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ── Mini bars sparkline ─────────────────────────────────────────────
   The reference's little volt bar chart inside metric tiles. */
export function MiniBars({
  values,
  className,
  max,
}: {
  values: number[];
  className?: string;
  max?: number;
}) {
  const top = Math.max(1, max ?? Math.max(...values, 1));
  return (
    <div className={cn('flex h-10 items-end gap-[3px]', className)} aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn('w-[4px] rounded-full', v > 0 ? 'bg-volt' : 'bg-volt/20')}
          style={{ height: `${Math.max(12, Math.round((v / top) * 100))}%` }}
        />
      ))}
    </div>
  );
}

/* ── Chip (filter / segmented) ────────────────────────────────────────
   Reference chips: selected = volt pill with ink text; rest = graphite. */
export function Chip({
  label,
  selected,
  onClick,
  className,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
        selected
          ? 'bg-volt text-ink shadow-[0_4px_16px_-6px_rgba(243,255,71,0.6)]'
          : 'bg-secondary text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {label}
    </button>
  );
}

/* ── Grade ring ──────────────────────────────────────────────────────
   The Health-Grade gauge: volt ring with a rounded cap and the score in
   the middle. 0–100. */
export function GradeRing({
  value,
  size = 92,
  stroke = 9,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'Score'}: ${clamped} of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--secondary)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          fill="none"
        />
      </svg>
      <span
        className="absolute font-extrabold tabular-nums"
        style={{ fontSize: Math.max(13, Math.round(size * 0.24)) }}
      >
        {clamped}
      </span>
    </div>
  );
}
