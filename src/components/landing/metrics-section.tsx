'use client';

import { useEffect, useRef, useState } from 'react';
import { useReveal } from './use-reveal';

function AnimatedCounter({
  end,
  suffix = '',
  prefix = '',
}: {
  end: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return (
    <div ref={ref} className="font-display text-6xl tracking-tight lg:text-8xl">
      {prefix}
      {new Intl.NumberFormat('en-US').format(count)}
      {suffix}
    </div>
  );
}

const METRICS = [
  { value: 4, suffix: '', label: 'Training styles to choose from' },
  { value: 5, suffix: '', label: 'Built-in activity types' },
  { value: 7, suffix: '', label: 'Days you can schedule each week' },
  { value: 30, suffix: 's', label: 'To log a full session' },
];

export function MetricsSection() {
  const { ref, visible } = useReveal<HTMLElement>(0.1);
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    setTime(new Date().toLocaleTimeString('en-US'));
    const interval = setInterval(() => setTime(new Date().toLocaleTimeString('en-US')), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="metrics"
      ref={ref}
      className="relative overflow-x-clip border-y border-[color:var(--foreground)]/10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 flex flex-col gap-8 lg:mb-24 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="eyebrow-mono mb-6">At a glance</span>
            <h2
              className="reveal text-4xl tracking-tight lg:text-6xl"
              data-state={visible ? 'visible' : 'hidden'}
            >
              Training made simple
              <br />
              with SmartFit.
            </h2>
          </div>
          <div className="flex items-center gap-4 font-mono text-sm text-[color:var(--muted-foreground)]">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)]" />
              Live
            </span>
            <span className="text-[color:var(--foreground)]/30">|</span>
            <span suppressHydrationWarning>{time ?? '--:--:--'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-[color:var(--foreground)]/10 md:grid-cols-2">
          {METRICS.map((metric, index) => (
            <div
              key={metric.label}
              className="reveal bg-[color:var(--background)] p-8 lg:p-12"
              data-state={visible ? 'visible' : 'hidden'}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <AnimatedCounter end={metric.value} suffix={metric.suffix} />
              <div className="mt-4 text-lg text-[color:var(--muted-foreground)]">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
