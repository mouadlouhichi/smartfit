'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { currentStreak } from '@smartfit/core';

/**
 * Mobile-only top bar: the reference greeting row — volt avatar, "Welcome
 * back!" + name, and the Coach shortcut styled as a notification bell with
 * a volt dot (the streak keeps living in the avatar's accessible name).
 *
 * Desktop gets no header row at all — every screen has its own title, and
 * the primary "Log workout" action lives in the global floating CTA
 * (dashboard-shell) instead of a per-tab header pill. Mobile already has
 * its own global CTA: the raised bolt in the bottom navigation.
 */
export function DashboardHeader() {
  const { state, ready } = useStore();
  const streak = ready ? currentStreak(state) : 0;
  const name = ready ? state.profile.name?.trim() : undefined;
  const initial = (name?.[0] ?? 'S').toUpperCase();

  return (
    <header className="bg-background/70 sticky top-0 z-30 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="bg-volt text-ink grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-extrabold"
          >
            {initial}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-muted-foreground truncate text-xs">Welcome back! 👋</p>
            <p className="truncate text-sm font-extrabold tracking-tight">{name || 'SmartFit'}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/coach"
            aria-label={`Open your coach (${streak}-day streak)`}
            className="bg-secondary hover:bg-secondary/70 relative grid h-11 w-11 place-items-center rounded-full transition-colors"
          >
            <Sparkles className="h-5 w-5" />
            <span className="bg-volt absolute top-2 right-2.5 h-2 w-2 rounded-full" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
