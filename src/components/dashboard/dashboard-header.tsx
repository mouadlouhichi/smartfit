'use client';

import Link from 'next/link';
import { Flame, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store-context';
import { currentStreak } from '@smartfit/core';
import { useModals } from './modal-context';

export function DashboardHeader() {
  const { state, ready } = useStore();
  const { openModal } = useModals();
  const streak = ready ? currentStreak(state) : 0;

  return (
    <header className="sticky top-0 z-30 bg-background/70 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex items-center gap-3 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-white">
            <Flame className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-tight">
              {ready && state.profile.name ? `Hi, ${state.profile.name}` : 'SmartFit'}
            </p>
            <p className="text-xs text-muted-foreground">
              {streak} day{streak === 1 ? '' : 's'} streak
            </p>
          </div>
        </div>

        <div className="hidden lg:block" />

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/coach"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/30 transition-transform hover:scale-[1.02] lg:hidden"
          >
            <Sparkles className="h-4 w-4" /> Coach
          </Link>
          <Button onClick={() => openModal('workout')} size="sm" className="rounded-full px-5">
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            <span className="hidden sm:inline">Log workout</span>
            <span className="sm:hidden">Log</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
