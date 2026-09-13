'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ExerciseMuscle } from '@smartfit/core';
import { EXERCISE_MUSCLE_LABELS } from '@smartfit/core';

/**
 * The interactive muscle map — the "select body, get exercises" picker.
 *
 * Faithful to the reference: an anatomical mannequin whose muscles are
 * always colored by category — green (upper body), blue (core), yellow
 * (legs) — over a near-black figure. The selected region gets a white
 * ring + glow; everything stays colored, like the reference render.
 * Regions mirror left/right; the chip legend below is the keyboard and
 * screen-reader path to the same selection.
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

const MUSCLE_GROUP: Record<ExerciseMuscle, keyof typeof MUSCLE_GROUP_COLOR> = {
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

type Region = {
  muscle: ExerciseMuscle;
  /** Right-side path in the 220×480 box; mirrored for the left side. */
  d: string;
  /** Also render the mirrored copy (limb pairs, pecs, glutes…). */
  mirror?: boolean;
};

/* ── shared anatomical base: head, neck, torso, limbs (both views) ─────── */
function Silhouette() {
  const arm =
    'M75 58 Q58 66 53 88 L47 144 Q43 180 45 210 Q46 228 54 234 Q62 231 61 216 Q59 190 64 162 L70 114 Q71 92 75 58 Z';
  const leg =
    'M80 218 Q66 256 67 298 L72 362 Q74 412 81 440 Q91 444 96 436 L96 362 L100 298 L102 236 Z';
  return (
    <g fill="#1b1b1b" stroke="#2e2e2e" strokeWidth="1.5">
      {/* head + neck */}
      <ellipse cx="110" cy="30" rx="15" ry="18" />
      <path d="M100 44 L120 44 L122 58 Q110 64 98 58 Z" />
      {/* torso — V-taper */}
      <path d="M79 56 Q110 48 141 56 L146 102 Q147 150 136 198 Q124 218 110 220 Q96 218 84 198 Q73 150 74 102 Z" />
      {/* arms + hands */}
      <path d={arm} />
      <path d={arm} transform="translate(220 0) scale(-1 1)" />
      <ellipse cx="52" cy="242" rx="7" ry="10" />
      <ellipse cx="168" cy="242" rx="7" ry="10" />
      {/* legs + feet */}
      <path d={leg} />
      <path d={leg} transform="translate(220 0) scale(-1 1)" />
      <ellipse cx="86" cy="448" rx="10" ry="6" />
      <ellipse cx="134" cy="448" rx="10" ry="6" />
    </g>
  );
}

const FRONT: Region[] = [
  {
    muscle: 'traps',
    d: 'M96 56 Q110 62 124 56 L132 72 Q121 79 110 80 Q99 79 88 72 Z',
  },
  {
    muscle: 'shoulders',
    d: 'M84 60 Q72 66 72 82 Q73 96 82 102 Q88 94 88 80 Q88 68 84 60 Z',
    mirror: true,
  },
  {
    muscle: 'chest',
    d: 'M107 86 Q95 86 88 94 Q86 108 96 116 Q103 113 107 104 Z',
    mirror: true,
  },
  {
    muscle: 'biceps',
    d: 'M62 112 Q55 118 53 130 Q52 142 58 148 Q64 144 66 134 Q68 122 66 113 Z',
    mirror: true,
  },
  {
    muscle: 'forearms',
    d: 'M52 156 Q46 172 45 192 Q45 206 50 213 Q56 211 58 200 Q60 182 61 170 Q61 162 57 157 Z',
    mirror: true,
  },
  {
    muscle: 'abdominals',
    d: 'M98 126 Q110 130 122 126 Q125 148 121 168 Q117 186 110 193 Q103 186 99 168 Q95 148 98 126 Z',
  },
  {
    muscle: 'quadriceps',
    d: 'M78 232 Q70 262 72 296 Q74 320 84 336 Q94 328 96 300 Q95 264 92 242 Q85 235 78 232 Z',
    mirror: true,
  },
];

