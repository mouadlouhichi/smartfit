'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AccountLink } from './account-link';
import { ArrowRight } from 'lucide-react';
import { AnimatedSphere } from './animated-sphere';
import { useI18n } from '@/lib/i18n-context';

/** Keys, so the rotating verb rotates in the active language too. */
const WORDS = [
  'landing.hero.word.train',
  'landing.hero.word.perform',
  'landing.hero.word.progress',
  'landing.hero.word.recover',
];

/** Keys and the two literal figures; the values are data, the words are copy. */
const STATS = [
  { value: '4', label: 'landing.hero.stat.styles', detail: 'landing.hero.stat.stylesDetail' },
  {
    value: '5',
    label: 'landing.hero.stat.activities',
    detail: 'landing.hero.stat.activitiesDetail',
  },
  { value: '0', label: 'landing.hero.stat.wearables', detail: 'landing.hero.stat.wearablesDetail' },
  { value: '30s', label: 'landing.hero.stat.logging', detail: 'landing.hero.stat.loggingDetail' },
];

export function HeroSection() {
  const { t } = useI18n();
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWordIndex((current) => (current + 1) % WORDS.length);
    }, 2500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden">
      {/* Animated ASCII sphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-0 h-[600px] w-[600px] -translate-y-1/2 opacity-70 lg:h-[800px] lg:w-[800px]"
      >
        <AnimatedSphere />
      </div>

      {/* Faint blueprint grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-30"
      >
        {[...Array(8)].map((_, index) => (
          <div
            key={`h-${index}`}
            className="absolute inset-x-0 h-px bg-[color:var(--foreground)]/10"
            style={{ top: `${12.5 * (index + 1)}%` }}
          />
        ))}
        {[...Array(12)].map((_, index) => (
          <div
            key={`v-${index}`}
            className="absolute top-0 bottom-0 w-px bg-[color:var(--foreground)]/10"
            style={{ left: `${8.33 * (index + 1)}%` }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-32 lg:px-12 lg:py-40">
        <div className="mb-8">
          <span className="eyebrow-mono">{t('landing.hero.eyebrow')}</span>
        </div>

        <div className="mb-12">
          <h1 className="font-display text-[clamp(2.25rem,12vw,10rem)] leading-[0.9] tracking-tight">
            <span className="block">{t('landing.hero.title')}</span>
            <span className="block whitespace-nowrap">
              {t('landing.hero.turn')}{' '}
              <span className="relative inline-block">
                <span key={wordIndex} className="text-volt-ink inline-flex">
                  {t(WORDS[wordIndex])
                    .split('')
                    .map((character, index) => (
                      <span
                        key={`${wordIndex}-${index}`}
                        className="animate-char-in inline-block"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {character}
                      </span>
                    ))}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-2 h-3 bg-[color:var(--color-volt)]/20"
                />
              </span>
            </span>
          </h1>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-24">
          <p className="max-w-xl text-xl leading-relaxed text-[color:var(--muted-foreground)] lg:text-2xl">
            {t('landing.hero.body')}
          </p>

          <div className="flex flex-col items-start gap-4 sm:flex-row lg:-translate-y-6">
            <AccountLink className="btn-primary group">
              {t('landing.hero.start')}
              <ArrowRight className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </AccountLink>
            <Link href="/#how-it-works" className="btn-outline">
              {t('landing.hero.how')}
            </Link>
          </div>
        </div>
      </div>

      {/* Stat marquee */}
      <div className="absolute inset-x-0 bottom-24 hidden overflow-hidden sm:block">
        <div className="marquee gap-16 whitespace-nowrap">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-16" aria-hidden={setIndex === 1}>
              {STATS.map((stat) => (
                <div key={`${stat.detail}-${setIndex}`} className="flex items-baseline gap-4">
                  <span className="font-display text-4xl lg:text-5xl">{stat.value}</span>
                  <span className="text-sm text-[color:var(--muted-foreground)]">
                    {t(stat.label)}
                    <span className="mt-1 block font-mono text-xs">{t(stat.detail)}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
