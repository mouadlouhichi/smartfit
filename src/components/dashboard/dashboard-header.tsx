'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Logo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store-context';
import { currentStreak } from '@smartfit/core';

/**
 * Mobile-only top bar: greeting, streak and the Coach shortcut.
 *
 * Desktop gets no header row at all — every screen has its own title, and
 * the primary "Log workout" action lives in the global floating CTA
 * (dashboard-shell) instead of a per-tab header pill. Mobile already has
 * its own global CTA: the raised bolt in the bottom navigation.
 */
export function DashboardHeader() {
  const { state, ready } = useStore();
  const streak = ready ? currentStreak(state) : 0;

  return (
    <header className="bg-background/70 sticky top-0 z-30 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo size={36} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-extrabold tracking-tight">
              {ready && state.profile.name ? `Hi, ${state.profile.name}` : 'SmartFit'}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {streak} day{streak === 1 ? '' : 's'} streak
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            className="shadow-primary/30 h-10 rounded-full px-5 text-sm font-bold shadow-md"
          >
            <Link href="/dashboard/coach">
              <Sparkles className="h-4 w-4" /> Coach
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
