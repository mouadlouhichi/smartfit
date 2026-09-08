import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lightweight styled native <select>. The reference app uses Radix Select for
 * the full command-menu experience; a native control keeps the bundle small and
 * gives us mobile-friendly pickers for free. Same visual contract.
 */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'bg-secondary text-foreground hover:bg-secondary/70 focus-visible:ring-ring focus-visible:border-ring focus-visible:bg-background aria-[invalid=true]:border-destructive aria-[invalid=true]:bg-destructive/5 h-10 w-full appearance-none rounded-xl border border-transparent pr-9 pl-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
    </div>
  ),
);
Select.displayName = 'Select';

export { Select };
