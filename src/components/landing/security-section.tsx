'use client';

import { Shield, Lock, Eye, FileCheck } from 'lucide-react';
import { useReveal } from './use-reveal';
import { useI18n } from '@/lib/i18n-context';

const FEATURES = [
  {
    icon: Shield,
    title: 'landing.security.private.title',
    description: 'landing.security.private.body',
  },
  {
    icon: Lock,
    title: 'landing.security.sensors.title',
    description: 'landing.security.sensors.body',
  },
  { icon: Eye, title: 'landing.security.ads.title', description: 'landing.security.ads.body' },
  {
    icon: FileCheck,
    title: 'landing.security.export.title',
    description: 'landing.security.export.body',
  },
];

const BADGES = [
  'landing.security.badge.local',
  'landing.security.badge.noWearable',
  'landing.security.badge.json',
  'landing.security.badge.noAds',
  'landing.security.badge.delete',
];

export function SecuritySection() {
  const { t } = useI18n();
  const { ref, visible } = useReveal<HTMLElement>(0.1);

  return (
    <section
      id="security"
      ref={ref}
      className="relative overflow-hidden bg-[color:var(--foreground)]/[0.02] py-24 lg:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="reveal" data-state={visible ? 'visible' : 'hidden'}>
            <span className="eyebrow-mono mb-6">{t('landing.security.eyebrow')}</span>
            <h2 className="mb-8 text-4xl tracking-tight lg:text-6xl">
              {t('landing.security.title')}
              <br />
              {t('landing.security.titleLine2')}
            </h2>
            <p className="mb-12 text-xl leading-relaxed text-[color:var(--muted-foreground)]">
              {t('landing.security.body')}
            </p>
            <div className="flex flex-wrap gap-3">
              {BADGES.map((cert, index) => (
                <span
                  key={cert}
                  className="reveal border border-[color:var(--foreground)]/10 px-4 py-2 font-mono text-sm transition-all duration-500"
                  data-state={visible ? 'visible' : 'hidden'}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {t(cert)}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.title}
                className="reveal group border border-[color:var(--foreground)]/10 p-6 transition-all duration-500 hover:border-[color:var(--foreground)]/20"
                data-state={visible ? 'visible' : 'hidden-right'}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[color:var(--foreground)]/10 transition-colors duration-300 group-hover:bg-[color:var(--foreground)] group-hover:text-[color:var(--background)]">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-lg font-medium transition-transform duration-300 group-hover:translate-x-1">
                      {t(feature.title)}
                    </h3>
                    <p className="text-[color:var(--muted-foreground)]">{t(feature.description)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
