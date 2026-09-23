'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Check, ChevronRight, Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n-context';
import {
  checkInActions,
  checkInStreak,
  formatNumber,
  recordCheckIn,
  type WeeklyReview,
} from '@smartfit/core';
import { useStore } from '@/lib/store-context';
import { XpCard } from './xp-card';
import type { XpSummary } from '@smartfit/core';

/**
 * The weekly check-in.
 *
 * Two states, one component:
 *
 *  - **Waiting** — the last *complete* week has not been reviewed. The card
 *    shows what actually happened (computed, never self-reported) and asks one
 *    question: how did it feel.
 *  - **Answered** — the week is closed, and the card shows the plan for next
 *    week instead of nagging.
 *
 * The numbers arrive pre-filled from `weeklyReview`, which is the point: a
 * check-in that opens with a blank form asking you to remember your own week
 * is a chore. Here the athlete is confirming, not data-entering.
 */

const FACES = [1, 2, 3, 4, 5] as const;

export function CheckInCard({
  review,
  xp,
  onAnswered,
}: {
  review: WeeklyReview;
  xp: XpSummary;
  /** Called with the new total so the XP card can animate to it. */
  onAnswered?: (gainedXp: number) => void;
}) {
  const { state, addCheckIn } = useStore();
  const { t } = useI18n();
  const toast = useToast();

  const [feeling, setFeeling] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);

  const actions = useMemo(() => checkInActions(state, review), [state, review]);
  const streakWeeks = useMemo(() => checkInStreak(state), [state]);

  function submit() {
    const record = recordCheckIn(state, { feeling, notes });
    addCheckIn(record);
    setDone(true);
    // XP for a check-in is 30 (XP_AWARDS.checkIn); report it rather than
    // recomputing the whole statement here.
    toast(t('checkin.done', { xp: 30 }), 'success');
    onAnswered?.(30);
  }

  const delta = review.weightDeltaKg;
  const weightCopy =
    delta == null || Math.abs(delta) < 0.1
      ? t('checkin.weightFlat')
      : t('checkin.weight', { delta: `${delta > 0 ? '+' : ''}${formatNumber(delta, 1)}` });

  return (
    <Card className={cn(!done && 'ring-volt/30 ring-1')}>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-volt-ink flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
              {done ? t('checkin.title') : t('checkin.due')}
            </p>
            <h3 className="font-display-tight text-lg font-extrabold tracking-tight">
              {t('checkin.weekOf', { week: review.label })}
            </h3>
          </div>
          {streakWeeks > 0 && (
            <span className="bg-secondary/60 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold">
              <Flame className="text-volt-ink h-3.5 w-3.5" aria-hidden />
              {t('checkin.streak', { count: streakWeeks })}
            </span>
          )}
        </div>

        {/* What actually happened — read from the log, not asked for. */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label={t('checkin.stat.sessions')}>
            <span className="font-display text-xl font-extrabold tabular-nums">
              {review.workouts}
            </span>
            {review.planned > 0 && (
              <span className="text-muted-foreground text-xs font-bold">/{review.planned}</span>
            )}
          </Stat>
          <Stat label={t('checkin.stat.minutes')}>
            <span className="font-display text-xl font-extrabold tabular-nums">
              {review.minutes}
            </span>
            <span className="text-muted-foreground text-xs font-bold">min</span>
          </Stat>
          <Stat label={weightCopy} title={t('checkin.stat.weight')}>
            <span className="font-display flex items-center gap-1 text-xl font-extrabold tabular-nums">
              {delta == null || Math.abs(delta) < 0.1 ? (
                '—'
              ) : (
                <>
                  {delta < 0 ? (
                    <TrendingDown className="text-volt-ink h-4 w-4" aria-hidden />
                  ) : (
                    <TrendingUp className="h-4 w-4" aria-hidden />
                  )}
                  {formatNumber(Math.abs(delta), 1)}
                </>
              )}
            </span>
            <span className="text-muted-foreground text-xs font-bold">kg</span>
          </Stat>
        </div>

        <p className="text-muted-foreground mt-4 text-sm">{review.headline}</p>

        {(review.goalsHit.length > 0 || review.goalsMissed.length > 0) && (
          <div className="mt-3 grid gap-1">
            {review.goalsHit.length > 0 && (
              <p className="text-volt-ink text-xs font-bold">
                {t('checkin.goalsHit', { list: review.goalsHit.join(', ') })}
              </p>
            )}
            {review.goalsMissed.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {t('checkin.goalsMissed', { list: review.goalsMissed.join(', ') })}
              </p>
            )}
          </div>
        )}

        {done ? (
          <div className="mt-5 grid gap-3">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <Check className="text-volt-ink h-4 w-4" aria-hidden />
              {t('checkin.submit')}
            </p>
            <div className="bg-secondary/40 rounded-2xl p-3">
              <p className="text-muted-foreground text-[11px] font-bold uppercase">
                {t('checkin.nextWeek')}
              </p>
              <ul className="mt-1.5 grid gap-1.5">
                {actions.map((action) => (
                  <li key={action} className="flex items-start gap-2 text-sm">
                    <ChevronRight
                      className="text-volt-ink mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden
                    />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            <div>
              <p className="mb-2 text-sm font-bold">{t('checkin.feeling')}</p>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={t('checkin.feeling')}
              >
                {FACES.map((face) => (
                  <button
                    key={face}
                    type="button"
                    role="radio"
                    aria-checked={feeling === face}
                    onClick={() => setFeeling(face)}
                    className={cn(
                      'focus-visible:ring-ring rounded-full px-3.5 py-2 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      feeling === face
                        ? 'bg-volt text-ink shadow-sm'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t(`checkin.feeling.${face}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="checkin-notes" className="mb-1.5 block text-sm font-bold">
                {t('checkin.notes')}
              </label>
              <textarea
                id="checkin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={400}
                rows={2}
                placeholder={t('checkin.notesPlaceholder')}
                className="border-input bg-field focus-visible:ring-ring w-full resize-none rounded-xl border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>

            <Button type="button" onClick={submit} className="w-full sm:w-auto">
              {t('checkin.submit')}
            </Button>

            <div className="bg-secondary/40 rounded-2xl p-3">
              <p className="text-muted-foreground text-[11px] font-bold uppercase">
                {t('checkin.nextWeek')}
              </p>
              <ul className="mt-1.5 grid gap-1.5">
                {actions.map((action) => (
                  <li key={action} className="flex items-start gap-2 text-sm">
                    <ChevronRight
                      className="text-volt-ink mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden
                    />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* The XP card rides along: a check-in is +30 XP, so this is where the
            athlete watches the level bar move. */}
        <div className="mt-5">
          <XpCard summary={xp} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  title,
  children,
}: {
  label: string;
  /** Screen-reader / tooltip label when `label` is a full sentence. */
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-secondary/40 rounded-xl px-3 py-2">
      <p
        className="text-muted-foreground truncate text-[10px] font-bold uppercase"
        title={title ?? label}
      >
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-0.5">{children}</p>
    </div>
  );
}

/** Past check-ins, newest first — the history behind the streak. */
export function CheckInHistory() {
  const { state } = useStore();
  const { t } = useI18n();
  const entries = [...(state.checkIns ?? [])].sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1));
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-display-tight text-base font-extrabold">{t('checkin.history')}</h3>
        <ul className="mt-3 grid gap-2">
          {entries.slice(0, 8).map((entry) => (
            <li
              key={entry.id}
              className="bg-secondary/40 flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold">{entry.weekOf}</p>
                <p className="text-muted-foreground truncate text-[11px]">
                  {entry.notes || t('checkin.feeling.' + String(entry.feeling))}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs font-bold tabular-nums">
                {t('checkin.session', { count: entry.workouts })} · {entry.minutes} min
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
