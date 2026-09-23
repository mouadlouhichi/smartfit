'use client';

import { useMemo } from 'react';
import { ArrowUpRight, Flame, Trophy, CalendarCheck } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
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

/**
 * The Apple Watch Activity reading of your streak: today's three rings with
 * the run count in the middle, the last seven days as a strip of micro dials
 * (closed days glow), and the all-time numbers that make a streak worth
 * protecting. Replaces the old flat "Training N days" tile.
 */
export function StreakRingsCard() {
  const { state } = useStore();
  const { openWith } = useModals();
  const { t, locale } = useI18n();
  const dayLetters = t('time.weekdays.initials').split(',');

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
          title: t('overview.today'),
          categoryId: 'cat-strength',
          intensity: 'moderate',
        });

  return (
    <section aria-label={t('overview.streak.title')} className="card-hero min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="bg-volt text-ink grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
            <Flame className="h-6 w-6" strokeWidth={2.4} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-extrabold tracking-tight sm:text-xl">
              {t('overview.streak.row', { count: stats.current })}
            </p>
            <p className="hero-muted mt-0.5 truncate text-xs sm:text-sm">
              {t('overview.streak.summary', {
                best: stats.best,
                closed: stats.daysClosedLast7,
                onTarget: stats.weeksOnTarget,
                checked: stats.weeksChecked,
              })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={startToday}
          aria-label={
            nextSlot
              ? t('overview.streak.start', { title: nextSlot.slot.title })
              : t('overview.streak.startAnother')
          }
          title={
            nextSlot
              ? t('overview.streak.start', { title: nextSlot.slot.title })
              : t('overview.streak.startAria')
          }
          className="bg-volt text-ink press grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-[0_6px_18px_-8px_rgba(138,210,0,0.7)] transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          <ArrowUpRight className="h-5 w-5" strokeWidth={2.75} />
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-5 min-[520px]:flex-row min-[520px]:gap-6">
        {/* Today's rings with the streak count at the heart of the dial — inner hole is only ~54px, so text must stay tiny */}
        <div className="shrink-0">
          <ActivityRingsGraphic rings={rings} size={148}>
            <div className="flex max-w-[44px] flex-col items-center justify-center">
              <p
                className={`font-display leading-none font-extrabold tabular-nums ${
                  stats.current >= 100
                    ? 'text-[14px]'
                    : stats.current >= 10
                      ? 'text-[18px]'
                      : 'text-[22px]'
                }`}
              >
                {stats.current}
              </p>
              <p className="hero-muted mt-[2px] text-center text-[6px] leading-[0.9] font-bold tracking-[0.12em] uppercase">
                {t('overview.streak.level1')}
                <br />
                {t('overview.streak.level2')}
              </p>
            </div>
          </ActivityRingsGraphic>
        </div>

        <div className="w-full min-w-0 flex-1">
          {/* Last seven days as Apple-style micro dials, oldest first. */}
          <div
            className="grid grid-cols-7 gap-1.5"
            role="img"
            aria-label={t('overview.streak.historyAria', {
              list: week
                .map(
                  (d) =>
                    `${formatDateLabel(d.date, locale)} ${
                      d.rings.closed ? t('overview.streak.closed') : t('overview.streak.open')
                    }`,
                )
                .join(', '),
            })}
          >
            {week.map((d) => (
              <div key={d.date} className="flex min-w-0 flex-col items-center gap-1">
                <MiniRings rings={d.rings} size={34} />
                <span
                  className={`text-[10px] font-bold ${
                    d.rings.closed ? 'text-volt-ink' : 'hero-muted'
                  }`}
                >
                  {dayLetters[new Date(`${d.date}T12:00:00`).getDay()]}
                </span>
              </div>
            ))}
          </div>

          <div className="hero-tile mt-3 grid grid-cols-3 gap-2 rounded-2xl px-3 py-2.5 text-center">
            <div>
              <p className="hero-muted text-[10px] font-bold tracking-wide uppercase">
                {t('overview.streak.unit')}
              </p>
              <p className="font-display text-base font-extrabold tabular-nums">
                {stats.ringStreak}
                <span className="hero-muted text-[10px] font-bold">
                  {t('overview.streak.days', { count: stats.ringStreak })}
                </span>
              </p>
            </div>
            <div>
              <p className="hero-muted flex items-center justify-center gap-1 text-[10px] font-bold tracking-wide uppercase">
                <Trophy className="h-3 w-3" aria-hidden /> {t('overview.streak.best')}
              </p>
              <p className="font-display text-base font-extrabold tabular-nums">{stats.best}</p>
            </div>
            <div>
              <p className="hero-muted flex items-center justify-center gap-1 text-[10px] font-bold tracking-wide uppercase">
                <CalendarCheck className="h-3 w-3" aria-hidden /> {t('overview.streak.weeks')}
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
