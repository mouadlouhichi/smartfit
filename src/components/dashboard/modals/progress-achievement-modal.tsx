'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { currentStreak, nextStreakMilestone } from '@smartfit/core';
import { useStore } from '@/lib/store-context';

/**
 * "Today's progress" — the post-workout achievement celebration.
 *
 * Reference screen: congratulations headline over graphite, a flip-clock
 * streak card (ghost digits either side of today's count, white glow at the
 * base) with the next milestone peeking in from the right edge, and a single
 * white pill CTA. Rendered by the session runner right after a save; `onDone`
 * closes the runner for good.
 */
export function ProgressAchievementModal({
  workoutTitle,
  prCount,
  onDone,
}: {
  workoutTitle: string;
  prCount: number;
  onDone: () => void;
}) {
  const { state } = useStore();
  const streak = currentStreak(state);
  const milestone = nextStreakMilestone(streak);
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Today's progress"
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#0a0a09]"
      style={{
        backgroundImage:
          'radial-gradient(120% 80% at 50% 110%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #0d0e0a 0%, #050404 100%)',
      }}
    >
      {/* grabber */}
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/25" aria-hidden />

      <div
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pt-14 text-center"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <h2 className="text-[2rem] leading-tight font-extrabold tracking-tight text-white">
          Today&apos;s progress
        </h2>
        <p className="mt-3 max-w-[16rem] text-base leading-relaxed text-white/70">
          Congratulations, you&apos;ve completed {workoutTitle}!
        </p>
        {prCount > 0 && (
          <p
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
            style={{ background: 'rgba(138,210,0,0.14)', color: '#8AD200' }}
          >
            ⭐ {prCount} personal record{prCount === 1 ? '' : 's'}
          </p>
        )}

        {/* ── Flip-clock streak card + next-milestone peek ─────────────── */}
        <div className="relative mt-12 w-full">
          {/* next milestone, peeking from the right edge */}
          <button
            type="button"
            onClick={onDone}
            aria-label={`Next milestone: ${milestone}-day streak`}
            className="absolute top-1/2 -right-16 hidden -translate-y-1/2 flex-col items-start gap-1 rounded-3xl border px-5 py-4 text-left sm:flex"
            style={{
              borderColor: 'rgba(138,210,0,0.55)',
              background: 'rgba(138,210,0,0.06)',
              width: '9.5rem',
            }}
          >
            <span className="text-[11px] font-semibold text-white/50">Challenge</span>
            <span className="text-volt-soft text-2xl font-extrabold tabular-nums">{milestone}</span>
            <span className="text-xs text-white/60">Days · next streak goal</span>
            <ChevronRight className="text-volt-soft mt-1 h-4 w-4" aria-hidden />
          </button>

          {/* the streak flip-card */}
          <div
            className="relative mx-auto w-56 overflow-hidden rounded-[2rem] border border-white/35 p-5 text-center"
            style={{
              backgroundImage:
                'linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.10) 100%)',
              boxShadow: '0 30px 60px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            {/* seam + hinge dots — the flip-clock split */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-black/50" aria-hidden />
            <div
              className="absolute top-1/2 left-0 h-2 w-2 -translate-y-1/2 rounded-r-full bg-[#050404]"
              aria-hidden
            />
            <div
              className="absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 rounded-l-full bg-[#050404]"
              aria-hidden
            />

            <p className="text-sm font-semibold text-white/85">Workout streak</p>

            {/* digit row: ghost neighbours + today */}
            <div className="relative mt-2 flex items-center justify-center" aria-hidden>
              <span className="absolute -left-6 -translate-x-full text-6xl font-extrabold text-white/12 tabular-nums select-none">
                {streak - 1}
              </span>
              <span className="text-[5.5rem] leading-none font-extrabold text-white tabular-nums">
                {streak}
              </span>
              <span className="absolute -right-6 translate-x-full text-6xl font-extrabold text-white/12 tabular-nums select-none">
                {streak + 1}
              </span>
            </div>
            <span className="sr-only">
              Workout streak: {streak} day{streak === 1 ? '' : 's'}
            </span>

            <div
              className="pointer-events-none absolute inset-x-6 bottom-0 h-16"
              style={{
                background:
                  'radial-gradient(60% 100% at 50% 100%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)',
              }}
              aria-hidden
            />
            <p className="relative mt-8 text-base font-bold text-white/90">Days</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative mx-auto w-full max-w-md px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onDone}
          className="press h-14 w-full rounded-full bg-white text-base font-extrabold text-[#0d1102] shadow-xl transition-transform hover:-translate-y-0.5"
        >
          Keep it going
        </button>
        <button
          type="button"
          onClick={onDone}
          aria-label="Dismiss"
          className="absolute -top-12 right-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 sm:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
