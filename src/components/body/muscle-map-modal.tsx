'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Flame, Info, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  EXERCISES,
  MUSCLE_WEEKLY_SET_TARGET,
  EXERCISE_MUSCLE_LABELS,
  EXERCISE_EQUIPMENT_LABELS,
  sessionsInRange,
  startOfWeek,
  strengthEntriesForMuscle,
  toISODate,
  weekStartOf,
  type ExerciseMuscle,
} from '@smartfit/core';
import { useStore } from '@/lib/store-context';
import { useModals } from '../dashboard/modal-context';
import { MUSCLE_GROUP_COLOR, MUSCLE_GROUP, MUSCLES } from '@/components/body/muscle-map';
import { ExerciseImage } from '@/components/exercise-image';
import { ExerciseDetailDialog } from '@/components/exercise-detail';
import { cn } from '@/lib/utils';

/** How many strength exercises make a focus routine. */
const ROUTINE_SIZE = 5;

/**
 * The muscle focus sheet — what opens after tapping a muscle on the body map.
 *
 * Editorial Axel layout: the muscle's name and group color lead, the week's
 * set progress sits in a single bold bar, and every exercise renders with its
 * animated demo GIF — tap a row for the full how-to. Distance-measured
 * conditioning (runs, swims) never appears: a set-based strength routine
 * logs reps × load (see `strengthEntriesForMuscle`). Ends with the green
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
  const [detailName, setDetailName] = useState<string | null>(null);

  const label = EXERCISE_MUSCLE_LABELS[muscle];
  const groupColor = MUSCLE_GROUP_COLOR[MUSCLE_GROUP[muscle]];

  const sets = useMemo(() => {
    // Any logged exercise that trains the muscle counts toward the weekly
    // volume — a run's sets still fatigue the quads.
    const trainsMuscle = (name: string) =>
      EXERCISES.some((e) => e.name === name && e.muscles.includes(muscle));
    const from = toISODate(startOfWeek(new Date(), weekStartOf(state)));
    const to = toISODate(new Date());
    let total = 0;
    for (const session of sessionsInRange(state, from, to)) {
      for (const ex of session.exercises ?? []) {
        if (trainsMuscle(ex.name)) total += Math.max(1, ex.sets.length);
      }
    }
    return Math.min(total, MUSCLE_WEEKLY_SET_TARGET);
  }, [state, muscle]);

  /** Strength exercises that train the muscle — runs/swims filtered out. */
  const entries = useMemo(() => strengthEntriesForMuscle(muscle), [muscle]);
  const picks = entries.slice(0, ROUTINE_SIZE);

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

  const pct = Math.round((sets / MUSCLE_WEEKLY_SET_TARGET) * 100);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hideHandle
          className="gap-0 overflow-x-clip rounded-t-[2rem] border-white/10 bg-[#0a0a09] p-0 text-[#edebe6] shadow-2xl sm:rounded-[2rem]"
        >
          <DialogTitle className="sr-only">Body map — {label} progress</DialogTitle>

          {/* ── Stage chrome ─────────────────────────────────────────────── */}
          <div className="relative px-5 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sage text-[11px] font-bold tracking-[0.18em] uppercase">
                Train by body part
              </p>
              <button
                type="button"
                aria-label="Close map"
                onClick={() => onOpenChange(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/8 text-white/80 transition-colors hover:bg-white/15"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Muscle headline */}
            <div className="mt-1 flex items-end justify-between gap-3">
              <h2 className="font-display text-3xl leading-none font-extrabold tracking-tight">
                {label}
              </h2>
              <span
                className="mb-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
                style={{ backgroundColor: `${groupColor}22`, color: groupColor }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: groupColor }}
                  aria-hidden
                />
                {MUSCLE_GROUP[muscle] === 'upper'
                  ? 'Upper body'
                  : MUSCLE_GROUP[muscle] === 'core'
                    ? 'Core'
                    : 'Legs'}
              </span>
            </div>
            <p className="text-sage mt-1.5 flex items-center gap-1.5 text-xs">
              <Info className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              Tap an exercise for its demo and step-by-step form guide.
            </p>

            {/* Weekly set progress — one bold bar, no simulation games. */}
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold">
                  This week{' '}
                  <span className="text-sage font-medium">
                    · {MUSCLE_WEEKLY_SET_TARGET} set target
                  </span>
                </p>
                <p className="shrink-0 text-sm font-extrabold tabular-nums">
                  {sets}
                  <span className="text-sage font-medium"> / {MUSCLE_WEEKLY_SET_TARGET}</span>
                </p>
              </div>
              <div
                className="mt-2.5 h-3 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuenow={sets}
                aria-valuemin={0}
                aria-valuemax={MUSCLE_WEEKLY_SET_TARGET}
                aria-label={`Sets this week for ${label}`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${pct}%`, backgroundColor: groupColor }}
                />
              </div>
              <p className="text-sage mt-2 text-xs">
                {sets >= MUSCLE_WEEKLY_SET_TARGET
                  ? 'Weekly target complete — this muscle is fully trained.'
                  : `${MUSCLE_WEEKLY_SET_TARGET - sets} set${MUSCLE_WEEKLY_SET_TARGET - sets === 1 ? '' : 's'} until the weekly target.`}
              </p>
            </div>

            {/* Muscle switcher — re-select without leaving the sheet. */}
            <div className="relative mt-3">
              <div
                className="no-scrollbar -mx-5 flex min-w-0 snap-x gap-1.5 overflow-x-auto px-5 pb-1"
                role="group"
                aria-label="Switch muscle"
              >
                {MUSCLES.map((m) => {
                  const active = m === muscle;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelect(m)}
                      className={cn(
                        'flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                        active
                          ? 'border-white/25 bg-white/10 text-white'
                          : 'border-white/8 bg-white/[0.04] text-white/70 hover:text-white',
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: MUSCLE_GROUP_COLOR[MUSCLE_GROUP[m]] }}
                        aria-hidden
                      />
                      {EXERCISE_MUSCLE_LABELS[m]}
                    </button>
                  );
                })}
              </div>
              {/* Edge fades — the rail continues. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-[#0a0a09] to-transparent"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-[#0a0a09] to-transparent"
              />
            </div>
          </div>

          {/* ── Exercise list — every row carries its demo GIF ───────────── */}
          <div className="mt-4 px-5 pb-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-extrabold tracking-tight">
                {label} exercises
                <span className="text-sage ml-2 text-sm font-semibold">{entries.length}</span>
              </h3>
            </div>

            {entries.length === 0 ? (
              <p className="text-sage mt-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm">
                No catalog strength exercises target {label.toLowerCase()} yet.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {entries.map((e, i) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setDetailName(e.name)}
                      aria-label={`How to do ${e.name}`}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                    >
                      <ExerciseImage
                        name={e.name}
                        animated={i < 4}
                        className="h-12 w-12 shrink-0 rounded-xl"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{e.name}</span>
                        <span className="text-sage block truncate text-xs">
                          {EXERCISE_EQUIPMENT_LABELS[e.equipment]}
                          {i < ROUTINE_SIZE ? ' · in routine' : ''}
                        </span>
                      </span>
                      {i < ROUTINE_SIZE && (
                        <span className="text-sage shrink-0 text-xs font-bold tabular-nums">
                          {i < 2 ? 4 : 3} sets
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Launch CTA ───────────────────────────────────────────────── */}
          <div className="sticky bottom-0 mt-2 bg-[#0a0a09]/95 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
            <button
              type="button"
              onClick={startRoutine}
              disabled={picks.length === 0}
              className="press bg-volt flex h-13 w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold text-[#0d1102] shadow-[0_10px_30px_-10px_rgba(138,210,0,0.55)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Flame className="h-4.5 w-4.5" aria-hidden />
              Set as Today&apos;s workout
              <span className="text-xs font-bold text-[#0d1102]/70">
                · {picks.length} exercises
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* The GIF how-to — opened from any exercise row. */}
      <ExerciseDetailDialog
        name={detailName}
        open={!!detailName}
        onOpenChange={(o) => !o && setDetailName(null)}
      />
    </>
  );
}
