'use client';

import { useMemo } from 'react';
import { Activity, Crown, Lock } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useModals } from './modal-context';
import { Button } from '@/components/ui/button';
import { hasProAccess, loadSeries, readiness } from '@smartfit/core';
import { cn } from '@/lib/utils';

const LABEL_TONE: Record<string, string> = {
  Ready: 'text-primary',
  Steady: 'text-foreground',
  'Easy day': 'text-muted-foreground',
  Calibrating: 'text-muted-foreground',
};

/**
 * Daily readiness from training-derived load (acute:chronic tonnage, days
 * since the last hard session, planned rest days). The label is free for
 * everyone; the score, drivers and 28-day load chart are the Pro unlock —
 * free users see the score blurred as the paywall's shop window.
 */
export function ReadinessCard() {
  const { state } = useStore();
  const { openWith } = useModals();
  const { t } = useI18n();
  const pro = hasProAccess(state);
  const ready = useMemo(() => readiness(state), [state]);
  const series = useMemo(() => (pro ? loadSeries(state, 28) : []), [state, pro]);
  const max = Math.max(1, ...series.map((p) => p.volume));

  return (
    <section
      aria-label={t('overview.readiness.aria')}
      className="bg-card rounded-[2rem] p-5 shadow-sm min-[420px]:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-xl">
            <Activity className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight">
              {t('overview.readiness.title')}{' '}
              <span className={cn('font-bold', LABEL_TONE[ready.label])}>· {ready.label}</span>
            </p>
            <p className="text-muted-foreground text-xs">{t('overview.readiness.subtitle')}</p>
          </div>
        </div>
        {pro && ready.score !== null ? (
          <p
            className="font-display text-3xl font-extrabold tabular-nums"
            aria-label={t('overview.readiness.scoreAria', { score: ready.score ?? 0 })}
          >
            {ready.score}
            <span className="text-muted-foreground text-sm font-bold">/100</span>
          </p>
        ) : ready.score === null ? (
          <span className="bg-secondary rounded-full px-3 py-1.5 text-xs font-bold">—</span>
        ) : (
          <button
            onClick={() => openWith({ kind: 'pro' })}
            className="press relative rounded-2xl"
            aria-label={t('overview.readiness.unlockAria')}
            title={t('overview.readiness.unlockTitle')}
          >
            <span
              className="font-display text-3xl font-extrabold tabular-nums blur-md select-none"
              aria-hidden
            >
              {ready.score}
            </span>
            <Lock
              className="bg-primary text-primary-foreground absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full p-1"
              aria-hidden
            />
          </button>
        )}
      </div>

      {pro ? (
        <div className="mt-4">
          <ul className="grid gap-1.5">
            {ready.factors.map((f) => (
              <li key={f} className="text-muted-foreground text-sm">
                • {f}
              </li>
            ))}
          </ul>
          {series.length > 0 && (
            <div className="mt-4">
              <div
                className="flex h-14 items-end gap-[3px]"
                role="img"
                aria-label={t('overview.readiness.loadAria', { ratio: ready.ratio })}
              >
                {series.map((p) => (
                  <div
                    key={p.date}
                    title={`${p.date}: ${p.volume} kg`}
                    className={cn(
                      'min-w-0 flex-1 rounded-sm',
                      p.volume > 0 ? 'bg-primary/80' : 'bg-secondary',
                    )}
                    style={{ height: `${Math.max(6, Math.round((p.volume / max) * 100))}%` }}
                  />
                ))}
              </div>
              <div className="text-muted-foreground mt-1.5 flex justify-between text-[11px] tabular-nums">
                <span>{t('overview.readiness.daysAgo')}</span>
                <span>
                  {t('overview.readiness.loadRatio')}{' '}
                  <b className="text-foreground">{ready.ratio}</b> ·{' '}
                  {t('overview.readiness.loadNote')}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="relative overflow-hidden rounded-2xl">
            <div className="grid gap-1.5 blur-[6px] select-none" aria-hidden>
              <p className="bg-secondary rounded-lg px-3 py-2 text-sm">
                {t('overview.readiness.gate1')}
              </p>
              <p className="bg-secondary rounded-lg px-3 py-2 text-sm">
                {t('overview.readiness.gate2')}
              </p>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Button size="sm" onClick={() => openWith({ kind: 'pro' })}>
                <Crown className="h-3.5 w-3.5" /> {t('overview.readiness.unlockCta')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
