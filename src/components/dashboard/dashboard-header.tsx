'use client';

import { Flame, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/brand';
import { useStore } from '@/lib/store-context';
import { currentStreak } from '@/lib/fitness';
import { useModals } from './modal-context';

export function DashboardHeader() {
  const { state, ready } = useStore();
  const { openModal } = useModals();
  const streak = ready ? currentStreak(state) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = ready ? state.profile.name : '';

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="lg:hidden">
            <Wordmark />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm text-muted-foreground">
              {greeting}
              {name ? `, ${name}` : ''} 👋
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="hidden items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground sm:flex"
            title="Current training streak"
          >
            <Flame className="h-4 w-4" />
            {streak} day{streak === 1 ? '' : 's'}
          </div>
          <Button onClick={() => openModal('workout')} size="sm" className="rounded-full">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Log workout</span>
            <span className="sm:hidden">Log</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
