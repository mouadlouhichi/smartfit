import { cn } from '@/lib/utils';
import { BOLT_PATH } from '@/lib/brand-mark';

/**
 * SmartFit mark in the AXEL reference language: a compact charged cell, neon
 * on the black product canvas, with a condensed athletic wordmark everywhere
 * from login through the dashboard shell.
 */

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        'bg-primary text-primary-foreground inline-flex shrink-0 items-center justify-center rounded-[30%] shadow-[0_0_24px_rgba(156,255,0,0.32)]',
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
      <Logo size={30} />
      <span className="font-display text-foreground text-[1.55rem] leading-none font-black tracking-[-0.08em] uppercase">
        Smart<span className="text-primary">Fit</span>
      </span>
    </span>
  );
}
