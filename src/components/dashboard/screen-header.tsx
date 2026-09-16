'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The shared dashboard screen header — the Axel editorial pattern.
 *
 * A small volt eyebrow over a heavy display title and a one-line sage
 * subtitle, with the screen's primary action docked right. One header on
 * every screen is the layout's signature: you always know where you are and
 * what you can do next.
 */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  /** Tiny volt kicker above the title (e.g. "Training"). */
  eyebrow?: ReactNode;
  /** The screen's display title. */
  title: ReactNode;
  /** One-line sage description under the title. */
  subtitle?: ReactNode;
  /** Primary action (button), docked to the right on wide screens. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-4 gap-y-3',
        action && 'sm:items-center',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-volt-ink text-[11px] font-bold tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-xl leading-tight font-extrabold tracking-tight text-balance sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground mt-0.5 max-w-prose text-sm">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
