import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PLANS } from '@smartfit/core';
import { SectionHeading } from './section';

export function PlansSection() {
  return (
    <section id="plans" className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <SectionHeading eyebrow="Training styles">
        Works with <span className="text-volt">however you train.</span>
      </SectionHeading>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-3xl border border-white/10 bg-ink-card p-7 transition-colors hover:border-volt/40"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold">{p.name}</h3>
              <span className="rounded-full bg-volt px-3 py-1 text-sm font-bold text-ink">{p.sessionsPerWeek}× / week</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-paper/60">{p.description}</p>
            <ul className="mt-5 grid flex-1 gap-2.5">
              {p.split.map((slot, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-paper/80">
                  <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-volt" />
                  {slot.focus}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/onboarding"
          className="group inline-flex items-center gap-2 rounded-full bg-volt px-7 py-4 text-base font-extrabold text-ink transition-transform hover:scale-[1.03] active:scale-95"
        >
          Pick your plan
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-4 text-base font-bold text-paper transition-colors hover:bg-white/5"
        >
          Explore the demo
        </Link>
      </div>
    </section>
  );
}
