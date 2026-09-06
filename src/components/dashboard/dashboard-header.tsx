'use client';

import { Flame, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store-context';
import { currentStreak } from '@smartfit/core';
import { useModals } from './modal-context';

export function DashboardHeader() {
  const { state, ready } = useStore();
  const { openModal } = useModals();
  const streak = ready ? currentStreak(state) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Flame className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
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

        <Button onClick={() => openModal('workout')} size="sm" className="rounded-full px-5">
          <Plus className="h-4 w-4" strokeWidth={2.8} />
          <span className="hidden sm:inline">Log workout</span>
          <span className="sm:hidden">Log</span>
        </Button>
      </div>
    </header>
  );
}
