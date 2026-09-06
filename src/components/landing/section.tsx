import { cn } from '@/lib/utils';

/** Small uppercase eyebrow label used to open every landing section. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('eyebrow text-ember', className)}>{children}</p>;
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
      <h2 className="mt-3 font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">{children}</h2>
    </div>
  );
}

export function Section({
  id,
  children,
  className,
  alt,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  alt?: boolean;
}) {
  return (
    <section id={id} className={cn(alt ? 'bg-white' : 'bg-paper-warm', 'border-t border-black/5')}>
      <div className={cn('mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28', className)}>{children}</div>
    </section>
  );
}
