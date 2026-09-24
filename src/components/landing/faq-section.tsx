'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n-context';

const FAQS = [
  {
    q: 'landing.faq.free.q',
    a: 'landing.faq.free.a',
  },
  {
    q: 'landing.faq.pro.q',
    a: 'landing.faq.pro.a',
  },
  {
    q: 'landing.faq.proPrivacy.q',
    a: 'landing.faq.proPrivacy.a',
  },
  {
    q: 'landing.faq.wearable.q',
    a: 'landing.faq.wearable.a',
  },
  {
    q: 'landing.faq.styles.q',
    a: 'landing.faq.styles.a',
  },
  {
    q: 'landing.faq.activities.q',
    a: 'landing.faq.activities.a',
  },
  {
    q: 'landing.faq.privacy.q',
    a: 'landing.faq.privacy.a',
  },
  {
    q: 'landing.faq.export.q',
    a: 'landing.faq.export.a',
  },
  {
    q: 'landing.faq.delete.q',
    a: 'landing.faq.delete.a',
  },
  {
    q: 'landing.faq.different.q',
    a: 'landing.faq.different.a',
  },
];

export function FaqSection() {
  const { t } = useI18n();
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="relative overflow-x-clip border-t border-[color:var(--foreground)]/10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-5xl px-6 lg:px-12">
        <div className="mb-12 max-w-3xl lg:mb-16">
          <span className="mb-6 block font-mono text-xs tracking-widest text-[color:var(--muted-foreground)] uppercase">
            {t('landing.faq.eyebrow')}
          </span>
          <h2
            id="faq-heading"
            className="font-display text-4xl tracking-tight md:text-5xl lg:text-6xl"
          >
            {t('landing.faq.title')}
          </h2>
          <p className="mt-6 text-[color:var(--muted-foreground)]">
            {t('landing.faq.learnMore')}{' '}
            <Link
              href="/#integrations"
              className="text-[color:var(--foreground)] underline underline-offset-4 hover:no-underline"
            >
              {t('landing.faq.linkActivities')}
            </Link>{' '}
            ·{' '}
            <Link
              href="/#plans"
              className="text-[color:var(--foreground)] underline underline-offset-4 hover:no-underline"
            >
              {t('landing.faq.linkStyles')}
            </Link>{' '}
            ·{' '}
            <Link
              href="/#guides"
              className="text-[color:var(--foreground)] underline underline-offset-4 hover:no-underline"
            >
              {t('landing.faq.linkGuides')}
            </Link>
          </p>
        </div>

        <div className="divide-y divide-[color:var(--foreground)]/10 border-y border-[color:var(--foreground)]/10">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-6 lg:py-8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-medium text-[color:var(--foreground)] marker:content-none lg:text-2xl">
                {t(faq.q)}
                <span
                  aria-hidden="true"
                  className="shrink-0 font-mono text-2xl font-normal text-[color:var(--muted-foreground)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pt-4 text-base leading-relaxed text-[color:var(--muted-foreground)] lg:text-lg">
                {t(faq.a)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
