'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    description: 'The full training core, free forever. Log everything, keep everything.',
    price: '$0',
    period: '/ forever',
    cta: 'Start training free',
    popular: false,
    features: [
      'Unlimited workout logging & history',
      'Choose from 4 training styles',
      'Schedule your recurring week',
      'Goals, streaks, records & badges',
      'Body trends & progress charts',
      'JSON + CSV export, erase anytime',
    ],
  },
  {
    name: 'Pro',
    description: 'Training intelligence: know what it means, know what to do next.',
    price: '$4.17',
    period: '/ mo, billed yearly ($49.99)',
    cta: 'Start 14-day free trial',
    popular: true,
    features: [
      'Everything in Free',
      'Adaptive progression targets every set',
      'Daily readiness score & load chart',
      'Quarter, year & all-time analytics',
      'Unlimited AI coach replies',
      'Unlimited routines, no-watermark shares',
    ],
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative overflow-x-clip border-t border-[color:var(--foreground)]/10 py-32 lg:py-40"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-20 max-w-3xl">
          <span className="mb-6 block font-mono text-xs tracking-widest text-[color:var(--muted-foreground)] uppercase">
            Pricing
          </span>
          <h2 className="font-display mb-6 text-5xl tracking-tight md:text-6xl lg:text-7xl">
            Free to start.
            <br />
            <span className="text-stroke">Pro when ready.</span>
          </h2>
          <p className="max-w-xl text-lg text-[color:var(--muted-foreground)]">
            Free logs everything, forever, privately. Pro tells you what your training means and
            what to do next — computed on your device, from your own data.
          </p>
        </div>

        <div className="grid max-w-4xl gap-px bg-[color:var(--foreground)]/10 md:grid-cols-2">
          {PLANS.map((planData, idx) => (
            <div
              key={planData.name}
              className={`relative bg-[color:var(--background)] p-8 lg:p-12 ${
                planData.popular
                  ? 'border-2 border-[color:var(--primary)] md:-my-4 md:py-12 lg:py-16'
                  : ''
              }`}
            >
              {planData.popular && (
                <span className="absolute start-8 -top-3 bg-[color:var(--primary)] px-3 py-1 font-mono text-xs tracking-widest text-white uppercase">
                  Most popular
                </span>
              )}

              <div className="mb-8">
                <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                  {new Intl.NumberFormat('en-US', {
                    minimumIntegerDigits: 2,
                    useGrouping: false,
                  }).format(idx + 1)}
                </span>
                <h3 className="font-display mt-2 text-3xl">{planData.name}</h3>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {planData.description}
                </p>
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
          Prefer one payment? Lifetime Pro is $99 — pay once, train forever. Monthly is $6.99. Your
          training stays private on every tier.
        </p>
      </div>
    </section>
  );
}
