'use client';

import Link from 'next/link';
import { AccountLink } from './account-link';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';

const GUIDES = [
  {
    category: 'landing.guides.foundations.category',
    readTime: 'landing.guides.foundations.readTime',
    title: 'landing.guides.foundations.title',
    excerpt: 'landing.guides.foundations.excerpt',
    anchor: 'landing.guides.foundations.anchor',
  },
  {
    category: 'landing.guides.methods.category',
    readTime: 'landing.guides.methods.readTime',
    title: 'landing.guides.methods.title',
    excerpt: 'landing.guides.methods.excerpt',
    anchor: 'landing.guides.methods.anchor',
  },
  {
    category: 'landing.guides.consistency.category',
    readTime: 'landing.guides.consistency.readTime',
    title: 'landing.guides.consistency.title',
    excerpt: 'landing.guides.consistency.excerpt',
    anchor: 'landing.guides.consistency.anchor',
  },
];

export function GuidesSection() {
  const { t } = useI18n();
  return (
    <section
      id="guides"
      className="relative border-t border-[color:var(--foreground)]/10 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-16 max-w-3xl lg:mb-20">
          <span className="eyebrow-mono mb-6">{t('landing.guides.eyebrow')}</span>
          <h2 className="mb-6 text-4xl tracking-tight lg:text-6xl">
            {t('landing.guides.title')}
            <br />
            <span className="text-[color:var(--muted-foreground)]">
              {t('landing.guides.titleLine2')}
            </span>
          </h2>
          <p className="text-lg leading-relaxed text-[color:var(--muted-foreground)]">
            {t('landing.guides.body')}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 lg:gap-10">
          {GUIDES.map((guide) => (
            <article
              key={guide.title}
              className="group flex flex-col border border-[color:var(--foreground)]/10 p-7 transition-colors hover:border-[color:var(--foreground)]/20 lg:p-8"
            >
              <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="rounded-full bg-[color:var(--foreground)]/5 px-2.5 py-1 font-mono text-xs text-[color:var(--muted-foreground)]">
                  {t(guide.category)}
                </span>
                <span className="font-mono text-xs text-[color:var(--muted-foreground)]">
                  {t(guide.readTime)}
                </span>
              </div>
              <h3 className="font-display mb-3 text-xl transition-colors group-hover:text-[color:var(--primary)] lg:text-2xl">
                {t(guide.title)}
              </h3>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-[color:var(--muted-foreground)]">
                {t(guide.excerpt)}
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)] underline-offset-4 group-hover:underline">
                {t(guide.anchor)}{' '}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <AccountLink className="inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)] px-6 py-3 text-sm font-medium text-[color:var(--background)] hover:bg-[color:var(--foreground)]/90">
            {t('landing.hero.start')} <ArrowRight className="h-4 w-4" />
          </AccountLink>
          <Link
            href="/#features"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--foreground)]/10 px-6 py-3 text-sm font-medium hover:border-[color:var(--foreground)]/30"
          >
            {t('landing.guides.whatYouCanLog')}
          </Link>
          <Link
            href="/#plans"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--foreground)]/10 px-6 py-3 text-sm font-medium hover:border-[color:var(--foreground)]/30"
          >
            {t('landing.guides.styles')}
          </Link>
        </div>
      </div>
    </section>
  );
}
