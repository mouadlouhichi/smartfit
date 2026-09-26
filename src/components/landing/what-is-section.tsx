'use client';

import { useI18n } from '@/lib/i18n-context';

export function WhatIsSection() {
  const { t } = useI18n();
  return (
    <section
      aria-labelledby="what-is-smartfit"
      className="relative border-y border-[color:var(--foreground)]/10 bg-[color:var(--foreground)]/[0.02] py-16 lg:py-20"
    >
      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)] lg:gap-16 lg:px-12">
        <h2 id="what-is-smartfit" className="font-display text-3xl tracking-tight lg:text-4xl">
          {t('landing.whatIs.title')}
          <br />
          {t('landing.whatIs.titleLine2')}
        </h2>
        <p className="max-w-4xl text-lg leading-relaxed text-[color:var(--muted-foreground)] lg:text-xl">
          {t('landing.whatIs.body')}
        </p>
      </div>
    </section>
  );
}
