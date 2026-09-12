'use client';

import { Crown } from 'lucide-react';

/**
 * The SmartFit Pro badge — a small gold-foil crown chip.
 * Rendered wherever a mvolt's identity shows (profile hero, coach header).
 * Kept as its own component so the "Pro badge on your profile" promise in
 * `PRO_GATES` has exactly one place it is fulfilled.
 */
export function ProBadge({
  label = 'Pro',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`gold-edge pro-surface sheen relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-[#f7ff85] uppercase ${className}`}
      title="SmartFit Pro mvolt"
    >
      <Crown className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
