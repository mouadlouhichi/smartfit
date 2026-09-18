'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * Exercises the athlete has explicitly picked for the routine. `null` means
   * "untouched", so the sheet falls back to the curated top-`ROUTINE_SIZE`.
   * Tapping a row toggles it in or out; the CTA launches exactly this set.
   */
  const [picked, setPicked] = useState<string[] | null>(null);
  /** The selected chip and its rail, so the rail can centre it. */
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

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

  // A new muscle (or a reopened sheet) starts from the curated routine again.
  useEffect(() => {
    setPicked(null);
  }, [muscle, open]);

  // The switcher rail is long; keep the current muscle visible rather than
  // leaving it clipped off the left edge. scrollIntoView is deliberately not
  // used: it walks every scrollable ancestor (yanking the sheet itself) and
  // fires before the chip has its final geometry.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const chip = activeChipRef.current;
      const rail = railRef.current;
      if (!chip || !rail) return;
      const target = chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
    });
    return () => cancelAnimationFrame(raf);
  }, [muscle, open]);

  const defaultPicks = useMemo(() => entries.slice(0, ROUTINE_SIZE).map((e) => e.name), [entries]);
  const selectedNames = picked ?? defaultPicks;
  const isPicked = (name: string) => selectedNames.includes(name);
  const picks = entries.filter((e) => isPicked(e.name));

  function toggle(name: string) {
    setPicked((current) => {
      const base = current ?? defaultPicks;
      return base.includes(name) ? base.filter((n) => n !== name) : [...base, name];
    });
  }

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
              <h2 className="title-italic text-[2rem] min-[380px]:text-[2.25rem]">{label}</h2>
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
                ref={railRef}
                className="no-scrollbar -mx-5 flex min-w-0 snap-x scroll-px-5 gap-1.5 overflow-x-auto px-5 pb-1"
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
                      ref={active ? activeChipRef : undefined}
                      onClick={() => onSelect(m)}
                      className={cn(
                        'flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors',
                        active
                          ? 'border-volt bg-volt text-[#0d1102]'
                          : 'border-white/8 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white',
                      )}
                    >
                      {!active && (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: MUSCLE_GROUP_COLOR[MUSCLE_GROUP[m]] }}
                          aria-hidden
                        />
                      )}
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
              <h3 className="flex min-w-0 items-center gap-2 text-base font-extrabold tracking-tight">
                <span className="truncate">{label} exercises</span>
                <span className="text-sage shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-xs font-bold tabular-nums">
                  {entries.length}
                </span>
              </h3>
              <p
                aria-live="polite"
                className={cn(
                  'shrink-0 text-xs font-bold tabular-nums transition-colors',
                  picks.length > 0 ? 'text-volt' : 'text-sage',
                )}
              >
                {picks.length} selected
              </p>
            </div>

            {entries.length === 0 ? (
              <p className="text-sage mt-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-sm">
                No catalog strength exercises target {label.toLowerCase()} yet.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2.5">
                {entries.map((e, i) => {
                  const on = isPicked(e.name);
                  const order = selectedNames.indexOf(e.name);
                  return (
                    <li key={e.id}>
                      {/* The row toggles selection; the chevron opens the
                          how-to. Two actions, so they are two buttons. */}
                      <div
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border p-2.5 transition-colors',
                          on
                            ? 'border-volt/45 bg-volt/[0.08] shadow-[inset_0_0_0_1px_rgba(138,210,0,0.12)]'
                            : 'border-white/8 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]',
                        )}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggle(e.name)}
                          aria-label={`${on ? 'Remove' : 'Add'} ${e.name} ${on ? 'from' : 'to'} the routine`}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="relative block shrink-0">
                            <ExerciseImage
                              name={e.name}
                              animated={i < 4}
                              className="exercise-demo-tile--dark h-14 w-14 rounded-xl bg-white"
                            />
                            <span
                              aria-hidden
                              className={cn(
                                'absolute -top-1.5 -left-1.5 grid h-5 w-5 place-items-center rounded-full border text-[10px] font-extrabold transition-colors',
                                on
                                  ? 'bg-volt border-volt text-[#0d1102]'
                                  : 'border-white/25 bg-[#0a0a09] text-transparent',
                              )}
                            >
                              {on ? order + 1 : ''}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm leading-snug font-bold text-balance">
                              {e.name}
                            </span>
                            <span className="text-sage mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
                              <span className="truncate">
                                {EXERCISE_EQUIPMENT_LABELS[e.equipment]}
                              </span>
                              {on && (
                                <span className="text-volt shrink-0 font-bold tabular-nums">
                                  · {order < 2 ? 4 : 3} sets
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailName(e.name)}
                          aria-label={`How to do ${e.name}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Launch CTA ───────────────────────────────────────────────── */}
          <div className="sticky bottom-0 mt-2 bg-[#0a0a09]/95 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
            <button
              type="button"
              onClick={startRoutine}
              disabled={picks.length === 0}
              className="press btn-volt flex h-13 w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Flame className="h-4.5 w-4.5" aria-hidden />
              {picks.length === 0 ? 'Pick an exercise' : "Set as Today's workout"}
              {picks.length > 0 && (
                <span className="text-xs font-bold text-[#0d1102]/70">
                  · {picks.length} exercise{picks.length === 1 ? '' : 's'}
                </span>
              )}
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
