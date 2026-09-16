import { cn } from '@/lib/utils';
import { BOLT_PATH } from '@/lib/brand-mark';

/**
 * The one SmartFit mark: the volt bolt on a rounded-square charge cell — the
 * badge that leads the dashboard header greeting, and the geometry of
 * `public/icon.svg`, the PWA/Expo icons (`scripts/gen-brand-assets.mjs`) and
 * the share-card canvas mark. One mark everywhere: favicon, splash, share
 * cards, shell, onboarding, wordmarks. The bolt path lives in
 * `lib/brand-mark.ts` so canvas and SVG renderers share one source of truth.
 */

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        'bg-volt text-ink inline-flex shrink-0 items-center justify-center rounded-[30%] shadow-[0_0_18px_rgba(138,210,0,0.35)]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: size * 0.6, height: size * 0.6 }}
        fill="currentColor"
        aria-hidden
      >
        <path d={BOLT_PATH} />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 tracking-tight', className)}>
      <Logo size={28} />
      <span className="text-xl font-extrabold tracking-tighter">
        Smart<span className="text-primary">Fit</span>
      </span>
    </span>
  );
}
