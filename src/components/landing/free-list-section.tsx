'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useReveal } from './use-reveal';
import { useI18n } from '@/lib/i18n-context';

const PERKS = [
  'landing.free.perk1',
  'landing.free.perk2',
  'landing.free.perk3',
  'landing.free.perk4',
  'landing.free.perk5',
  'landing.free.perk6',
  'landing.free.perk7',
  'landing.free.perk8',
];

export function FreeListSection() {
  const { t } = useI18n();
  const { ref, visible } = useReveal<HTMLElement>(0.1);
  const [activePerk, setActivePerk] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActivePerk((prev) => (prev + 1) % PERKS.length), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={ref} className="relative overflow-hidden py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="reveal" data-state={visible ? 'visible' : 'hidden-left'}>
            <span className="eyebrow-mono mb-6">{t('landing.free.eyebrow')}</span>
            <h2 className="mb-8 text-4xl tracking-tight lg:text-6xl">
              {t('landing.free.title')}
              <br />
              {t('landing.free.titleLine2')}
            </h2>
            <p className="mb-12 text-xl leading-relaxed text-[color:var(--muted-foreground)]">
              {t('landing.free.body')}
            </p>

            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              <div>
                <div className="font-display mb-2 text-3xl sm:text-4xl lg:text-5xl">$0</div>
                <div className="text-sm text-[color:var(--muted-foreground)]">
                  {t('landing.free.stat.price')}
                </div>
              </div>
              <div>
                <div className="font-display mb-2 text-3xl sm:text-4xl lg:text-5xl">4</div>
                <div className="text-sm text-[color:var(--muted-foreground)]">
                  {t('landing.free.stat.styles')}
                </div>
              </div>
              <div>
                <div className="font-display mb-2 text-3xl sm:text-4xl lg:text-5xl">100%</div>
                <div className="text-sm text-[color:var(--muted-foreground)]">
                  {t('landing.free.stat.device')}
                </div>
              </div>
            </div>
          </div>

          <div className="reveal delay-200" data-state={visible ? 'visible' : 'hidden-right'}>
            <div className="border border-[color:var(--foreground)]/10">
              <div className="flex items-center justify-between border-b border-[color:var(--foreground)]/10 px-6 py-4">
                <span className="font-mono text-sm text-[color:var(--muted-foreground)]">
                  {t('landing.free.whatYouGet')}
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-[color:var(--primary)]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)]" />
                  {t('landing.free.freeToStart')}
                </span>
              </div>
              <div>
                {PERKS.map((key, index) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between border-b px-6 py-5 transition-all duration-300 last:border-b-0 ${
                      activePerk === index ? 'bg-[color:var(--foreground)]/[0.02]' : ''
                    }`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                          activePerk === index
                            ? 'bg-[color:var(--foreground)]'
                            : 'bg-[color:var(--foreground)]/20'
                        }`}
                      />
                      <div className="font-medium">{t(key)}</div>
                    </div>
                    <Check className="h-4 w-4 text-[color:var(--foreground)]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
