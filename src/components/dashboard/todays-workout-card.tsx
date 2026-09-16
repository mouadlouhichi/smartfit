'use client';

import { useMemo, useState } from 'react';
import { Dumbbell, Flame } from 'lucide-react';
import {
  EXERCISE_MUSCLE_LABELS,
  MUSCLE_WEEKLY_SET_TARGET,
  allExercises,
  categoryById,
  currentStreak,
  formatMinutes,
  matchExercise,
  sessionsInRange,
  startOfWeek,
  toISODate,
  weekStartOf,
  type ExerciseMuscle,
  type Intensity,
  type ScheduledWorkout,
  type WorkoutExercise,
} from '@smartfit/core';
import { useStore } from '@/lib/store-context';
import { useModals } from './modal-context';
import { MUSCLE_GROUP, MUSCLE_GROUP_COLOR } from '@/components/body/muscle-map';
import { cn } from '@/lib/utils';

/**
 * Today's workout — the reference workout-day sheet, embedded on the
 * dashboard: a day switcher ("Push day | Legs day | …"), the date and
 * duration, a streak tile ("N days of growth"), per-muscle cards with the
 * tri-color dot meter, the routine's exercise rows with set counts, and
 * the white "Set as Today's workout" pill that launches the guided runner.
 *
 * A day's routine comes from its scheduled slot when the user configured
 * one; otherwise the split is derived from the title (push / pull / legs…)
 * and a routine is suggested from the exercise catalog — the same
 * suggestion path the muscle map uses.
 */

/* Title keywords → the split that day trains (order = card order). */
function splitForTitle(title: string): ExerciseMuscle[] | null {
  const t = title.toLowerCase();
  if (/\bpush\b/.test(t)) return ['chest', 'shoulders', 'triceps'];
  if (/\bpull\b/.test(t)) return ['lats', 'traps', 'biceps', 'middle back'];
  if (/\blegs?\b|\blower\b/.test(t)) return ['quadriceps', 'hamstrings', 'glutes', 'calves'];
  if (/\bfull\b|\bbody\b/.test(t)) return ['chest', 'lats', 'quadriceps', 'abdominals'];
  if (/\bhiit\b|\binterval\b|\bcircuit\b/.test(t)) return ['quadriceps', 'abdominals', 'shoulders'];
  if (
    /\brun\b|\bjog\b|\bcardio\b|\bfootball\b|\bsoccer\b|\bsport\b|\bcycl|\bswim\b|\bwalk\b/.test(t)
  )
    return null; // cardio day — no resistance split to show
  return ['chest', 'lats', 'quadriceps'];
}

/* Suggest a routine for a split: the most popular lift per muscle. */
function suggestRoutine(split: ExerciseMuscle[]): WorkoutExercise[] {
  const catalog = allExercises();
  const out: WorkoutExercise[] = [];
  for (const m of split) {
    const entry = catalog
      .filter((e) => e.muscles[0] === m && e.popular)
      .sort((a, b) => Number(b.popular ?? false) - Number(a.popular ?? false))[0];
    if (entry) out.push({ name: entry.name, sets: Array.from({ length: 4 }, () => ({})) });
  }
  if (out.length < 2) {
    for (const m of split) {
      if (out.some((x) => matchExercise(x.name)?.muscles[0] === m)) continue;
      const entry = catalog.find((e) => e.muscles[0] === m);
      if (entry) out.push({ name: entry.name, sets: Array.from({ length: 4 }, () => ({})) });
    }
  }
  // Reference rhythm: 5, 5, 3, 3 …
  return out.map((x, i) => ({ ...x, sets: Array.from({ length: i < 2 ? 5 : 3 }, () => ({})) }));
}

type DayProgram = {
  title: string;
  category: string;
  intensity: Intensity;
  durationMin: number;
  timeOfDay: string;
  weekdays: number[];
  split: ExerciseMuscle[] | null;
  exercises: WorkoutExercise[];
  /** Slot to credit when one of this program's days is today. */
  todaySlot?: ScheduledWorkout;
};

