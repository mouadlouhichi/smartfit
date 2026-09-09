'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useReveal } from './use-reveal';

const PERKS: { name: string }[] = [
  { name: 'Log workouts across strength, cardio, HIIT & sport' },
  { name: 'Choose from 4 proven training styles' },
  { name: 'Schedule your recurring week in one tap' },
  { name: 'Create and track goals for sessions, minutes & distance' },
  { name: 'Streaks, volume, calories & body trends' },
  { name: 'Export your data from Profile anytime' },
  { name: 'Installable PWA with an offline shell' },
  { name: 'Local-first storage — no wearable required' },
];

export function FreeListSection() {
  const { ref, visible } = useReveal<HTMLElement>(0.1);
  const [activePerk, setActivePerk] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActivePerk((prev) => (prev + 1) % PERKS.length), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={ref} className="relative overflow-hidden py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="reveal" data-state={visible ? 'visible' : 'hidden-left'}>
            <span className="eyebrow-mono mb-6">Free, with everything you need</span>
            <h2 className="mb-8 text-4xl tracking-tight lg:text-6xl">
              Start free.
              <br />
              Stay free.
            </h2>
            <p className="mb-12 text-xl leading-relaxed text-[color:var(--muted-foreground)]">
              Every core feature is free with no time limit and no card. SmartFit is private by
              design — there is no premium tier and nothing to upsell.
            </p>

            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              <div>
                <div className="font-display mb-2 text-3xl sm:text-4xl lg:text-5xl">$0</div>
                <div className="text-sm text-[color:var(--muted-foreground)]">Forever, no card</div>
              </div>
              <div>
                <div className="font-display mb-2 text-3xl sm:text-4xl lg:text-5xl">4</div>
                <div className="text-sm text-[color:var(--muted-foreground)]">Training styles</div>
              </div>
              <div>
                <div className="font-display mb-2 text-3xl sm:text-4xl lg:text-5xl">100%</div>
                <div className="text-sm text-[color:var(--muted-foreground)]">On-device</div>
              </div>
            </div>
          </div>

          <div className="reveal delay-200" data-state={visible ? 'visible' : 'hidden-right'}>
            <div className="border border-[color:var(--foreground)]/10">
              <div className="flex items-center justify-between border-b border-[color:var(--foreground)]/10 px-6 py-4">
                <span className="font-mono text-sm text-[color:var(--muted-foreground)]">
                  What you get
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-[color:var(--primary)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)]" />
                  Free to start
                </span>
              </div>
              <div>
                {PERKS.map((perk, index) => (
                  <div
                    key={perk.name}
                    className={`flex items-center justify-between border-b px-6 py-5 transition-all duration-300 last:border-b-0 ${
                      activePerk === index ? 'bg-[color:var(--foreground)]/[0.02]' : ''
                    }`}
                    style={{ borderColor: 'rgba(0,0,0,0.05)' }}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                          activePerk === index
                            ? 'bg-[color:var(--foreground)]'
                            : 'bg-[color:var(--foreground)]/20'
                        }`}
                      />
                      <div className="font-medium">{perk.name}</div>
                    </div>
                    <Check className="h-4 w-4 text-[color:var(--foreground)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
