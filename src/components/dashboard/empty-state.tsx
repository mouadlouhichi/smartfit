'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <span className="bg-secondary text-terracotta flex h-14 w-14 items-center justify-center rounded-2xl">
        <Icon className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <p className="font-display mt-4 text-lg font-semibold tracking-tight">{title}</p>
      {body && (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">{body}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
