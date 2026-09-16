'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, PersonStanding } from 'lucide-react';
import {
  EXERCISES,
  EXERCISE_MUSCLE_LABELS,
  MUSCLE_WEEKLY_SET_TARGET,
  sessionsInRange,
  startOfWeek,
  toISODate,
  weekStartOf,
  type ExerciseMuscle,
} from '@smartfit/core';
import { useStore } from '@/lib/store-context';
import { useModals } from './modal-context';
import { MuscleMap, MUSCLE_GROUP, MUSCLE_GROUP_COLOR } from '@/components/body/muscle-map';
import { MuscleMapModal } from '@/components/body/muscle-map-modal';
import { cn } from '@/lib/utils';

/** The muscles most people train first — curated shortcuts into the map. */
const QUICK: ExerciseMuscle[] = ['chest', 'lats', 'shoulders', 'quadriceps', 'biceps'];

/**
 * The body-select training hero — the app's primary training action, surfaced
 * first on the dashboard. The interactive muscle map is the centerpiece: tap a
 * region (or a quick chip) to open the immersive progress sheet and launch a
 * ready-made focus workout for that muscle.
 */
export function BodySelectHero() {
  const { state } = useStore();
  const { openWith } = useModals();
  const [muscle, setMuscle] = useState<ExerciseMuscle>('chest');
  const [open, setOpen] = useState(false);

  // Sets logged this week per primary muscle (catalog-matched exercises).
  const setsByMuscle = useMemo(() => {
    const acc: Partial<Record<ExerciseMuscle, number>> = {};
    const from = toISODate(startOfWeek(new Date(), weekStartOf(state)));
    const to = toISODate(new Date());
    for (const session of sessionsInRange(state, from, to)) {
      for (const ex of session.exercises ?? []) {
        const entry = EXERCISES.find((e) => e.name === ex.name);
        const primary = entry?.muscles[0];
        if (primary) acc[primary] = (acc[primary] ?? 0) + Math.max(1, ex.sets.length);
      }
    }
    return acc;
  }, [state]);

  function select(m: ExerciseMuscle) {
    setMuscle(m);
    setOpen(true);
  }

  return (
    <section className="bg-charcoal relative overflow-hidden rounded-3xl p-5 text-white shadow-sm sm:p-7 lg:col-span-2">
      {/* Stage glow behind the figure */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background: 'radial-gradient(60% 80% at 78% 30%, rgba(156,255,0,0.10), transparent 70%)',
        }}
      />
      <div className="relative grid items-center gap-6 sm:grid-cols-2">
        {/* Copy + quick picks */}
        <div className="order-2 flex flex-col items-start sm:order-1">
          <span className="text-volt inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold tracking-[0.18em] uppercase">
            <PersonStanding className="h-3.5 w-3.5" aria-hidden /> Train by body part
          </span>
          <h2 className="font-display mt-3 text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
            Touch a muscle.
            <br className="hidden sm:block" /> Train it today.
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/65">
            The body map shows this week&apos;s volume for every muscle. Tap any region to see the
            exercises that hit it and start a focus workout in one tap.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.map((m) => {
              const sets = setsByMuscle[m] ?? 0;
              const complete = sets >= MUSCLE_WEEKLY_SET_TARGET;
              const active = muscle === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => select(m)}
                  aria-pressed={active}
                  className={cn(
                    'group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition-all',
                    active
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: MUSCLE_GROUP_COLOR[MUSCLE_GROUP[m]] }}
                    aria-hidden
                  />
                  {EXERCISE_MUSCLE_LABELS[m]}
                  {sets > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                        complete ? 'bg-volt text-ink' : 'bg-white/10 text-white/70',
                      )}
                    >
                      {sets}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Link
            href="/dashboard/body"
            className="text-volt mt-5 inline-flex items-center gap-1.5 text-sm font-bold transition-colors hover:gap-2.5"
          >
            Open the full body map
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {/* The map */}
        <div className="order-1 flex justify-center sm:order-2">
          <MuscleMap
            selected={muscle}
            onSelect={select}
            compact
            showChips={false}
            className="w-full max-w-xs"
          />
        </div>
      </div>

      <MuscleMapModal open={open} onOpenChange={setOpen} muscle={muscle} onSelect={setMuscle} />
    </section>
  );
}
