'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Info, SlidersHorizontal, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  EXERCISES,
  MUSCLE_WEEKLY_SET_TARGET,
  EXERCISE_MUSCLE_LABELS,
  sessionsInRange,
  startOfWeek,
  toISODate,
  weekStartOf,
  type ExerciseMuscle,
} from '@smartfit/core';
import { useStore } from '@/lib/store-context';
import { useModals } from '../dashboard/modal-context';
import { MuscleMap, MUSCLE_GROUP_COLOR, MUSCLE_GROUP } from '@/components/body/muscle-map';
import { cn } from '@/lib/utils';

/**
 * The immersive muscle-map sheet — the reference "select body" screen.
 *
 * Full-bleed graphite stage: info/close chrome, the tri-color body, and a
 * "Your progress" bottom card for the selected muscle (gradient set strip,
 * the routine's exercise rows with per-exercise set counts) ending in the
 * "Set as Today's workout" pill that launches the guided runner.
 */
export function MuscleMapModal({
  open,
  onOpenChange,
  muscle,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  muscle: ExerciseMuscle;
  onSelect: (m: ExerciseMuscle) => void;
}) {
  const { state } = useStore();
  const { openWith } = useModals();
  const [showInfo, setShowInfo] = useState(false);
  const [sim, setSim] = useState(false);

  const label = EXERCISE_MUSCLE_LABELS[muscle];
  const groupColor = MUSCLE_GROUP_COLOR[MUSCLE_GROUP[muscle]];

  const sets = useMemo(() => {
    if (sim) return MUSCLE_WEEKLY_SET_TARGET;
    const from = toISODate(startOfWeek(new Date(), weekStartOf(state)));
    const to = toISODate(new Date());
    let total = 0;
    for (const session of sessionsInRange(state, from, to)) {
      for (const ex of session.exercises ?? []) {
        const entry = EXERCISES.find((e) => e.name === ex.name);
        if (entry?.muscles.includes(muscle)) total += Math.max(1, ex.sets.length);
      }
    }
    return Math.min(total, MUSCLE_WEEKLY_SET_TARGET);
  }, [state, muscle, sim]);

  const picks = useMemo(
    () =>
      EXERCISES.filter((e) => e.muscles.includes(muscle))
        .sort(
          (a, b) =>
            (a.muscles[0] === muscle ? 0 : 1) - (b.muscles[0] === muscle ? 0 : 1) ||
            (b.popular ? 1 : 0) - (a.popular ? 1 : 0),
        )
        .slice(0, 4),
    [muscle],
  );

  function startRoutine() {
    if (picks.length === 0) return;
    openWith({
      kind: 'runner',
      title: `${label} focus`,
      categoryId: 'cat-strength',
      intensity: 'moderate',
      exercises: picks.map((e, i) => ({
        name: e.name,
        sets: Array.from({ length: i < 2 ? 4 : 3 }, () => ({})),
      })),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideHandle
        className="max-w-md gap-0 rounded-t-[2rem] border-white/10 bg-[#141414] p-0 text-[#f5f5f2] shadow-2xl sm:rounded-[2rem]"
      >
        <DialogTitle className="sr-only">Body map — {label} progress</DialogTitle>

        {/* ── Stage chrome ─────────────────────────────────────────────── */}
        <div className="relative px-3 pt-3">
          <button
            type="button"
            aria-label={showInfo ? 'Hide map info' : 'What is this map?'}
            aria-expanded={showInfo}
            onClick={() => setShowInfo((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white/80 transition-colors hover:bg-white/15"
          >
            <Info className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Close map"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white/80 transition-colors hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>

          {showInfo && (
            <p
              role="note"
              className="absolute inset-x-14 top-14 z-10 rounded-2xl bg-white/8 p-3 text-xs leading-relaxed text-white/75"
            >
              Every muscle is colored by group — green upper body, blue core, yellow legs. Tap a
              muscle to load its week and exercises.
            </p>
          )}

          {/* the body — tap to re-select inside the modal too */}
          <MuscleMap
            selected={muscle}
            onSelect={(m) => {
              onSelect(m);
              setSim(false);
            }}
            showLegend={false}
            showChips={false}
            className="pt-1"
          />
        </div>

        {/* ── Your progress card ──────────────────────────────────────── */}
        <div className="rounded-t-[1.75rem] border-t border-white/8 bg-[#1b1b1b] px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-extrabold tracking-tight">Your progress</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={sim}
                onClick={() => setSim((v) => !v)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
                  sim ? 'bg-[#9cff00] text-[#141414]' : 'bg-white/8 text-white/70 hover:text-white',
                )}
              >
                Sim. today
              </button>
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-white/70"
                aria-hidden
              >
                <SlidersHorizontal className="h-4 w-4" />
              </span>
            </div>
          </div>

          {/* focus zone */}
          <div className="mt-3 rounded-2xl border border-white/8 bg-white/5 p-4">
            <p
              className="text-[11px] font-bold tracking-[0.18em] uppercase"
              style={{ color: groupColor }}
            >
              {label}
            </p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: groupColor }}
                    aria-hidden
                  />
                  Focus zone
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  {sets >= MUSCLE_WEEKLY_SET_TARGET
                    ? 'Weekly target complete'
                    : `${MUSCLE_WEEKLY_SET_TARGET - sets} sets until done`}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums">
                {sets} sets{' '}
                <span className="font-medium text-white/55">of {MUSCLE_WEEKLY_SET_TARGET}</span>
              </p>
            </div>

            {/* segmented gradient strip (blue → green → yellow, like the body) */}
            <div
              className="mt-3 flex gap-1"
              role="progressbar"
              aria-valuenow={sets}
              aria-valuemin={0}
              aria-valuemax={MUSCLE_WEEKLY_SET_TARGET}
              aria-label={`Sets this week for ${label}`}
            >
              {Array.from({ length: MUSCLE_WEEKLY_SET_TARGET }, (_, i) => {
                const t = i / (MUSCLE_WEEKLY_SET_TARGET - 1);
                const filled = i < sets;
                return (
                  <span
                    key={i}
                    className="h-2 flex-1 rounded-full"
                    style={{
                      backgroundColor: filled ? gradientStop(t) : 'rgba(255,255,255,0.12)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* routine rows */}
          <ul className="mt-3 grid gap-2">
            {picks.map((e, i) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 px-4 py-3"
              >
                <span className="truncate text-sm font-bold">{e.name}</span>
                <span className="shrink-0 text-xs font-semibold text-white/55">
                  {i < 2 ? 4 : 3} sets
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={startRoutine}
            disabled={picks.length === 0}
            className="press mt-4 h-13 w-full rounded-full bg-white text-[15px] font-extrabold text-[#141414] shadow-xl transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            Set as Today&apos;s workout
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Color along the reference strip: core blue → upper green → legs yellow. */
function gradientStop(t: number): string {
  const stops: readonly (readonly [number, readonly [number, number, number]])[] = [
    [0, [0x1e, 0x8f, 0xff]],
    [0.5, [0x3a, 0xc1, 0x4e]],
    [1, [0xff, 0xc5, 0x31]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const k = (t - lo[0]) / span;
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
