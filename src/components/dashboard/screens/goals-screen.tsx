'use client';

import { useMemo } from 'react';
import { CalendarClock, CheckCircle2, Pencil, Plus, Target } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useModals } from '../modal-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ring } from '../ring';
import { ScreenHeader } from '../screen-header';
import { CategoryIcon } from '@/components/category-icon';
import { GOAL_METRIC_META, goalDisplayName, goalMetricLabel, goalMetricUnit } from '@smartfit/core';
import { deadlineLabel, formatNumber, fromKm, goalDeadline, goalProgress } from '@smartfit/core';
import type { GoalMetric, Translator, UserProfile } from '@smartfit/core';

/**
 * Goal targets are stored canonically (distance in km). Everything is
 * converted here, at the render boundary, so switching units never rewrites
 * the underlying numbers.
 */
function goalUnit(metric: GoalMetric, profile: UserProfile, t: Translator): string {
  if (metric === 'distance') return profile.distanceUnit;
  return goalMetricUnit(metric, t);
}

function goalDisplay(value: number, metric: GoalMetric, profile: UserProfile): number {
  return metric === 'distance' ? fromKm(value, profile.distanceUnit) : value;
}

/** Per-metric identity: ring stroke + tinted icon tile (all AA on cards). */
const METRIC_STYLE: Record<GoalMetric, { ring: string; tile: string }> = {
  workouts: { ring: 'var(--primary)', tile: 'bg-primary/10 text-primary' },
  minutes: { ring: 'var(--chart-2)', tile: 'bg-chart-2/10 text-foreground' },
  calories: { ring: 'var(--chart-4)', tile: 'bg-chart-4/10 text-foreground' },
  distance: { ring: 'var(--chart-3)', tile: 'bg-clay/10 text-foreground' },
};

export function GoalsScreen() {
  const { state } = useStore();
  const { openModal, openWith } = useModals();
  const { t } = useI18n();

  const goals = useMemo(() => state.goals.map((g) => ({ g, p: goalProgress(state, g) })), [state]);
  const done = goals.filter((x) => x.p.done).length;
  const donePct = goals.length > 0 ? Math.round((done / goals.length) * 100) : 0;

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow={t('goals.eyebrow')}
        title={t('goals.title')}
        subtitle={t('goals.subtitle', { done, total: goals.length })}
        action={
          <Button onClick={() => openModal('goal')}>
            <Plus className="h-4 w-4" /> {t('goals.new')}
          </Button>
        }
      />

      {/* Period summary strip */}
      {goals.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Ring pct={donePct} size={56} stroke={6}>
              <span className="text-xs font-extrabold tabular-nums">{donePct}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {done === goals.length
                  ? t('goals.allHit')
                  : t('goals.someHit', { done, total: goals.length })}
              </p>
              <p className="text-muted-foreground text-xs">
                {done === goals.length ? t('goals.allHitHint') : t('goals.someHitHint')}
              </p>
            </div>
            <span className="bg-secondary text-secondary-foreground shrink-0 self-start rounded-full px-3 py-1 text-xs font-bold tabular-nums">
              {done}/{goals.length}
            </span>
          </div>
        </Card>
      )}

      {goals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-accent text-accent-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
              <Target className="h-7 w-7" />
            </span>
            <p className="font-semibold">{t('goals.emptyTitle')}</p>
            <p className="text-muted-foreground max-w-xs text-sm">{t('goals.emptyBody')}</p>
            <Button onClick={() => openModal('goal')}>{t('goals.emptyCta')}</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map(({ g, p }) => {
          const meta = GOAL_METRIC_META[g.metric];
          const style = METRIC_STYLE[g.metric] ?? METRIC_STYLE.workouts;
          // A deadline exists to answer "does my pace arrive in time?" — so the
          // card shows the countdown, and repeats the verdict when the pace is
          // short. A deadline you can only see inside the edit modal is a
          // number nobody ever reads again.
          const deadline = g.deadline ? goalDeadline(state, g) : null;
          const offPace = deadline?.verdict === 'behind' || deadline?.verdict === 'overdue';
          return (
            <Card
              key={g.id}
              className={p.done ? 'border-primary/40 bg-accent/40' : 'hover:shadow-md'}
            >
              {/* Ring on top on phones (side by side it leaves ~40px for the
                  goal name); side by side once the card has room. */}
              <CardContent className="flex flex-col gap-3 p-5 min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-4">
                {/* Radial progress — the number IS the decoration */}
                <div className="mx-auto shrink-0 min-[480px]:mx-0">
                  <Ring pct={p.pct} size={84} stroke={9} color={style.ring}>
                    {p.done ? (
                      <CheckCircle2 className="text-primary h-7 w-7" aria-hidden />
                    ) : (
                      <span className="text-sm font-extrabold tabular-nums">
                        {Math.round(p.pct)}%
                      </span>
                    )}
                  </Ring>
                </div>

                <div className="w-full min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.tile}`}
                      >
                        <CategoryIcon name={meta.icon} size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{goalDisplayName(g.name, t)}</p>
                        <p className="text-muted-foreground text-xs">
                          {t('goal.card.meta', {
                            label: goalMetricLabel(g.metric, t),
                            cadence:
                              g.cadence === 'weekly'
                                ? t('modal.goal.weekly')
                                : t('modal.goal.monthly'),
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openWith({ kind: 'goal', goal: g })}
                      className="text-muted-foreground hover:text-primary -m-2 shrink-0 p-2 transition-colors"
                      aria-label={t('goal.card.editAria', { name: goalDisplayName(g.name, t) })}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold tabular-nums">
                      {formatNumber(goalDisplay(p.current, g.metric, state.profile))}
                      <span className="text-muted-foreground font-medium">
                        {' '}
                        / {formatNumber(goalDisplay(p.target, g.metric, state.profile))}{' '}
                        {goalUnit(g.metric, state.profile, t)}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      {deadline && (
                        <Badge
                          variant={offPace ? 'destructive' : 'secondary'}
                          className="gap-1"
                          title={deadline.message}
                        >
                          <CalendarClock className="h-3 w-3" aria-hidden />
                          {deadlineLabel(g.deadline!)}
                        </Badge>
                      )}
                      {p.done && (
                        <Badge className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {t('goals.done')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {offPace && deadline && (
                    <p className="text-destructive mt-2 text-xs font-medium">{deadline.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
