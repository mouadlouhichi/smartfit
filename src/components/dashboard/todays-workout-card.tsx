'use client';

import { useMemo, useState } from 'react';
import { Dumbbell, Flame } from 'lucide-react';
import {
  EXERCISE_MUSCLE_LABELS,
  MUSCLE_WEEKLY_SET_TARGET,
  allExercises,
  exerciseMeasure,
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

/* Suggest a routine for a split: the most popular lift per muscle.
 * Distance-measured conditioning never joins a set-based routine. */
function suggestRoutine(split: ExerciseMuscle[]): WorkoutExercise[] {
  const catalog = allExercises().filter((e) => exerciseMeasure(e) !== 'distance');
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
      exercises: day.exercises,
      scheduleId: day.todaySlot?.id,
    });

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0e0e0e] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)]">
      {/* Subtle gradient glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-[#A8FF00]/[0.06] blur-[40px]" />

      <div className="relative p-5 sm:p-6">
        {/* ── Day switcher — premium segmented control ─────────── */}
        {programs.length > 1 && (
          <div
            className="no-scrollbar mx-auto flex w-fit max-w-full min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-white/[0.08] bg-[#1a1a1a] p-1.5 shadow-inner"
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
                  'rounded-full px-5 py-2 text-[13px] font-bold whitespace-nowrap transition-all duration-300',
                  i === dayIdx
                    ? 'bg-[#A8FF00] text-black shadow-[0_4px_12px_-4px_rgba(168,255,0,0.5)]'
                    : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80',
                )}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}

        {/* ── Date · duration · intensity ─────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A8FF00] shadow-[0_0_8px_#A8FF00]" />
            {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60">
            {day.durationMin} min {day.timeOfDay ? `· ${day.timeOfDay}` : ''} ·{' '}
            <span className="text-white/80 capitalize">{cat?.name ?? day.intensity}</span>
          </span>
        </div>

        {/* ── Streak tile — enhanced growth card ──────────── */}
        <div className="mt-4 flex items-center gap-3.5 rounded-[18px] border border-[#A8FF00]/20 bg-gradient-to-br from-[#A8FF00]/[0.08] to-[#A8FF00]/[0.02] p-4 shadow-[inset_0_1px_0_0_rgba(168,255,0,0.1)]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#A8FF00] text-black shadow-[0_4px_12px_-4px_rgba(168,255,0,0.6)]">
            <Flame className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold tracking-tight text-white">
              {streak} day{streak === 1 ? '' : 's'} of growth
            </p>
            <p className="mt-0.5 truncate text-xs leading-tight text-white/60">
              Keep the streak alive — {day.title.toLowerCase()} is next up
            </p>
          </div>
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#A8FF00] shadow-[0_0_8px_#A8FF00]" />
        </div>

        {day.split ? (
          <>
            {/* ── Muscle cards — premium enhanced with glow and better hierarchy */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {day.split.map((m) => {
                const color = MUSCLE_GROUP_COLOR[MUSCLE_GROUP[m]];
                const done = Math.min(weeklyDone.get(m) ?? 0, MUSCLE_WEEKLY_SET_TARGET);
                const planned = plannedPerMuscle.get(m) ?? 0;
                const pct = Math.round((done / MUSCLE_WEEKLY_SET_TARGET) * 100);
                return (
                  <div
                    key={m}
                    className="group relative overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#151515] p-4 transition-all duration-300 hover:border-white/[0.1] hover:bg-[#1a1a1a]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
                            style={{ backgroundColor: color, color: color }}
                            aria-hidden
                          />
                          <span className="truncate text-[13px] font-bold tracking-tight text-white">
                            {EXERCISE_MUSCLE_LABELS[m]}
                          </span>
                        </span>
                        {planned > 0 && (
                          <span className="inline-flex items-center rounded-full bg-[#A8FF00] px-2 py-0.5 text-[11px] font-extrabold text-black shadow-[0_2px_8px_-2px_rgba(168,255,0,0.5)]">
                            +{planned}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#3ac14e]/15 px-2 py-0.5 text-[11px] font-bold text-[#3ac14e]">
                          ↑ Growing
                        </span>
                        <span className="text-[11px] font-medium text-white/40">
                          {pct}% this week
                        </span>
                      </div>
                      <div
                        className="mt-3 flex gap-[3px]"
                        role="progressbar"
                        aria-valuenow={done}
                        aria-valuemin={0}
                        aria-valuemax={MUSCLE_WEEKLY_SET_TARGET}
                        aria-label={`${EXERCISE_MUSCLE_LABELS[m]} sets this week`}
                      >
                        {Array.from({ length: MUSCLE_WEEKLY_SET_TARGET }, (_, i) => (
                          <span
                            key={i}
                            className="h-1.5 flex-1 rounded-full transition-all duration-500"
                            style={{
                              backgroundColor: i < done ? color : 'rgba(255,255,255,0.08)',
                              boxShadow: i < done ? `0 0 8px ${color}60` : 'none',
                              opacity: i < done ? 1 : 0.6,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Exercise rows — premium list with hover states */}
            <ul className="mt-4 grid gap-2">
              {day.exercises.map((ex) => (
                <li
                  key={ex.name}
                  className="group flex items-center justify-between gap-3 rounded-[16px] border border-white/[0.06] bg-[#151515] px-4 py-3.5 transition-all duration-200 hover:border-white/[0.1] hover:bg-[#1e1e1e]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/[0.06] text-white/60 transition-colors group-hover:bg-white/[0.1] group-hover:text-white/80"
                      aria-hidden
                    >
                      <Dumbbell className="h-4 w-4" />
                    </span>
                    <span className="truncate text-[13px] font-bold tracking-tight text-white">
                      {ex.name}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/60">
                    {Math.max(1, ex.sets.length)} sets
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 rounded-[18px] border border-white/[0.06] bg-[#151515] p-4 text-sm leading-relaxed text-white/60">
            {formatMinutes(day.durationMin)} of {cat?.name?.toLowerCase() ?? 'training'} — no
            resistance routine to preview. Lace up and go.
          </p>
        )}

        {/* ── Premium CTA with glow */}
        <button
          type="button"
          onClick={startDay}
          className="press group relative mt-5 flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-white text-[15px] font-extrabold tracking-tight text-[#0d1102] shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgba(255,255,255,0.5)]"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-[#A8FF00]/0 via-[#A8FF00]/10 to-[#A8FF00]/0 opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="relative">Set as Today&apos;s workout</span>
          <span className="relative grid h-6 w-6 place-items-center rounded-full bg-black text-white transition-transform group-hover:translate-x-0.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}
