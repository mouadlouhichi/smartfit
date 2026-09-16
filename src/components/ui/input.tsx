import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // Mobile-first: 48px pill + 16px type (no iOS focus zoom); compact on sm+.
        'bg-input text-foreground placeholder:text-muted-foreground hover:bg-secondary focus-visible:ring-ring focus-visible:border-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/10 flex h-12 w-full min-w-0 rounded-full border border-white/10 px-4 py-2 text-base font-semibold transition-colors focus-visible:bg-[#0c0c0c] focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
