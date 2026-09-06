import Link from 'next/link';
import { Check } from 'lucide-react';
import { Eyebrow, Section } from './section';

const FEATURES = [
  'Log workouts across strength, cardio, HIIT, mobility and sport',
  'Choose from 4 proven training styles',
  'Schedule your recurring week in one tap',
  'Set goals for workouts, minutes and distance',
  'Track streaks, volume, calories and body trends',
  'Log bodyweight & measurements with private charts',
  'Export your data anytime from Profile',
  'Installable PWA with a fully offline shell',
];

export function FeaturesListSection() {
  return (
    <Section id="features-list" alt>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow>Free, with everything you need</Eyebrow>
          <h2 className="mt-3 font-display-tight text-4xl font-extrabold text-ink-warm sm:text-5xl">
            Start free. <span className="italic text-ember">Stay free.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-clay">
            Every core feature is free with no time limit and no card. SmartFit is private by design and funded by
            nothing but your gains — there is no premium tier and no paywall.
          </p>
          <Link
            href="/onboarding"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-ember px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-ember/30 transition-transform hover:scale-[1.03]"
          >
            Start training free
          </Link>
        </div>

        <div className="rounded-3xl border border-black/10 bg-paper-warm p-6 sm:p-8">
          <p className="eyebrow text-clay">What you get</p>
          <p className="mt-1 font-display text-xl font-extrabold text-ink-warm">
            Free to start — and to stay
          </p>
          <ul className="mt-5 grid gap-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm font-medium text-ink-warm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember text-white">
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
