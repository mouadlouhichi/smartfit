'use client';

import { PLANS, planDescription, planName } from '@smartfit/core';
import { useReveal } from './use-reveal';
import { useI18n } from '@/lib/i18n-context';

export function PlansSection() {
  const { t } = useI18n();
  const { ref, visible } = useReveal<HTMLElement>(0.1);

  return (
    <section id="plans" ref={ref} className="relative overflow-x-clip py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 max-w-3xl lg:mb-20">
          <span className="eyebrow-mono mb-6">{t('landing.plans.eyebrow')}</span>
          <h2
            className="reveal text-4xl tracking-tight lg:text-6xl"
            data-state={visible ? 'visible' : 'hidden'}
          >
            {t('landing.plans.title')}
            <br />
            <span className="text-[color:var(--muted-foreground)]">
              {t('landing.plans.titleLine2')}
            </span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--muted-foreground)]">
            {t('landing.plans.body')}
          </p>
        </div>

        <div className="grid gap-px overflow-hidden border border-[color:var(--foreground)]/10 bg-[color:var(--foreground)]/10 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, index) => (
            <div
              key={plan.id}
              className="reveal group bg-[color:var(--background)] p-8 transition-colors hover:bg-[color:var(--foreground)]/[0.02]"
              data-state={visible ? 'visible' : 'hidden'}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                {new Intl.NumberFormat('en-GB', {
                  minimumIntegerDigits: 2,
                  useGrouping: false,
                }).format(index + 1)}
              </span>
              <h3 className="font-display mt-4 text-2xl leading-tight">{planName(plan.id, t)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                {planDescription(plan.id, t)}
              </p>
              <div className="mt-6 flex items-center gap-2 font-mono text-xs">
                <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--primary)]" />
                {t('landing.plans.sessions', { count: plan.sessionsPerWeek })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