export function TodaysWorkoutCard() {
  const { state } = useStore();
  const { openWith } = useModals();
  const streak = currentStreak(state);

  const programs = useMemo<DayProgram[]>(() => {
    const byTitle = new Map<string, ScheduledWorkout[]>();
    for (const slot of [...state.schedule]
      .filter((s) => s.active)
      .sort((a, b) => a.weekday - b.weekday || a.timeOfDay.localeCompare(b.timeOfDay))) {
      byTitle.set(slot.title, [...(byTitle.get(slot.title) ?? []), slot]);
    }
    const today = new Date().getDay();
    return [...byTitle.entries()].map(([title, slots]) => {
      const primary = slots.find((s) => s.exercises?.length) ?? slots[0];
      const split = splitForTitle(title);
      return {
        title,
        category: primary.categoryId,
        intensity: primary.intensity,
        durationMin: primary.durationMin,
        timeOfDay: primary.timeOfDay,
        weekdays: slots.map((s) => s.weekday),
        split,
        exercises: primary.exercises?.length
          ? primary.exercises
          : split
            ? suggestRoutine(split)
            : [],
        todaySlot: slots.find((s) => s.weekday === today),
      };
    });
  }, [state.schedule]);

  const todayIdx = Math.max(
    0,
    programs.findIndex((p) => p.todaySlot),
  );
  const [dayIdx, setDayIdx] = useState(todayIdx);
  const day = programs[Math.min(dayIdx, programs.length - 1)];

  const weeklyDone = useMemo(() => {
    const from = toISODate(startOfWeek(new Date(), weekStartOf(state)));
    const to = toISODate(new Date());
    const catalog = allExercises();
    const perMuscle = new Map<ExerciseMuscle, number>();
    for (const session of sessionsInRange(state, from, to)) {
      for (const ex of session.exercises ?? []) {
        const muscles =
          matchExercise(ex.name)?.muscles ?? catalog.find((e) => e.name === ex.name)?.muscles ?? [];
        for (const m of muscles) {
          perMuscle.set(m, (perMuscle.get(m) ?? 0) + Math.max(1, ex.sets.length));
        }
      }
    }
    return perMuscle;
  }, [state]);

  if (programs.length === 0 || !day) return null;

  const cat = categoryById(state, day.category);

  /* Sets this program adds per muscle today (the "+N" on the cards). */
  const plannedPerMuscle = new Map<ExerciseMuscle, number>();
  for (const ex of day.exercises) {
    const muscles = matchExercise(ex.name)?.muscles ?? [];
    for (const m of muscles) {
      plannedPerMuscle.set(m, (plannedPerMuscle.get(m) ?? 0) + Math.max(1, ex.sets.length));
    }
  }

  const startDay = () =>
    openWith({
      kind: 'runner',
      title: day.title,
      categoryId: day.category,
      intensity: day.intensity,
      durationMin: day.durationMin,
      exercises: day.exercises,
      scheduleId: day.todaySlot?.id,
    });

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="border-border overflow-hidden rounded-3xl border bg-[#141414]">
      <div className="p-5 sm:p-6">
        {/* ── Day switcher — the reference segmented control ─────────── */}
        {programs.length > 1 && (
          <div
            className="no-scrollbar bg-secondary mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border p-1"
            role="tablist"
            aria-label="Workout day"
          >
            {programs.map((p, i) => (
              <button
                key={p.title}
                role="tab"
                aria-selected={i === dayIdx}
                onClick={() => setDayIdx(i)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap transition-colors',
                  i === dayIdx
                    ? 'bg-volt text-ink shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}

        {/* ── Date · duration · intensity ─────────────────────────────── */}
        <p className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
          <span className="text-foreground">{dateLabel}</span>
          <span aria-hidden>·</span>
          <span>
            {day.durationMin} min
            {day.timeOfDay ? ` · ${day.timeOfDay}` : ''}
          </span>
          <span aria-hidden>·</span>
          <span className="capitalize">{cat?.name ?? day.intensity}</span>
        </p>

        {/* ── Streak tile — the reference "6 days of growth" ──────────── */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-3.5">
          <span className="bg-volt text-ink grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <Flame className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold tracking-tight">
              {streak} day{streak === 1 ? '' : 's'} of growth
            </p>
            <p className="text-muted-foreground truncate text-xs">
              Keep the streak alive — {day.title.toLowerCase()} is next up
            </p>
          </div>
        </div>

        {day.split ? (
          <>
            {/* ── Muscle cards — ↑ Growing · dot meter · +N sets ──────── */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {day.split.map((m) => {
                const color = MUSCLE_GROUP_COLOR[MUSCLE_GROUP[m]];
                const done = Math.min(weeklyDone.get(m) ?? 0, MUSCLE_WEEKLY_SET_TARGET);
                const planned = plannedPerMuscle.get(m) ?? 0;
                return (
                  <div key={m} className="rounded-2xl border border-white/8 bg-white/5 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <span className="truncate text-sm font-bold">
                          {EXERCISE_MUSCLE_LABELS[m]}
                        </span>
                      </span>
                      {planned > 0 && (
                        <span className="text-primary shrink-0 text-xs font-extrabold">
                          +{planned}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#3ac14e]">↑ Growing</p>
                    <div
                      className="mt-2 flex gap-[3px]"
                      role="progressbar"
                      aria-valuenow={done}
                      aria-valuemin={0}
                      aria-valuemax={MUSCLE_WEEKLY_SET_TARGET}
                      aria-label={`${EXERCISE_MUSCLE_LABELS[m]} sets this week`}
                    >
                      {Array.from({ length: MUSCLE_WEEKLY_SET_TARGET }, (_, i) => (
                        <span
                          key={i}
                          className="h-1.5 flex-1 rounded-full"
                          style={{
                            backgroundColor: i < done ? color : 'rgba(255,255,255,0.12)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Exercise rows — name + N sets ────────────────────────── */}
            <ul className="mt-3 grid gap-2">
              {day.exercises.map((ex) => (
                <li
                  key={ex.name}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 px-4 py-3"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/8 text-white/70"
                      aria-hidden
                    >
                      <Dumbbell className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate text-sm font-bold">{ex.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-white/55">
                    {Math.max(1, ex.sets.length)} sets
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground mt-3 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm">
            {formatMinutes(day.durationMin)} of {cat?.name?.toLowerCase() ?? 'training'} — no
            resistance routine to preview. Lace up and go.
          </p>
        )}

        {/* ── The reference CTA ─────────────────────────────────────────── */}
        <button
          type="button"
          onClick={startDay}
          className="press mt-4 h-13 w-full rounded-full bg-white text-[15px] font-extrabold text-[#141414] shadow-xl transition-transform hover:-translate-y-0.5"
        >
          Set as Today&apos;s workout
        </button>
      </div>
    </div>
  );
}
