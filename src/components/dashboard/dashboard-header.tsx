'use client';

import Link from 'next/link';
import { Bell, Zap } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { currentStreak } from '@smartfit/core';
import { Wordmark } from '@/components/brand';
import { useModals } from './modal-context';

/**
 * Mobile top chrome: status/brand on the left, notification and quick log on
 * the right. The search/category strip lives in the dashboard content, like the
 * reference Programs screen, while this header stays shared across all pages.
 */
export function DashboardHeader() {
  const { state, ready } = useStore();
  const { openModal } = useModals();
  const streak = ready ? currentStreak(state) : 0;

  return (
    <header className="bg-background/88 sticky top-0 z-30 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label="SmartFit home" className="min-w-0">
          <Wordmark className="[&_span:last-child]:text-[1.25rem]" />
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/coach"
            aria-label={`Coach (${streak}-day streak)`}
            className="relative grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-white/75 ring-1 ring-white/5 transition-colors hover:text-white"
          >
            <Bell className="h-5 w-5" />
            <span
              className="bg-primary absolute top-2 right-2.5 h-2 w-2 rounded-full"
              aria-hidden
            />
          </Link>
          <button
            type="button"
            onClick={() => openModal('workout')}
            aria-label="Log workout"
            className="bg-primary text-primary-foreground grid h-11 w-11 place-items-center rounded-full shadow-[0_0_18px_rgba(156,255,0,0.35)] transition-transform active:scale-95"
          >
            <Zap className="h-5 w-5 fill-current" strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </header>
  );
}
