'use client';

import { useMemo, useState } from 'react';
import {
  Apple,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Moon,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Sun,
  Sunrise,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';
import { useModals } from '../modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { ScreenHeader } from '../screen-header';
import {
  ACTIVITY_LEVELS,
  MEAL_SLOTS,
  NUTRITION_GOALS,
  burnedOn,
  formatDateLabel,
  hasProAccess,
  mealsOn,
  nutritionTargets,
  sumMeals,
  toISODate,
} from '@smartfit/core';
import type { ActivityLevel, MealSlot, NutritionGoal } from '@smartfit/core';

/** Shift an ISO yyyy-mm-dd date by whole days (local-safe via UTC noon). */
function shiftISODate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const SLOT_ICONS: Record<MealSlot, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
};

/**
 * Fuel — the nutrition half of calories-in vs calories-out.
 *
 * Free: targets, meal log, slot breakdown and the transparent math behind
 * every number. Pro: the meal scan (in the modal) and the 7-day adherence
 * trend. Targets need one weigh-in; until then the screen explains why and
 * links straight to the body log.
 */
export function FuelScreen() {
  const { state, updateProfile } = useStore();
  const { openWith } = useModals();
  const pro = hasProAccess(state);
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);

  const targets = useMemo(() => nutritionTargets(state), [state]);
  const dayMeals = useMemo(
    () =>
      mealsOn(state.meals, date).sort(
        (a, b) =>
          MEAL_SLOTS.findIndex((s) => s.id === a.slot) -
            MEAL_SLOTS.findIndex((s) => s.id === b.slot) || a.createdAt - b.createdAt,
      ),
    [state.meals, date],
  );
  const totals = useMemo(() => sumMeals(dayMeals), [dayMeals]);
  const burned = useMemo(() => burnedOn(state, date), [state, date]);
  const isToday = date === today;

  // Last 7 days of intake for the Pro adherence strip.
  const week = useMemo(() => {
    const days: { date: string; kcal: number; protein: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = shiftISODate(today, -i);
      const t = sumMeals(mealsOn(state.meals, d));
      days.push({ date: d, kcal: t.calories, protein: t.protein });
    }
    return days;
  }, [state.meals, today]);
  const weekMax = Math.max(targets?.calories ?? 2000, ...week.map((d) => d.kcal), 1);
  const loggedDays = week.filter((d) => d.kcal > 0);
  const adherence =
    targets && loggedDays.length > 0
      ? Math.round(
          (loggedDays.filter((d) => Math.abs(d.kcal - targets.calories) <= targets.calories * 0.1)
            .length /
            loggedDays.length) *
            100,
        )
      : null;

  const remaining = targets ? targets.calories - totals.calories : null;
  const over = remaining != null && remaining < 0;

  const profile = state.profile;

  return (
    <div className="grid gap-5">
      <ScreenHeader
        eyebrow="Fuel"
        title="Nutrition"
        subtitle="Calories and protein per meal, measured against a target that follows your body and your goal."
        action={
          <Button onClick={() => openWith({ kind: 'meal', date })}>
            <Plus className="h-4 w-4" /> Log meal
          </Button>
        }
      />

      {/* Day picker */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => setDate((d) => shiftISODate(d, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <DatePicker
          value={date}
          onValueChange={setDate}
          weekStartsOn={profile.weekStartsOn ?? 1}
          aria-label="Choose day"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => setDate((d) => shiftISODate(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isToday && (
          <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
            Back to today
          </Button>
        )}
        <p className="text-muted-foreground ml-auto text-sm font-semibold">
          {isToday ? 'Today' : formatDateLabel(date)}
        </p>
      </div>

      {/* Targets summary — needs one weigh-in to exist. */}
      {targets ? (
        <Card>
          <CardContent className="grid gap-5 pt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                  {over ? 'Over target' : 'Remaining'}
                </p>
                <p
                  className={cn(
                    'font-display text-4xl font-extrabold tabular-nums',
                    over && 'text-destructive',
                  )}
                >
                  {Math.abs(remaining ?? 0)}
                  <span className="text-muted-foreground ml-1 text-base font-bold">kcal</span>
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-muted-foreground text-[11px] font-bold uppercase">Eaten</p>
                  <p className="font-display text-xl font-extrabold tabular-nums">
                    {totals.calories}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px] font-bold uppercase">Burned</p>
                  <p className="font-display text-volt-ink text-xl font-extrabold tabular-nums">
                    {burned}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px] font-bold uppercase">Target</p>
                  <p className="font-display text-xl font-extrabold tabular-nums">
                    {targets.calories}
                  </p>
                </div>
              </div>
            </div>

            <Progress
              value={Math.min(100, (totals.calories / targets.calories) * 100)}
              aria-label="Calories eaten versus target"
              indicatorClassName={over ? 'bg-destructive' : 'bg-volt'}
            />

            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { label: 'Protein', got: totals.protein, want: targets.protein, unit: 'g' },
                  { label: 'Carbs', got: totals.carbs, want: targets.carbs, unit: 'g' },
                  { label: 'Fat', got: totals.fat, want: targets.fat, unit: 'g' },
                ] as const
              ).map((m) => (
                <div key={m.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-1">
                    <span className="text-muted-foreground text-xs font-bold">{m.label}</span>
                    <span className="text-xs font-bold tabular-nums">
                      {Math.round(m.got)}
                      <span className="text-muted-foreground">
                        /{m.want}
                        {m.unit}
                      </span>
                    </span>
                  </div>
                  <Progress
                    className="h-1.5"
                    value={m.want > 0 ? Math.min(100, (m.got / m.want) * 100) : 0}
                    aria-label={`${m.label} versus target`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="bg-accent text-accent-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
              <Scale className="h-7 w-7" />
            </span>
            <p className="font-semibold">One weigh-in unlocks your targets</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Your daily calorie and protein targets are computed from your weight, activity and
              goal — log your weight once and the math is yours. You can still log meals below.
            </p>
            <Button onClick={() => openWith({ kind: 'body' })}>
              <Plus className="h-4 w-4" /> Log your weight
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Meals by slot */}
      <div className="grid gap-3">
        {MEAL_SLOTS.map((s) => {
          const rows = dayMeals.filter((m) => m.slot === s.id);
          const slotKcal = rows.reduce((a, m) => a + m.calories, 0);
          const SlotIcon = SLOT_ICONS[s.id];
          return (
            <Card key={s.id}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2.5 text-sm">
                    <SlotIcon className="text-volt-ink h-4 w-4" aria-hidden />
                    {s.label}
                    {slotKcal > 0 && (
                      <span className="text-muted-foreground font-semibold tabular-nums">
                        · {slotKcal} kcal
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Add ${s.label.toLowerCase()}`}
                    onClick={() => openWith({ kind: 'meal', date, slot: s.id })}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {rows.length > 0 && (
                <CardContent className="pt-0">
                  <ul className="divide-border divide-y">
                    {rows.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openWith({ kind: 'meal', meal: m })}
                          aria-label={`Edit ${m.name}`}
                        >
                          <p className="truncate text-sm font-semibold">
                            {m.name}{' '}
                            {m.scanned && (
                              <Badge variant="accent" className="ml-1 align-middle">
                                <Sparkles className="h-3 w-3" /> Scan
                              </Badge>
                            )}
                          </p>
                          <p className="text-muted-foreground text-xs tabular-nums">
                            <Flame className="mr-1 inline h-3 w-3" aria-hidden />
                            {m.calories} kcal · {m.protein} g protein
                            {m.carbs != null ? ` · ${m.carbs} g carbs` : ''}
                            {m.fat != null ? ` · ${m.fat} g fat` : ''}
                          </p>
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${m.name}`}
                          onClick={() => openWith({ kind: 'meal', meal: m })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* 7-day adherence — Pro */}
      {targets && (
        <Card>
          <CardHeader className="gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between min-[480px]:space-y-0">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Zap className="h-[18px] w-[18px]" />
              </span>
              7-day adherence
            </CardTitle>
            {pro ? (
              adherence != null && (
                <Badge variant={adherence >= 60 ? 'accent' : 'secondary'}>
                  {adherence}% of days within ±10% of target
                </Badge>
              )
            ) : (
              <Badge variant="secondary">
                <Crown className="h-3 w-3" /> Pro
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {pro ? (
              <>
                <div
                  className="flex h-24 items-end gap-1.5"
                  role="img"
                  aria-label={`Calories eaten per day, last 7 days, against a ${targets.calories} kcal target.`}
                >
                  {week.map((d) => (
                    <div
                      key={d.date}
                      className="relative flex min-w-0 flex-1 flex-col justify-end self-stretch"
                    >
                      {/* target line */}
                      <span
                        aria-hidden
                        className="border-volt-ink/40 absolute inset-x-0 border-t border-dashed"
                        style={{ bottom: `${(targets.calories / weekMax) * 100}%` }}
                      />
                      <div
                        title={`${formatDateLabel(d.date)}: ${d.kcal} kcal, ${d.protein} g protein`}
                        className={cn(
                          'w-full rounded-t-sm',
                          d.kcal === 0
                            ? 'bg-secondary'
                            : d.kcal > targets.calories
                              ? 'bg-destructive/70'
                              : 'bg-volt',
                        )}
                        style={{ height: `${Math.max(4, (d.kcal / weekMax) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="text-muted-foreground mt-2 flex justify-between text-[11px] tabular-nums">
                  <span>{formatDateLabel(week[0].date)}</span>
                  <span>Dashed line = {targets.calories} kcal target · red bars went over</span>
                </div>
              </>
            ) : (
              <div className="relative overflow-hidden rounded-2xl">
                <div className="flex h-24 items-end gap-1.5 blur-[6px] select-none" aria-hidden>
                  {[55, 70, 40, 85, 60, 75, 50].map((h, i) => (
                    <div
                      key={i}
                      className="bg-volt min-w-0 flex-1 rounded-t-sm"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Button size="sm" onClick={() => openWith({ kind: 'pro' })}>
                    <Crown className="h-3.5 w-3.5" /> Unlock adherence trends
                  </Button>
                  <p className="text-muted-foreground text-xs">
                    See whether your week matches your goal
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Targets editor + transparent math */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <UtensilsCrossed className="h-[18px] w-[18px]" />
            </span>
            Your targets
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="fuel-goal" className="mb-1.5 block text-sm font-semibold">
                Nutrition goal
              </label>
              <Select
                id="fuel-goal"
                value={targets?.goal ?? profile.nutritionGoal ?? 'maintain'}
                onChange={(e) => updateProfile({ nutritionGoal: e.target.value as NutritionGoal })}
              >
                {NUTRITION_GOALS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="fuel-activity" className="mb-1.5 block text-sm font-semibold">
                Activity level
              </label>
              <Select
                id="fuel-activity"
                value={targets?.activity ?? profile.activityLevel ?? 'light'}
                onChange={(e) => updateProfile({ activityLevel: e.target.value as ActivityLevel })}
              >
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} (×{a.factor})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {targets && (
            <details className="bg-secondary/50 rounded-xl p-3 text-sm">
              <summary className="cursor-pointer font-semibold select-none">
                How we calculate your numbers
              </summary>
              <ul className="text-muted-foreground mt-2 grid gap-1.5">
                {targets.basis.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
