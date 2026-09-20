'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Flame, Plus, Scale, UtensilsCrossed } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from './modal-context';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { burnedOn, mealsOn, nutritionTargets, sumMeals, toISODate } from '@smartfit/core';

/**
 * The dashboard's at-a-glance fuel tile: calories in vs out and protein for
 * today, one tap from logging a meal. Mirrors the Readiness card pattern —
 * compact in the rail, honest about what's missing (a weigh-in).
 */
export function FuelGlance() {
  const { state } = useStore();
  const { openWith } = useModals();
  const today = toISODate(new Date());

  const targets = useMemo(() => nutritionTargets(state), [state]);
  const totals = useMemo(() => sumMeals(mealsOn(state.meals, today)), [state.meals, today]);
  const burned = useMemo(() => burnedOn(state, today), [state, today]);

  const remaining = targets ? targets.calories - totals.calories : null;
  const over = remaining != null && remaining < 0;
  const pct = targets ? Math.min(100, (totals.calories / targets.calories) * 100) : 0;

  return (
    <section
      aria-label="Today's fuel"
      className="bg-card border-border rounded-3xl border p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-volt-soft/25 text-volt-ink grid h-9 w-9 shrink-0 place-items-center rounded-xl">
            <UtensilsCrossed className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm leading-tight font-extrabold tracking-tight">Today’s fuel</p>
            <p className="text-muted-foreground text-xs">In vs out, and your protein</p>
          </div>
        </div>
        <Link
          href="/dashboard/fuel"
          className="text-primary flex items-center gap-0.5 text-sm font-bold transition-colors hover:underline"
        >
          Fuel <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {targets ? (
        <div className="mt-4 grid gap-3">
          <div className="flex items-end justify-between gap-3">
            <p className="font-display text-2xl font-extrabold tabular-nums">
              {totals.calories}
              <span className="text-muted-foreground text-sm font-bold">
                {' '}
                / {targets.calories} kcal
              </span>
            </p>
            <p
              className={cn(
                'text-xs font-bold tabular-nums',
                over ? 'text-destructive' : 'text-volt-ink',
              )}
            >
              {over ? `${-remaining!} over` : `${remaining} left`}
            </p>
          </div>
          <Progress
            className="h-2"
            value={pct}
            aria-label="Calories eaten versus target today"
            indicatorClassName={over ? 'bg-destructive' : 'bg-volt'}
          />
          <div className="text-muted-foreground flex items-center gap-4 text-xs font-semibold tabular-nums">
            <span>
              <Flame className="text-volt-ink mr-1 inline h-3.5 w-3.5" aria-hidden />
              {burned} kcal burned
            </span>
            <span>
              Protein {Math.round(totals.protein)}/{targets.protein} g
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openWith({ kind: 'meal', date: today })}
          >
            <Plus className="h-4 w-4" /> Log meal
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <p className="text-muted-foreground text-sm">
            Log your weight once and SmartFit computes your daily calorie & protein targets from
            your goal and activity.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openWith({ kind: 'body' })}>
              <Scale className="h-4 w-4" /> Log weight
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openWith({ kind: 'meal', date: today })}
            >
              <Plus className="h-4 w-4" /> Log meal anyway
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
