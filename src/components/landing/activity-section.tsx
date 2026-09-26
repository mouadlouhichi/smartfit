'use client';

import Link from 'next/link';
import { AccountLink } from './account-link';
import { useReveal } from './use-reveal';
import { useI18n } from '@/lib/i18n-context';

/** Keys — the marquee shows the same twelve types in every language. */
const ACTIVITIES = [
  { name: 'landing.activity.strength', category: 'landing.activity.strength.hint' },
  { name: 'landing.activity.cardio', category: 'landing.activity.cardio.hint' },
  { name: 'landing.activity.hiit', category: 'landing.activity.hiit.hint' },
  { name: 'landing.activity.mobility', category: 'landing.activity.mobility.hint' },
  { name: 'landing.activity.sports', category: 'landing.activity.sports.hint' },
  { name: 'landing.activity.swimming', category: 'landing.activity.swimming.hint' },
  { name: 'landing.activity.rowing', category: 'landing.activity.rowing.hint' },
  { name: 'landing.activity.boxing', category: 'landing.activity.boxing.hint' },
  { name: 'landing.activity.walking', category: 'landing.activity.walking.hint' },
  { name: 'landing.activity.hiking', category: 'landing.activity.hiking.hint' },
  { name: 'landing.activity.rest', category: 'landing.activity.rest.hint' },
  { name: 'landing.activity.custom', category: 'landing.activity.custom.hint' },
];

export function ActivitySection() {
  const { t } = useI18n();
  const { ref, visible } = useReveal<HTMLElement>(0.1);

  return (
    <section id="integrations" ref={ref} className="relative overflow-hidden py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div
          className="reveal mx-auto mb-16 max-w-3xl text-center lg:mb-24"
          data-state={visible ? 'visible' : 'hidden'}
        >
          <span
            className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-[color:var(--muted-foreground)]"
            style={{ display: 'inline-flex' }}
          >
            <span className="h-px w-8 bg-[color:var(--foreground)]/30" />
            {t('landing.activity.eyebrow')}
            <span className="h-px w-8 bg-[color:var(--foreground)]/30" />
          </span>
          <h2 className="mb-6 text-4xl tracking-tight lg:text-6xl">
            {t('landing.activity.title')}
            <br />
            {t('landing.activity.titleLine2')}
          </h2>
          <p className="text-xl text-[color:var(--muted-foreground)]">
            {t('landing.activity.body')}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <AccountLink className="inline-flex items-center rounded-full border border-[color:var(--foreground)]/10 px-4 py-2 text-xs font-medium transition-colors hover:border-[color:var(--foreground)]/30">
              {t('landing.activity.startWithPlan')}
            </AccountLink>
            <Link
              href="/#plans"
              className="inline-flex items-center rounded-full border border-[color:var(--foreground)]/10 px-4 py-2 text-xs font-medium transition-colors hover:border-[color:var(--foreground)]/30"
            >
              {t('landing.activity.styles')}
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width marquees */}
      <div className="mb-6 w-full">
        <div className="marquee gap-6">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex shrink-0 gap-6" aria-hidden={setIndex === 1}>
              {ACTIVITIES.map((a) => (
                <div
                  key={`${a.name}-${setIndex}`}
                  className="group shrink-0 border border-[color:var(--foreground)]/10 px-8 py-6 transition-all duration-300 hover:border-[color:var(--foreground)]/30 hover:bg-[color:var(--foreground)]/[0.02]"
                >
                  <div className="text-lg font-medium transition-transform group-hover:translate-x-1">
                    {t(a.name)}
                  </div>
                  <div className="text-sm text-[color:var(--muted-foreground)]">
                    {t(a.category)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full">
        <div className="marquee-reverse gap-6">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex shrink-0 gap-6" aria-hidden={setIndex === 1}>
              {[...ACTIVITIES].reverse().map((a) => (
                <div
                  key={`${a.name}-reverse-${setIndex}`}
                  className="group shrink-0 border border-[color:var(--foreground)]/10 px-8 py-6 transition-all duration-300 hover:border-[color:var(--foreground)]/30 hover:bg-[color:var(--foreground)]/[0.02]"
                >
                  <div className="text-lg font-medium transition-transform group-hover:translate-x-1">
                    {t(a.name)}
                  </div>
                  <div className="text-sm text-[color:var(--muted-foreground)]">
                    {t(a.category)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
