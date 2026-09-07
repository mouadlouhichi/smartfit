'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    description: 'Everything you need to train for real, with no time limit.',
    price: '$0',
    period: '/ forever',
    cta: 'Start training free',
    popular: false,
    features: [
      'Choose from 4 training styles',
      'Log strength, cardio, HIIT & sport',
      'Schedule your recurring week',
      'Goals, streaks & body trends',
      'Private on-device storage',
    ],
  },
  {
    name: 'Also free',
    description: 'There is no premium tier — every advanced feature is included.',
    price: '$0',
    period: '/ forever',
    cta: 'Open the app',
    popular: true,
    features: [
      'Everything in Free',
      'AI Coach insights from your data',
      'Progress charts & activity breakdowns',
      'Custom activity types',
      'Export JSON / erase anytime',
      'Installable PWA, works offline',
    ],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative overflow-x-clip border-t border-[color:var(--foreground)]/10 py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-20 max-w-3xl">
          <span className="mb-6 block font-mono text-xs uppercase tracking-widest text-[color:var(--muted-foreground)]">
            Pricing
          </span>
          <h2 className="mb-6 font-display text-5xl tracking-tight md:text-6xl lg:text-7xl">
            Free to start.
            <br />
            <span className="text-stroke">Free forever.</span>
          </h2>
          <p className="max-w-xl text-lg text-[color:var(--muted-foreground)]">
            Every feature is free, with no card and no trial that runs out. SmartFit is private and local-first —
            there is nothing to upsell.
          </p>
        </div>

        <div className="grid max-w-4xl gap-px bg-[color:var(--foreground)]/10 md:grid-cols-2">
          {PLANS.map((planData, idx) => (
            <div
              key={planData.name}
              className={`relative bg-[color:var(--background)] p-8 lg:p-12 ${
                planData.popular ? 'border-2 border-[color:var(--primary)] md:-my-4 md:py-12 lg:py-16' : ''
              }`}
            >
              {planData.popular && (
                <span className="absolute -top-3 start-8 bg-[color:var(--primary)] px-3 py-1 font-mono text-xs uppercase tracking-widest text-white">
                  Everything included
                </span>
              )}

              <div className="mb-8">
                <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                  {new Intl.NumberFormat('en-US', { minimumIntegerDigits: 2, useGrouping: false }).format(idx + 1)}
                </span>
                <h3 className="mt-2 font-display text-3xl">{planData.name}</h3>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{planData.description}</p>
              </div>

              <div className="mb-8 border-b border-[color:var(--foreground)]/10 pb-8">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl lg:text-6xl">{planData.price}</span>
                  <span className="text-[color:var(--muted-foreground)]">{planData.period}</span>
                </div>
              </div>

              <ul className="mb-10 space-y-4">
                {planData.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--foreground)]" />
                    <span className="text-sm text-[color:var(--muted-foreground)]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`group flex w-full items-center justify-center gap-2 py-4 text-sm font-medium transition-all ${
                  planData.popular
                    ? 'bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary)]/90'
                    : 'border border-[color:var(--foreground)]/20 text-[color:var(--foreground)] hover:border-[color:var(--foreground)] hover:bg-[color:var(--foreground)]/5'
                }`}
              >
                {planData.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-[color:var(--muted-foreground)]">
          Your training stays private. No card, no trial, no subscription — ever.
        </p>
      </div>
    </section>
  );
}
