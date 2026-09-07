import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-secondary animate-pulse rounded-xl', className)} {...props} />;
}

export { Skeleton };
