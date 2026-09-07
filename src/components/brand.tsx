import { cn } from '@/lib/utils';
import { Dumbbell } from 'lucide-react';

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/25',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Dumbbell style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.4} />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 tracking-tight', className)}>
      <Logo size={28} />
      <span className="font-display text-xl font-semibold">
        Smart<span className="italic text-primary">Fit</span>
      </span>
    </span>
  );
}
