'use client';

import { AccountLink } from './account-link';
import { ArrowRight, Check } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

const PLANS = [
  {
    name: 'landing.pricing.free.name',
    description: 'landing.pricing.free.body',
    price: '$0',
    period: 'landing.pricing.free.period',
    cta: 'landing.hero.start',
    popular: false,
    features: [
      'landing.pricing.free.feature1',
      'landing.pricing.free.feature2',
      'landing.pricing.free.feature3',
      'landing.pricing.free.feature4',
      'landing.pricing.free.feature5',
      'landing.pricing.free.feature6',
    ],
  },
  {
    name: 'landing.pricing.pro.name',
    description: 'landing.pricing.pro.body',
    price: '—',
    period: 'landing.pricing.pro.period',
    cta: 'landing.pricing.pro.cta',
    popular: true,
    features: [
      'landing.pricing.pro.feature1',
      'landing.pricing.pro.feature2',
      'landing.pricing.pro.feature3',
      'landing.pricing.pro.feature4',
      'landing.pricing.pro.feature5',
      'landing.pricing.pro.feature6',
    ],
  },
];

export function PricingSection() {
  const { t } = useI18n();
  return (
    <section
      id="pricing"
      className="relative overflow-x-clip border-t border-[color:var(--foreground)]/10 py-32 lg:py-40"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-20 max-w-3xl">
          <span className="mb-6 block font-mono text-xs tracking-widest text-[color:var(--muted-foreground)] uppercase">
            {t('landing.pricing.eyebrow')}
          </span>
          <h2 className="font-display mb-6 text-5xl tracking-tight md:text-6xl lg:text-7xl">
            {t('landing.pricing.title')}
            <br />
            <span className="text-stroke">{t('landing.free.titleLine2')}</span>
          </h2>
          <p className="max-w-xl text-lg text-[color:var(--muted-foreground)]">
            {t('landing.pricing.body')}
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
                <span className="absolute start-8 -top-3 bg-[color:var(--primary)] px-3 py-1 font-mono text-xs tracking-widest text-[color:var(--primary-foreground)] uppercase">
                  {t('landing.pricing.popular')}
                </span>
              )}

              <div className="mb-8">
                <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                  {new Intl.NumberFormat('en-US', {
                    minimumIntegerDigits: 2,
                    useGrouping: false,
                  }).format(idx + 1)}
                </span>
                <h3 className="font-display mt-2 text-3xl">{t(planData.name)}</h3>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {t(planData.description)}
                </p>
              </div>

              <div className="mb-8 border-b border-[color:var(--foreground)]/10 pb-8">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl lg:text-6xl">{planData.price}</span>
                  <span className="text-[color:var(--muted-foreground)]">{t(planData.period)}</span>
                </div>
              </div>

              <ul className="mb-10 space-y-4">
                {planData.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--foreground)]" />
                    <span className="text-sm text-[color:var(--muted-foreground)]">
                      {t(feature)}
                    </span>
                  </li>
                ))}
              </ul>

              <AccountLink
                className={`group flex w-full items-center justify-center gap-2 py-4 text-sm font-medium transition-all ${
                  planData.popular
                    ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--primary)]/90'
                    : 'border border-[color:var(--foreground)]/20 text-[color:var(--foreground)] hover:border-[color:var(--foreground)] hover:bg-[color:var(--foreground)]/5'
                }`}
              >
                {t(planData.cta)}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </AccountLink>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-[color:var(--muted-foreground)]">
          {t('landing.pricing.note')}
        </p>
      </div>
    </section>
  );
}
