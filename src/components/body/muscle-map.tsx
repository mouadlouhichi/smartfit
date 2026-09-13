'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ExerciseMuscle } from '@smartfit/core';
import { EXERCISE_MUSCLE_LABELS } from '@smartfit/core';
import { FRONT, FRONT_SIL, BACK, BACK_SIL, type BodyRegion } from './body-paths';

/**
 * The interactive muscle map — the "select body, get exercises" picker.
 *
 * Built from the reference anatomy figure: a traced flat muscle mannequin
 * whose individual muscles are always colored by category — green (upper
 * body), blue (core), yellow (legs) — over a near-black figure. The
 * selected region gets a white ring + glow; everything stays colored, like
 * the reference render. The chips below are the keyboard and screen-reader
 * path to the same selection.
 */

/* ── the exact category colors from the reference ─────────────────────── */
export const MUSCLE_GROUP_COLOR = {
  upper: '#3ac14e', // green — chest · shoulders · arms · back
  core: '#1e8fff', // blue — abs · lower back
  legs: '#ffc531', // yellow — quads · glutes · hamstrings · calves
} as const;

export const MUSCLE_GROUPS: {
  id: keyof typeof MUSCLE_GROUP_COLOR;
  label: string;
  color: string;
}[] = [
  { id: 'upper', label: 'Upper body', color: MUSCLE_GROUP_COLOR.upper },
  { id: 'core', label: 'Core', color: MUSCLE_GROUP_COLOR.core },
  { id: 'legs', label: 'Legs', color: MUSCLE_GROUP_COLOR.legs },
];

export const MUSCLE_GROUP: Record<ExerciseMuscle, keyof typeof MUSCLE_GROUP_COLOR> = {
  chest: 'upper',
  shoulders: 'upper',
  biceps: 'upper',
  triceps: 'upper',
  forearms: 'upper',
  traps: 'upper',
  lats: 'upper',
  'middle back': 'upper',
  abdominals: 'core',
  'lower back': 'core',
  quadriceps: 'legs',
  glutes: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
};

/** Fill+stroke for every shape of a region (selection ring included). */
function RegionShapes({
  region,
  color,
  active,
  dimmed,
  onHit,
}: {
  region: BodyRegion;
  color: string;
  active: boolean;
  dimmed: boolean;
  onHit: () => void;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={EXERCISE_MUSCLE_LABELS[region.muscle as ExerciseMuscle]}
      aria-pressed={active}
      onClick={onHit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onHit();
        }
      }}
      className="muscle-region cursor-pointer outline-none"
    >
      {active &&
        region.d.map((d, i) => (
          <path
            key={`glow-${i}`}
            d={d}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="7"
            pointerEvents="none"
          />
        ))}
      {region.d.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={color}
          fillOpacity={active ? 1 : dimmed ? 0.42 : 0.92}
          stroke={active ? '#ffffff' : 'rgba(0,0,0,0.4)'}
          strokeWidth={active ? 2.2 : 1.2}
          className={cn('transition-all duration-150', !active && 'hover:brightness-125')}
        />
      ))}
    </g>
  );
}

export function MuscleMap({
  selected,
  onSelect,
  className,
  showLegend = true,
  showChips = true,
}: {
  selected: ExerciseMuscle | null;
  onSelect: (m: ExerciseMuscle) => void;
  className?: string;
  /** Category color legend under the figure. */
  showLegend?: boolean;
  /** Per-muscle chip selector (also the keyboard path). */
  showChips?: boolean;
}) {
  const [view, setView] = useState<'front' | 'back'>('front');
  const gradId = useId();
  const silhouette = view === 'front' ? FRONT_SIL : BACK_SIL;
  const regions = view === 'front' ? FRONT : BACK;
  const musclesInView = Array.from(new Set(regions.map((r) => r.muscle))) as ExerciseMuscle[];

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* View toggle */}
      <div className="bg-secondary flex rounded-full p-1" role="tablist" aria-label="Body view">
        {(['front', 'back'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn(
              'rounded-full px-5 py-1.5 text-sm font-bold capitalize transition-colors',
              view === v
                ? 'bg-volt text-ink shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <svg
        viewBox="0 0 220 385"
        className="h-[400px] w-auto max-w-full sm:h-[480px]"
        role="group"
        aria-label={`${view} view body map — tap a muscle to see its exercises`}
      >
        <defs>
          <radialGradient id={gradId} cx="0.5" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="rgba(243,255,71,0.07)" />
            <stop offset="70%" stopColor="rgba(243,255,71,0)" />
          </radialGradient>
        </defs>
        <rect width="220" height="385" fill={`url(#${gradId})`} rx="24" />

        {/* the traced figure base — head, neck, hands, feet, gaps */}
        <g fill="#1f1f1f">
          {silhouette.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>

        {/* muscle regions, colored by category */}
        {regions.map((r) => (
          <RegionShapes
            key={`${view}-${r.muscle}`}
            region={r}
            color={MUSCLE_GROUP_COLOR[MUSCLE_GROUP[r.muscle as ExerciseMuscle]]}
            active={selected === r.muscle}
            dimmed={!!selected && selected !== r.muscle}
            onHit={() => onSelect(r.muscle as ExerciseMuscle)}
          />
        ))}
      </svg>

      {/* Category legend — the reference's exact colors */}
      <div
        className={cn('flex flex-wrap justify-center gap-x-4 gap-y-1.5', !showLegend && 'hidden')}
        aria-hidden
      >
        {MUSCLE_GROUPS.map((g) => (
          <span
            key={g.id}
            className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
            {g.label}
          </span>
        ))}
      </div>

      {/* Accessible selector (mirrors the map regions in view) */}
      <div
        className={cn('flex flex-wrap justify-center gap-2', !showChips && 'hidden')}
        role="group"
        aria-label="Muscles"
      >
        {musclesInView.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={selected === m}
            onClick={() => onSelect(m)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all',
              selected === m
                ? 'bg-secondary text-foreground ring-2'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
            style={
              selected === m
                ? ({
                    '--tw-ring-color': MUSCLE_GROUP_COLOR[MUSCLE_GROUP[m]],
                  } as React.CSSProperties)
                : undefined
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: MUSCLE_GROUP_COLOR[MUSCLE_GROUP[m]] }}
              aria-hidden
            />
            {EXERCISE_MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
