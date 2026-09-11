import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // Mobile-first: 44px + 16px type (no iOS focus zoom); compact on sm+.
        // `min-w-0` lets the control shrink inside grid/flex form rows instead
        // of forcing its intrinsic width past the cell (see dialog §7.4).
        'bg-secondary text-foreground placeholder:text-muted-foreground hover:bg-secondary/70 focus-visible:ring-ring focus-visible:border-ring focus-visible:bg-background aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/5 flex h-11 w-full min-w-0 rounded-xl border border-transparent px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
