'use client';

import Link from 'next/link';
import { useReveal } from './use-reveal';

const ACTIVITIES = [
  { name: 'Strength', category: 'Weights · bodybuilding' },
  { name: 'Cardio', category: 'Running · cycling' },
  { name: 'HIIT', category: 'Intervals · circuits' },
  { name: 'Mobility', category: 'Yoga · stretching' },
  { name: 'Sports', category: 'Football · court sports' },
  { name: 'Swimming', category: 'Laps · endurance' },
  { name: 'Rowing', category: 'Erg · on-water' },
  { name: 'Boxing', category: 'Heavy bag · pads' },
  { name: 'Walking', category: 'Steps · zone 2' },
  { name: 'Hiking', category: 'Trails · elevation' },
  { name: 'Rest', category: 'Active recovery' },
  { name: 'Custom', category: 'Add your own type' },
];

export function ActivitySection() {
  const { ref, visible } = useReveal<HTMLElement>(0.1);

  return (
    <section id="integrations" ref={ref} className="relative overflow-hidden py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div
          className="reveal mx-auto mb-16 max-w-3xl text-center lg:mb-24"
          data-state={visible ? 'visible' : 'hidden'}
        >
          <span
            className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-[color:var(--muted-foreground)]"
            style={{ display: 'inline-flex' }}
          >
            <span className="h-px w-8 bg-[color:var(--foreground)]/30" />
            Activity types
            <span className="h-px w-8 bg-[color:var(--foreground)]/30" />
          </span>
          <h2 className="mb-6 text-4xl tracking-tight lg:text-6xl">
            However you move,
            <br />
            we track it.
          </h2>
          <p className="text-xl text-[color:var(--muted-foreground)]">
            Every session maps to a type, and every type feeds your plan, goals and trends. Change
            your strategy from Profile anytime.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-[color:var(--foreground)]/10 px-4 py-2 text-xs font-medium transition-colors hover:border-[color:var(--foreground)]/30"
            >
              Start with a plan →
            </Link>
            <Link
              href="/#plans"
              className="inline-flex items-center rounded-full border border-[color:var(--foreground)]/10 px-4 py-2 text-xs font-medium transition-colors hover:border-[color:var(--foreground)]/30"
            >
              4 training styles →
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width marquees */}
      <div className="mb-6 w-full">
        <div className="marquee gap-6">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex shrink-0 gap-6" aria-hidden={setIndex === 1}>
              {ACTIVITIES.map((a) => (
                <div
                  key={`${a.name}-${setIndex}`}
                  className="group shrink-0 border border-[color:var(--foreground)]/10 px-8 py-6 transition-all duration-300 hover:border-[color:var(--foreground)]/30 hover:bg-[color:var(--foreground)]/[0.02]"
                >
                  <div className="text-lg font-medium transition-transform group-hover:translate-x-1">
                    {a.name}
                  </div>
                  <div className="text-sm text-[color:var(--muted-foreground)]">{a.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full">
        <div className="marquee-reverse gap-6">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex shrink-0 gap-6" aria-hidden={setIndex === 1}>
              {[...ACTIVITIES].reverse().map((a) => (
                <div
                  key={`${a.name}-reverse-${setIndex}`}
                  className="group shrink-0 border border-[color:var(--foreground)]/10 px-8 py-6 transition-all duration-300 hover:border-[color:var(--foreground)]/30 hover:bg-[color:var(--foreground)]/[0.02]"
                >
                  <div className="text-lg font-medium transition-transform group-hover:translate-x-1">
                    {a.name}
                  </div>
                  <div className="text-sm text-[color:var(--muted-foreground)]">{a.category}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
