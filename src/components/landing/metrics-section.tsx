'use client';

import { useEffect, useState } from 'react';
import { Eyebrow, Section } from './section';

const METRICS = [
  { value: 4, suffix: '', label: 'Training styles to choose from' },
  { value: 5, suffix: '', label: 'Built-in activity types' },
  { value: 6, suffix: '', label: 'Days you can schedule per week' },
  { value: 30, suffix: 's', label: 'To log a full session' },
];

function useClock() {
  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function MetricsSection() {
  const clock = useClock();
  return (
    <Section id="metrics">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>At a glance</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
            Training made <span className="italic text-ember">simple</span> with SmartFit.
          </h2>
        </div>
        <p className="flex items-center gap-2 text-sm font-semibold text-clay">
          <span className="h-2.5 w-2.5 rounded-full bg-ember animate-pulse-soft" />
          Live <span className="text-ink-warm">|</span> {clock}
        </p>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m) => (
          <div key={m.label} className="bg-white p-8">
            <p className="font-display text-5xl font-extrabold text-ink-warm">
              {m.value}
              <span className="text-ember">{m.suffix}</span>
            </p>
            <p className="mt-3 text-sm font-medium leading-snug text-clay">{m.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
