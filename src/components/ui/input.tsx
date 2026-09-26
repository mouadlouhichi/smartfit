import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The one, design-system text field.
 *
 * The boundary is `--input` (3:1 against both the card and the canvas, per WCAG
 * 1.4.11) on the `--field` surface. Before that, every field was a
 * `bg-secondary` fill with a transparent border: the only thing identifying a
 * field as a field was a 1.15:1 fill difference, which is invisible to a lot of
 * people on a lot of screens. The fill no longer has to carry the shape, so it
 * matches the surface it sits on and the border does the work.
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // Mobile-first: 44px + 16px type (no iOS focus zoom); compact on sm+.
        // `min-w-0` lets the control shrink inside grid/flex form rows instead
        // of forcing its intrinsic width past the cell (see dialog §7.4).
        'bg-field text-foreground placeholder:text-muted-foreground border-input focus-visible:ring-ring focus-visible:border-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/5 hover:border-foreground/40 flex h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
