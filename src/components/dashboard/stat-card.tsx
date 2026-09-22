import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'var(--primary)',
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `color-mix(in oklab, ${accent} 12%, transparent)`,
            color: accent,
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p className="text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p>
        </div>
      </div>
      {sub && <p className="text-muted-foreground mt-2 text-xs">{sub}</p>}
    </Card>
  );
}
