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
    'M72 58 Q54 66 48 90 L44 148 Q42 184 45 214 Q46 230 54 236 Q63 232 61 216 Q58 188 62 160 L68 112 Q69 84 72 58 Z';
  const leg =
    'M80 218 Q66 254 67 296 L72 360 Q74 410 81 438 Q92 442 97 434 L96 360 L100 296 L102 234 Z';
  return (
    <g fill="#1b1b1b" stroke="#2e2e2e" strokeWidth="1.5">
      {/* head + neck */}
      <ellipse cx="110" cy="30" rx="15" ry="18" />
      <path d="M100 44 L120 44 L122 58 Q110 64 98 58 Z" />
      {/* torso — V-taper */}
      <path d="M76 56 Q110 48 144 56 L149 100 Q150 146 139 194 Q127 216 110 218 Q93 216 81 194 Q70 146 71 100 Z" />
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
    d: 'M97 54 Q110 60 123 54 L133 70 Q122 78 110 79 Q98 78 87 70 Z',
  },
  {
    muscle: 'shoulders',
    d: 'M86 58 Q70 62 64 78 Q61 92 70 102 Q79 98 83 87 Q87 72 86 58 Z',
    mirror: true,
  },
  {
    muscle: 'chest',
    d: 'M106 88 Q94 86 84 92 Q76 97 76 110 Q77 126 87 134 Q97 139 105 132 Q109 122 109 104 Z',
    mirror: true,
  },
  {
    muscle: 'biceps',
    d: 'M63 110 Q54 116 52 130 Q51 146 57 158 Q63 162 66 152 Q69 138 69 122 Q69 114 63 110 Z',
    mirror: true,
  },
  {
    muscle: 'forearms',
    d: 'M53 168 Q47 184 46 202 Q46 214 51 221 Q57 219 59 208 Q61 190 63 178 Q63 171 58 168 Z',
    mirror: true,
  },
  {
    muscle: 'abdominals',
    d: 'M95 144 Q110 148 125 144 Q128 164 124 182 Q120 199 110 207 Q100 199 96 182 Q92 164 95 144 Z',
  },
  {
    muscle: 'quadriceps',
    d: 'M79 228 Q69 254 70 288 Q72 314 83 332 Q94 326 96 296 Q95 258 91 238 Q86 230 79 228 Z',
    mirror: true,
  },
];

const BACK: Region[] = [
  {
    muscle: 'traps',
    d: 'M110 52 Q97 60 91 82 Q99 98 110 102 Q121 98 129 82 Q123 60 110 52 Z',
  },
  {
    muscle: 'shoulders',
    d: 'M86 58 Q70 62 64 78 Q61 92 70 102 Q79 98 83 87 Q87 72 86 58 Z',
    mirror: true,
  },
  {
    muscle: 'lats',
    d: 'M105 106 Q90 110 82 124 Q78 144 88 160 Q97 167 104 158 Q106 132 105 106 Z',
    mirror: true,
  },
  {
    muscle: 'middle back',
    d: 'M105 108 L115 108 L115 160 Q110 165 105 160 Z',
  },
  {
    muscle: 'lower back',
    d: 'M99 166 Q95 184 101 200 L119 200 Q125 184 121 166 Q110 172 99 166 Z',
  },
  {
    muscle: 'triceps',
    d: 'M63 110 Q54 116 52 130 Q51 146 57 158 Q63 162 66 152 Q69 138 69 122 Q69 114 63 110 Z',
    mirror: true,
  },
  {
    muscle: 'forearms',
    d: 'M53 168 Q47 184 46 202 Q46 214 51 221 Q57 219 59 208 Q61 190 63 178 Q63 171 58 168 Z',
    mirror: true,
  },
  {
    muscle: 'glutes',
    d: 'M80 214 Q68 224 70 246 Q73 262 87 264 Q97 260 99 242 Q98 224 92 216 Z',
    mirror: true,
  },
  {
    muscle: 'hamstrings',
    d: 'M76 272 Q68 296 70 322 Q73 342 84 348 Q94 342 95 318 Q92 292 87 278 Z',
    mirror: true,
  },
  {
    muscle: 'calves',
    d: 'M75 348 Q68 368 70 392 Q73 410 83 416 Q92 410 92 394 Q91 372 87 356 Z',
    mirror: true,
  },
];

/** Decorative ab segmentation over the abdominals region (front view). */
function AbLines() {
  return (
    <g stroke="rgba(0,0,0,0.42)" strokeWidth="1.5" fill="none" pointerEvents="none">
      <path d="M110 146 V204" />
      <path d="M96 160 Q110 163 124 160" />
      <path d="M95 176 Q110 179 125 176" />
      <path d="M96.5 191 Q110 194 123.5 191" />
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
