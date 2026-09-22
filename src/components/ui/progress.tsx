'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('bg-secondary relative h-2.5 w-full overflow-hidden rounded-full', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        // Volt energy ramp: the fill carries a light-to-full primary gradient
        // (volt-dim → volt on the dark theme) so the bar reads as one lit
        // stroke rather than a flat plate. A soft glow in dark lifts it off
        // the track.
        'from-primary/75 to-primary h-full w-full flex-1 rounded-full bg-gradient-to-r transition-all',
        'dark:shadow-[0_0_12px_-2px_rgba(138,210,0,0.55)]',
        indicatorClassName,
      )}
      style={{ transform: `translateX(-${100 - Math.min(100, value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
