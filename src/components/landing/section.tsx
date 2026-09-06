import { cn } from '@/lib/utils';

/** Small uppercase eyebrow label used to open every landing section (Optimus style). */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-xs font-bold uppercase tracking-[0.22em] text-volt', className)}>{children}</p>
  );
}

export function SectionHeading({
  eyebrow,
  children,
  className,
}: {
  eyebrow: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl">{children}</h2>
    </div>
  );
}
