'use client';

import { useMemo } from 'react';
import { CheckCircle2, Pencil, Plus, Target } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ring } from '../ring';
import { CategoryIcon } from '@/components/category-icon';
import { GOAL_METRIC_META } from '@smartfit/core';
import { formatNumber, fromKm, goalProgress } from '@smartfit/core';
import type { GoalMetric, UserProfile } from '@smartfit/core';

/**
 * Goal targets are stored canonically (distance in km). Everything is
 * converted here, at the render boundary, so switching units never rewrites
 * the underlying numbers.
 */
function goalUnit(metric: GoalMetric, profile: UserProfile): string {
  if (metric === 'distance') return profile.distanceUnit;
  return GOAL_METRIC_META[metric].unit;
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

  const goals = useMemo(() => state.goals.map((g) => ({ g, p: goalProgress(state, g) })), [state]);
  const done = goals.filter((x) => x.p.done).length;
  const donePct = goals.length > 0 ? Math.round((done / goals.length) * 100) : 0;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Goals</h1>
          <p className="text-muted-foreground text-sm">
            {done}/{goals.length} hit this period · goals reset weekly or monthly.
          </p>
        </div>
        <Button onClick={() => openModal('goal')}>
          <Plus className="h-4 w-4" /> New goal
        </Button>
      </div>

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
                  ? 'Every goal hit this period — outstanding.'
                  : `${done} of ${goals.length} goals hit this period`}
              </p>
              <p className="text-muted-foreground text-xs">
                {done === goals.length
                  ? 'Raise the bar or add a new goal to keep the streak alive.'
                  : 'Keep going — the rings below show exactly how close you are.'}
              </p>
            </div>
            <span className="bg-secondary text-secondary-foreground hidden rounded-full px-3 py-1 text-xs font-bold tabular-nums sm:inline">
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
            <p className="font-semibold">No goals yet</p>
            <p className="text-muted-foreground max-w-xs text-sm">
              Set a target for workouts, active minutes, calories or distance and watch the ring
              fill up.
            </p>
            <Button onClick={() => openModal('goal')}>Create your first goal</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map(({ g, p }) => {
          const meta = GOAL_METRIC_META[g.metric];
          const style = METRIC_STYLE[g.metric] ?? METRIC_STYLE.workouts;
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
                        <p className="truncate font-semibold">{g.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {meta.label} · resets {g.cadence}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openWith({ kind: 'goal', goal: g })}
                      className="text-muted-foreground hover:text-primary -m-2 shrink-0 p-2 transition-colors"
                      aria-label={`Edit ${g.name}`}
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
                        {goalUnit(g.metric, state.profile)}
                      </span>
                    </p>
                    {p.done && (
                      <Badge className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