const BACK: Region[] = [
  {
    muscle: 'traps',
    d: 'M110 54 Q98 62 92 82 Q99 98 110 102 Q121 98 128 82 Q122 62 110 54 Z',
  },
  {
    muscle: 'shoulders',
    d: 'M84 60 Q72 66 72 82 Q73 96 82 102 Q88 94 88 80 Q88 68 84 60 Z',
    mirror: true,
  },
  {
    muscle: 'lats',
    d: 'M106 108 Q92 112 84 126 Q81 146 90 162 Q99 168 105 160 Q107 136 106 108 Z',
    mirror: true,
  },
  {
    muscle: 'middle back',
    d: 'M106 110 L114 110 L114 160 Q110 165 106 160 Z',
  },
  {
    muscle: 'lower back',
    d: 'M99 166 Q95 184 101 200 L119 200 Q125 184 121 166 Q110 172 99 166 Z',
  },
  {
    muscle: 'triceps',
    d: 'M62 112 Q55 118 53 130 Q52 142 58 148 Q64 144 66 134 Q68 122 66 113 Z',
    mirror: true,
  },
  {
    muscle: 'forearms',
    d: 'M52 156 Q46 172 45 192 Q45 206 50 213 Q56 211 58 200 Q60 182 61 170 Q61 162 57 157 Z',
    mirror: true,
  },
  {
    muscle: 'glutes',
    d: 'M80 216 Q69 226 71 248 Q75 264 88 266 Q98 262 100 244 Q98 226 93 218 Z',
    mirror: true,
  },
  {
    muscle: 'hamstrings',
    d: 'M76 274 Q69 296 71 322 Q74 342 85 348 Q94 342 95 318 Q92 294 87 280 Z',
    mirror: true,
  },
  {
    muscle: 'calves',
    d: 'M75 356 Q68 376 71 398 Q74 414 84 418 Q92 412 92 396 Q91 374 87 360 Z',
    mirror: true,
  },
];

/** Decorative ab segmentation over the abdominals region (front view). */
function AbLines() {
  return (
    <g stroke="rgba(0,0,0,0.4)" strokeWidth="1.4" fill="none" pointerEvents="none">
      <path d="M110 131 V196" />
      <path d="M98 148 Q110 151 122 148" />
      <path d="M97.5 164 Q110 167 122.5 164" />
      <path d="M99 180 Q110 183 121 180" />
    </g>
  );
}

export function MuscleMap({
  selected,
  onSelect,
  className,
}: {
  selected: ExerciseMuscle | null;
  onSelect: (m: ExerciseMuscle) => void;
  className?: string;
}) {
  const [view, setView] = useState<'front' | 'back'>('front');
  const gradId = useId();
  const regions = view === 'front' ? FRONT : BACK;
  const musclesInView = Array.from(new Set(regions.map((r) => r.muscle)));

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
        viewBox="0 0 220 480"
        className="h-[380px] w-auto max-w-full sm:h-[460px]"
        role="group"
        aria-label={`${view} view body map — tap a muscle to see its exercises`}
      >
        <defs>
          <radialGradient id={gradId} cx="0.5" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="rgba(243,255,71,0.07)" />
            <stop offset="70%" stopColor="rgba(243,255,71,0)" />
          </radialGradient>
        </defs>
        <rect width="220" height="480" fill={`url(#${gradId})`} rx="24" />
        <Silhouette />

        {regions.map((r) => {
          const active = selected === r.muscle;
          const color = MUSCLE_GROUP_COLOR[MUSCLE_GROUP[r.muscle]];
          const paths = [
            { key: 'base', d: r.d, transform: undefined as string | undefined },
            ...(r.mirror
              ? [{ key: 'mir', d: r.d, transform: 'translate(220 0) scale(-1 1)' as const }]
              : []),
          ];
          return (
            <g
              key={`${view}-${r.muscle}`}
              role="button"
              tabIndex={0}
              aria-label={EXERCISE_MUSCLE_LABELS[r.muscle]}
              aria-pressed={active}
              onClick={() => onSelect(r.muscle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(r.muscle);
                }
              }}
              className="muscle-region cursor-pointer outline-none"
            >
              {/* selection glow */}
              {active &&
                paths.map((p) => (
                  <path
                    key={`glow-${p.key}`}
                    d={p.d}
                    transform={p.transform}
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="7"
                    pointerEvents="none"
                  />
                ))}
              {paths.map((p) => (
                <path
                  key={p.key}
                  d={p.d}
                  transform={p.transform}
                  fill={color}
                  fillOpacity={active ? 1 : selected ? 0.42 : 0.92}
                  stroke={active ? '#ffffff' : 'rgba(0,0,0,0.4)'}
                  strokeWidth={active ? 2.2 : 1.4}
                  className={cn('transition-all duration-150', !active && 'hover:brightness-125')}
                />
              ))}
              {r.muscle === 'abdominals' && view === 'front' && <AbLines />}
            </g>
          );
        })}
      </svg>

      {/* Category legend — the reference's exact colors */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5" aria-hidden>
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
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Muscles">
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
