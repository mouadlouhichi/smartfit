import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { SectionHeading } from './section';

const INCLUDED = [
  'Log strength, cardio, HIIT, mobility & sport',
  'Choose from 4 proven training styles',
  'Recurring weekly schedule with rest days',
  'Weekly & monthly goals with live progress',
  '8-week volume, mix & intensity charts',
  'Body-weight and measurement trends',
  'Streaks, demo data and guided onboarding',
  'Export your data anytime · no account',
];

export function PricingSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-6">
      <div className="text-center">
        <SectionHeading eyebrow="Pricing" className="mx-auto">
          Free to start. <span className="text-volt">Free to keep.</span>
        </SectionHeading>
        <p className="mx-auto mt-4 max-w-lg text-paper/60">
          Every feature is free, with no time limit and no card. Fitness tracking should not have a paywall — there is
          no Pro tier to wait for.
        </p>
      </div>

      <div className="mx-auto mt-14 max-w-md">
        <div className="relative overflow-hidden rounded-3xl border-2 border-volt bg-ink-card p-8 shadow-[0_0_60px_-12px_rgba(200,241,53,0.4)]">
          <span className="absolute right-6 top-6 rounded-full bg-volt px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink">
            Forever
          </span>
          <p className="text-sm font-bold uppercase tracking-widest text-paper/50">SmartFit Free</p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className="text-6xl font-extrabold tracking-tight text-volt">$0</span>
            <span className="text-sm font-medium text-paper/50">/ month</span>
          </p>
          <ul className="mt-7 grid gap-3">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-paper/85">
                <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-volt" />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-volt py-4 text-base font-extrabold text-ink transition-transform hover:scale-[1.02] active:scale-95"
          >
            Start training free
          </Link>
        </div>
      </div>
    </section>
  );
}
