'use client';

import { useState } from 'react';
import { ChevronDown, Info, Sparkles, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-context';
import { formatNumber } from '@smartfit/core';
import type { XpSummary } from '@smartfit/core';

/**
 * The XP / level card.
 *
 * TapTap-style progression, built the way the rest of SmartFit is built: the
 * number is derived from the log, and the card can explain it. `xpSummary`
 * already returns the itemised statement, so the "where do the XP come from"
 * disclosure is a render of data we already have, not a second calculation
 * that could disagree with the total on screen.
 */
export function XpCard({ summary }: { summary: XpSummary }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className="bg-volt text-ink shadow-volt/30 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-lg"
          >
            <span className="font-display text-2xl leading-none font-extrabold">
              {summary.level}
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-bold tracking-[0.18em] uppercase">
              {t('xp.level', { level: summary.level })}
            </p>
            <h3 className="font-display-tight truncate text-lg font-extrabold tracking-tight">
              {summary.title}
            </h3>
            <div className="mt-2 flex items-center gap-3">
              <Progress
                value={summary.progressPct}
                className="h-2"
                aria-label={t('xp.progress', { into: summary.into, needed: summary.needed })}
              />
              <span className="text-muted-foreground shrink-0 text-xs font-bold tabular-nums">
                {t('xp.remaining', { xp: summary.remaining, level: summary.level + 1 })}
              </span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-muted-foreground text-[11px] font-bold uppercase">
              {t('xp.total', { xp: formatNumber(summary.xp, 0) })}
            </p>
            {summary.thisWeek > 0 && (
              <p className="text-volt-ink mt-0.5 flex items-center justify-end gap-1 text-sm font-extrabold tabular-nums">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                {t('xp.thisWeek', { xp: summary.thisWeek })}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground mt-4 flex items-center gap-1.5 text-xs font-bold"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
          {t('xp.howItWorks')}
        </button>

        {open && (
          <div className="mt-3 grid gap-1.5">
            {summary.sources.map((source) => (
              <div
                key={source.id}
                className="bg-secondary/40 flex items-start justify-between gap-3 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold">{t(source.labelKey)}</p>
                  <p className="text-muted-foreground text-[11px]">{source.detail}</p>
                </div>
                <span className="text-volt-ink shrink-0 text-xs font-extrabold tabular-nums">
                  {formatNumber(source.xp, 0)} XP
                </span>
              </div>
            ))}
            {summary.sources.length === 0 && (
              <p className="text-muted-foreground text-xs">{t('xp.empty')}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The level-up banner shown inside the post-workout celebration.
 * Deliberately loud: it is the only place in the app that shouts.
 */
export function LevelUpBanner({
  level,
  title,
  xpGained,
  className,
}: {
  level: number;
  title: string;
  xpGained: number;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'bg-volt/15 ring-volt/40 flex items-center gap-3 rounded-2xl px-4 py-3 ring-1',
        className,
      )}
    >
      <Sparkles className="text-volt-ink h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-volt-ink text-sm font-extrabold">{t('xp.levelUp', { level, title })}</p>
        <p className="text-muted-foreground text-xs">{t('xp.levelUp.body', { title })}</p>
      </div>
      <span className="text-volt-ink ml-auto shrink-0 text-sm font-extrabold tabular-nums">
        {t('xp.gained', { xp: xpGained })}
      </span>
    </div>
  );
}
