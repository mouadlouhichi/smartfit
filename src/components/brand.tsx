import { cn } from '@/lib/utils';

/**
 * The one SmartFit mark, everywhere.
 *
 * `public/icon.svg` (favicon, PWA icons, OG image), `drawLogoMark` in the
 * share-card canvas and this component are the same geometry: a primary
 * tile carrying the white pulse glyph — two tall bars, two short bars and
 * the crossbar that ties them, an heartbeat read as a barbell. The app
 * previously drifted into a dumbbell tile here and a flame badge in the
 * dashboard header; the header, shell, onboarding and landing now all wear
 * this mark so the brand reads identically from favicon to share card.
 */
export function Logo({
  className,
  size = 36,
  radius,
}: {
  className?: string;
  size?: number;
  /** Corner radius; defaults to the icon.svg squircle (22.66% of the side). */
  radius?: number | string;
}) {
  return (
    <span
      className={cn('bg-primary shadow-primary/25 inline-flex shrink-0 shadow-sm', className)}
      style={{ width: size, height: size, borderRadius: radius ?? size * 0.2266 }}
      aria-hidden
    >
      <svg viewBox="0 0 512 512" width={size} height={size} fill="none">
        <g
          stroke="currentColor"
          strokeWidth="30"
          strokeLinecap="round"
          className="text-primary-foreground"
        >
          <path d="M170 186v140" />
          <path d="M342 186v140" />
          <path d="M118 226v60" />
          <path d="M394 226v60" />
          <path d="M170 256h172" />
        </g>
      </svg>
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
