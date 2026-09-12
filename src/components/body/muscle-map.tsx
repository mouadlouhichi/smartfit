'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ExerciseMuscle } from '@smartfit/core';
import { EXERCISE_MUSCLE_LABELS } from '@smartfit/core';

/**
 * The interactive muscle map — the "select body, get exercises" picker.
 *
 * A stylised vector mannequin in two views (front / back). Every tappable
 * region maps 1:1 to an `ExerciseMuscle` from the shared catalog, so the
 * selection drives the exercise list rendered next to it. Regions mirror
 * left/right from one path definition; keyboard users get the same action
 * via the chip row rendered beside the map (each chip is a real button).
 */

type Region = {
  /** Catalog muscle this region selects. */
  muscle: ExerciseMuscle;
  /** Right-side path in the 220×470 box; mirrored for the left side. */
  d: string;
  /** Also render the mirrored copy (limb pairs, pecs, glutes…). */
  mirror?: boolean;
};

const FRONT: Region[] = [
  {
    muscle: 'traps',
    d: 'M97 62 Q110 70 123 62 L143 82 Q127 94 110 95 Q93 94 77 82 Z',
  },
  {
    muscle: 'shoulders',
    d: 'M76 84 Q60 88 55 102 Q56 116 70 120 Q80 112 81 98 Z',
    mirror: true,
  },
  {
    muscle: 'chest',
    d: 'M104 98 Q86 98 78 108 Q76 128 92 136 Q103 132 105 118 Z',
    mirror: true,
  },
  {
    muscle: 'biceps',
    d: 'M66 126 Q56 130 53 144 Q54 158 64 163 Q72 158 73 143 Z',
    mirror: true,
  },
  {
    muscle: 'forearms',
    d: 'M52 168 Q44 184 44 202 Q46 216 54 222 Q61 217 62 202 Q60 184 60 172 Z',
    mirror: true,
  },
  {
    muscle: 'abdominals',
    d: 'M107 140 Q94 142 90 154 Q90 180 100 200 L107 204 Z',
    mirror: true,
  },
  {
    muscle: 'quadriceps',
    d: 'M83 232 Q70 252 70 288 Q73 318 86 334 Q98 326 100 294 Q99 258 97 236 Z',
    mirror: true,
  },
  {
    muscle: 'calves',
    d: 'M80 346 Q71 362 73 388 Q76 406 86 412 Q94 406 95 388 Q94 364 92 350 Z',
    mirror: true,
  },
];

const BACK: Region[] = [
  {
    muscle: 'traps',
    d: 'M110 60 Q90 74 82 96 Q94 114 110 118 Q126 114 138 96 Q130 74 110 60 Z',
  },
  {
    muscle: 'lats',
    d: 'M105 120 Q88 122 79 138 Q77 160 88 176 Q99 180 105 168 Z',
    mirror: true,
  },
  {
    muscle: 'middle back',
    d: 'M104 122 L116 122 L116 176 Q110 182 104 176 Z',
  },
  {
    muscle: 'lower back',
    d: 'M97 182 Q93 202 101 220 L119 220 Q127 202 123 182 Q110 190 97 182 Z',
  },
  {
    muscle: 'triceps',
    d: 'M66 126 Q56 130 53 144 Q54 158 64 163 Q72 158 73 143 Z',
    mirror: true,
  },
  {
    muscle: 'glutes',
    d: 'M82 226 Q68 238 70 260 Q75 276 92 276 Q104 272 105 254 Q104 236 98 228 Z',
    mirror: true,
  },
  {
    muscle: 'hamstrings',
    d: 'M78 284 Q69 302 72 330 Q77 348 89 352 Q97 344 97 316 Q93 296 90 288 Z',
    mirror: true,
  },
  {
    muscle: 'calves',
    d: 'M79 358 Q71 374 74 398 Q78 414 88 418 Q96 412 96 394 Q95 370 92 360 Z',
    mirror: true,
  },
];

/* Shared silhouette (drawn once per view, behind the muscle regions). */
function Silhouette() {
  return (
    <g fill="#1b1b1b" stroke="#2b2b2b" strokeWidth="1.5">
      <ellipse cx="110" cy="33" rx="15" ry="18" />
      <rect x="101" y="47" width="18" height="14" rx="6" />
      {/* torso */}
      <path d="M79 62 Q110 54 141 62 L147 108 Q149 158 137 204 Q124 222 110 224 Q96 222 83 204 Q71 158 73 108 Z" />
      {/* arms */}
      <path d="M76 63 Q59 71 55 94 L49 148 Q45 184 47 212 Q49 230 57 236 Q65 233 64 218 Q62 194 67 166 L73 118 Q76 96 76 63 Z" />
      <path
        d="M76 63 Q59 71 55 94 L49 148 Q45 184 47 212 Q49 230 57 236 Q65 233 64 218 Q62 194 67 166 L73 118 Q76 96 76 63 Z"
        transform="translate(220 0) scale(-1 1)"
      />
      <ellipse cx="53" cy="240" rx="8" ry="10" />
      <ellipse cx="167" cy="240" rx="8" ry="10" />
      {/* legs */}
      <path d="M81 222 Q68 258 68 300 L73 362 Q75 412 82 440 Q92 444 97 437 L97 362 L101 300 L103 238 Z" />
      <path
        d="M81 222 Q68 258 68 300 L73 362 Q75 412 82 440 Q92 444 97 437 L97 362 L101 300 L103 238 Z"
        transform="translate(220 0) scale(-1 1)"
      />
      <ellipse cx="87" cy="446" rx="11" ry="6" />
      <ellipse cx="133" cy="446" rx="11" ry="6" />
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
        viewBox="0 0 220 470"
        className="h-[380px] w-auto max-w-full sm:h-[440px]"
        role="group"
        aria-label={`${view} view body map — tap a muscle to see its exercises`}
      >
        <defs>
          <radialGradient id={gradId} cx="0.5" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="rgba(243,255,71,0.08)" />
            <stop offset="70%" stopColor="rgba(243,255,71,0)" />
          </radialGradient>
        </defs>
        <rect width="220" height="470" fill={`url(#${gradId})`} rx="24" />
        <Silhouette />
        {regions.map((r) => {
          const active = selected === r.muscle;
          const paths = [
            <path key="base" d={r.d} />,
            ...(r.mirror
              ? [<path key="mir" d={r.d} transform="translate(220 0) scale(-1 1)" />]
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
              {paths.map((p, i) => (
                <path
                  key={i}
                  d={p.props.d}
                  transform={p.props.transform}
                  fill={active ? '#f3ff47' : undefined}
                  className={cn(
                    'transition-colors duration-150',
                    !active &&
                      'fill-[#2f2f2f] stroke-[#484848] hover:fill-[#4a5117] hover:stroke-[#5d661d]',
                    active && 'fill-[#f3ff47] stroke-[#101010]',
                  )}
                  strokeWidth={active ? 2 : 1.5}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Accessible legend / alternative selector */}
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Muscles">
        {musclesInView.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={selected === m}
            onClick={() => onSelect(m)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
              selected === m
                ? 'bg-volt text-ink'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {EXERCISE_MUSCLE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}
