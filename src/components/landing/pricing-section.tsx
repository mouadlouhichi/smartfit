import Link from 'next/link';
import { Check } from 'lucide-react';
import { Eyebrow, Section } from './section';

const FREE = [
  'Choose from 4 training styles',
  'Log strength, cardio, HIIT & sport',
  'Schedule your recurring week',
  'Goals, streaks & body trends',
  'Private on-device storage',
  'Export your data anytime',
  'Installable PWA, works offline',
];

export function PricingSection() {
  return (
    <Section id="pricing" alt>
      <div className="text-center">
        <Eyebrow className="text-center">Pricing</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-2xl font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
          Free to start. <span className="italic text-ember">Free forever.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-clay">
          Every feature is free, with no time limit and no card. SmartFit is private and local-first — there is
          nothing to upsell.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-md">
        <div className="overflow-hidden rounded-3xl border-2 border-ember bg-white shadow-xl shadow-ember/10">
          <div className="flex items-center justify-between bg-ember px-7 py-4 text-white">
            <span className="font-display text-lg font-extrabold">Free</span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
              No time limit
            </span>
          </div>
          <div className="p-7">
            <p className="flex items-baseline gap-1">
              <span className="font-display text-5xl font-extrabold text-ink-warm">$0</span>
              <span className="text-sm font-semibold text-clay">/ forever</span>
            </p>
            <p className="mt-2 text-sm font-medium text-clay">Everything you need to train for real.</p>
            <ul className="mt-6 grid gap-3">
              {FREE.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm font-medium text-ink-warm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember text-white">
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/onboarding"
              className="mt-7 block rounded-full bg-ember py-3.5 text-center text-sm font-bold text-white shadow-md shadow-ember/30 transition-transform hover:scale-[1.02]"
            >
              Start free
            </Link>
            <p className="mt-4 text-center text-xs text-clay">
              Your training stays private. No card, no trial, no subscription — ever.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
