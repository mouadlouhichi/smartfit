'use client';

import { useMemo } from 'react';
import { CheckCircle2, Pencil, Plus, Target } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

export function GoalsScreen() {
  const { state } = useStore();
  const { openModal, openWith } = useModals();

  const goals = useMemo(() => state.goals.map((g) => ({ g, p: goalProgress(state, g) })), [state]);
  const done = goals.filter((x) => x.p.done).length;

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

      {goals.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-accent text-accent-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
              <Target className="h-7 w-7" />
            </span>
            <p className="font-semibold">No goals yet</p>
            <p className="text-muted-foreground max-w-xs text-sm">
              Set a target for workouts, active minutes, calories or distance and watch the progress
              bar fill up.
            </p>
            <Button onClick={() => openModal('goal')}>Create your first goal</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {goals.map(({ g, p }) => {
          const meta = GOAL_METRIC_META[g.metric];
          return (
            <Card key={g.id} className={p.done ? 'border-primary/50 bg-primary/5' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-xl">
                      <CategoryIcon name={meta.icon} size={20} />
                    </span>
                    <div>
                      <p className="font-semibold">{g.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {meta.label} · resets {g.cadence}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => openWith({ kind: 'goal', goal: g })}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`Edit ${g.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      {formatNumber(goalDisplay(p.current, g.metric, state.profile))}{' '}
                      <span className="text-muted-foreground font-normal">
                        / {formatNumber(goalDisplay(p.target, g.metric, state.profile))}{' '}
                        {goalUnit(g.metric, state.profile)}
                      </span>
                    </span>
                    {p.done ? (
                      <Badge className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Done
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">{Math.round(p.pct)}%</span>
                    )}
                  </div>
                  <Progress
                    value={p.pct}
                    className="mt-2 h-3"
                    indicatorClassName={p.done ? 'bg-primary' : undefined}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
