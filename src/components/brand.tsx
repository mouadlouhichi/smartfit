import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

/**
 * The one SmartFit mark: the ember disc with the white flame — the badge
 * that leads the dashboard header greeting, and the geometry of
 * `public/icon.svg`, the PWA/Expo icons (`scripts/gen-brand-assets.mjs`) and
 * the share-card canvas mark. One fire everywhere: favicon, splash, share
 * cards, shell, onboarding, wordmarks.
 */
export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        'bg-ember inline-flex shrink-0 items-center justify-center rounded-full text-white',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Flame style={{ width: size * 0.44, height: size * 0.44 }} strokeWidth={2} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 tracking-tight', className)}>
      <Logo size={28} />
      <span className="font-display text-xl font-semibold">
        Smart<span className="text-primary italic">Fit</span>
      </span>
    </span>
  );
}
