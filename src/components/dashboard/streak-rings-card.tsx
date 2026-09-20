'use client';

import { useMemo } from 'react';
import { ArrowUpRight, Flame, Trophy, CalendarCheck } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from './modal-context';
import { ActivityRingsGraphic } from './activity-rings';
import { MiniRings } from './mini-rings';
import {
  activityRings,
  formatDateLabel,
  ringsHistory,
  streakStats,
  targetsForDays,
  todaysAgenda,
} from '@smartfit/core';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * The Apple Watch Activity reading of your streak: today's three rings with
 * the run count in the middle, the last seven days as a strip of micro dials
 * (closed days glow), and the all-time numbers that make a streak worth
 * protecting. Replaces the old flat "Training N days" tile.
 */
export function StreakRingsCard() {
  const { state } = useStore();
  const { openWith } = useModals();

  const rings = useMemo(() => activityRings(state, targetsForDays(state, 1)), [state]);
  const stats = useMemo(() => streakStats(state), [state]);
  const week = useMemo(() => ringsHistory(state, 7), [state]);

  const nextSlot = useMemo(() => todaysAgenda(state).find((x) => !x.done), [state]);

  const startToday = () =>
    nextSlot
      ? openWith({
          kind: 'runner',
          title: nextSlot.slot.title,
          categoryId: nextSlot.slot.categoryId,
          intensity: nextSlot.slot.intensity,
          scheduleId: nextSlot.slot.id,
          exercises: nextSlot.slot.exercises,
        })
      : openWith({
          kind: 'runner',
          title: 'Today’s workout',
          categoryId: 'cat-strength',
          intensity: 'moderate',
        });

  return (
    <section aria-label="Training streak" className="card-hero min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="bg-volt text-ink grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
            <Flame className="h-6 w-6" strokeWidth={2.4} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-extrabold tracking-tight sm:text-xl">
              {stats.current} day{stats.current === 1 ? '' : 's'} in a row
            </p>
            <p className="hero-muted mt-0.5 truncate text-xs sm:text-sm">
              Best {stats.best} · {stats.daysClosedLast7}/7 rings this week · {stats.weeksOnTarget}/
              {stats.weeksChecked} weeks on target
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={startToday}
          aria-label={nextSlot ? `Start ${nextSlot.slot.title}` : 'Start another workout'}
          title={nextSlot ? `Start ${nextSlot.slot.title}` : 'Start a workout'}
          className="bg-volt text-ink press grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-[0_6px_18px_-8px_rgba(138,210,0,0.7)] transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          <ArrowUpRight className="h-5 w-5" strokeWidth={2.75} />
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-5 min-[520px]:flex-row min-[520px]:gap-6">
        {/* Today's rings with the streak count at the heart of the dial. */}
        <div className="shrink-0">
          <ActivityRingsGraphic rings={rings} size={148}>
            <div className="flex max-w-[78px] flex-col items-center justify-center px-1">
              <p
                className={`font-display leading-none font-extrabold tabular-nums ${
                  stats.current >= 100
                    ? 'text-[18px]'
                    : stats.current >= 10
                      ? 'text-[20px]'
                      : 'text-[24px]'
                }`}
              >
                {stats.current}
              </p>
              <p className="hero-muted mt-0.5 text-center text-[8.5px] leading-[0.95] font-bold tracking-[0.08em] uppercase">
                {stats.current === 1 ? 'day streak' : 'day streak'}
              </p>
            </div>
          </ActivityRingsGraphic>
        </div>

        <div className="w-full min-w-0 flex-1">
          {/* Last seven days as Apple-style micro dials, oldest first. */}
          <div
            className="grid grid-cols-7 gap-1.5"
            role="img"
            aria-label={`Ring history, last 7 days: ${week.map((d) => `${formatDateLabel(d.date)} ${d.rings.closed ? 'closed' : 'open'}`).join(', ')}.`}
          >
            {week.map((d) => (
              <div key={d.date} className="flex min-w-0 flex-col items-center gap-1">
                <MiniRings rings={d.rings} size={34} />
                <span
                  className={`text-[10px] font-bold ${
                    d.rings.closed ? 'text-volt-ink' : 'hero-muted'
                  }`}
                >
                  {DAY_LETTERS[new Date(`${d.date}T12:00:00`).getDay()]}
                </span>
              </div>
            ))}
          </div>

          <div className="hero-tile mt-3 grid grid-cols-3 gap-2 rounded-2xl px-3 py-2.5 text-center">
            <div>
              <p className="hero-muted text-[10px] font-bold tracking-wide uppercase">Ring run</p>
              <p className="font-display text-base font-extrabold tabular-nums">
                {stats.ringStreak}
                <span className="hero-muted text-[10px] font-bold"> days</span>
              </p>
            </div>
            <div>
              <p className="hero-muted flex items-center justify-center gap-1 text-[10px] font-bold tracking-wide uppercase">
                <Trophy className="h-3 w-3" aria-hidden /> Best
              </p>
              <p className="font-display text-base font-extrabold tabular-nums">{stats.best}</p>
            </div>
            <div>
              <p className="hero-muted flex items-center justify-center gap-1 text-[10px] font-bold tracking-wide uppercase">
                <CalendarCheck className="h-3 w-3" aria-hidden /> Weeks
              </p>
              <p className="font-display text-base font-extrabold tabular-nums">
                {stats.weeksOnTarget}
                <span className="hero-muted text-[10px] font-bold">/{stats.weeksChecked}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
