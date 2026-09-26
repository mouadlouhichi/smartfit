'use client';

import { useMemo, useState } from 'react';
import {
  Apple,
  ArrowLeftRight,
  Crown,
  Moon,
  Plus,
  Sun,
  Sunrise,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import { useModals } from './modal-context';
import {
  foodLabel,
  hasProAccess,
  mealsOn,
  suggestDayPlan,
  sumMeals,
  swapAlternatives,
  type MealSlot,
  type MealSuggestion,
} from '@smartfit/core';

/**
 * "What to eat next" — the meal planner.
 *
 * Ranked from the food table against what is actually left of the day, with
 * hard filters for declared restrictions and soft ranking for likes/dislikes
 * (see `suggestMealsForSlot` in @smartfit/core). Everything is a suggestion:
 * tapping one opens the meal form pre-filled, and the athlete still reviews
 * the numbers before saving. Nothing is ever written to the log on its own.
 */

const SLOT_ICONS: Record<MealSlot, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
};

export function MealPlanCard({
  date,
  calorieTarget,
  proteinTarget,
  /** Slot selected by the enclosing page (the day picker follows it). */
  activeSlot,
  onActiveSlotChange,
}: {
  date: string;
  calorieTarget: number | null;
  proteinTarget: number | null;
  activeSlot: MealSlot;
  onActiveSlotChange: (slot: MealSlot) => void;
}) {
  const { state } = useStore();
  const { t, locale } = useI18n();
  const { openWith } = useModals();
  const pro = hasProAccess(state);

  // What has already been eaten in each slot today: those foods are excluded
  // from the suggestions so the list never proposes a second identical meal.
  const logged = useMemo(() => mealsOn(state.meals, date), [state.meals, date]);
  const eatenIds = useMemo(() => logged.flatMap((m) => m.items ?? []), [logged]);

  const dayTarget = calorieTarget ?? 2000;
  const totals = useMemo(() => sumMeals(logged), [logged]);
  // How far behind the protein target the day is — the single signal that
  // should change what the planner suggests (protein-dense foods rise).
  const proteinGap = Math.max(0, (proteinTarget ?? 0) - totals.protein);

  const plan = useMemo(
    () =>
      suggestDayPlan(state, dayTarget, {
        exclude: eatenIds,
        proteinGap,
        limit: 3,
      }),
    [state, dayTarget, eatenIds, proteinGap],
  );

  const slotPlan = plan.find((p) => p.slot === activeSlot);
  const suggestions = slotPlan?.suggestions ?? [];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display-tight text-base font-extrabold">{t('fuel.plan.title')}</h2>
            <p className="text-muted-foreground mt-0.5 max-w-prose text-sm">
              {t('fuel.plan.subtitle')}
            </p>
          </div>
          {state.profile.dietary && state.profile.dietary.restrictions.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {state.profile.dietary.restrictions.length} restrictions
            </Badge>
          )}
        </div>

        {calorieTarget == null ? (
          <p className="text-muted-foreground mt-4 text-sm">{t('fuel.plan.empty')}</p>
        ) : (
          <>
            {/* Slot switcher — suggestions are per eating occasion, not a
                generic "eat this" list. */}
            <div
              className="mt-4 flex flex-wrap gap-1.5"
              role="tablist"
              aria-label={t('fuel.plan.slot')}
            >
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]).map((slot) => {
                const Icon = SLOT_ICONS[slot];
                const slotKcal = logged
                  .filter((m) => m.slot === slot)
                  .reduce((a, m) => a + m.calories, 0);
                return (
                  <button
                    key={slot}
                    role="tab"
                    aria-selected={activeSlot === slot}
                    onClick={() => onActiveSlotChange(slot)}
                    className={cn(
                      'focus-visible:ring-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      activeSlot === slot
                        ? 'bg-volt text-ink shadow-sm'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {t(`fuel.slot.${slot}`)}
                    {slotKcal > 0 && <span className="tabular-nums">· {slotKcal}</span>}
                  </button>
                );
              })}
            </div>

            <ul className="mt-4 grid gap-2">
              {suggestions.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.food.id}
                  suggestion={suggestion}
                  slot={activeSlot}
                  date={date}
                  pro={pro}
                  onLog={() =>
                    openWith({
                      kind: 'meal',
                      date,
                      slot: activeSlot,
                      prefill: {
                        name: foodLabel(suggestion.food, locale),
                        calories: suggestion.calories,
                        protein: suggestion.protein,
                        carbs: suggestion.carbs,
                        fat: suggestion.fat,
                        items: [suggestion.food.id],
                      },
                    })
                  }
                />
              ))}
              {suggestions.length === 0 && (
                <li className="text-muted-foreground text-sm">
                  Nothing left in the table fits this slot with your restrictions. Loosen one in
                  Personalize, or add the meal manually.
                </li>
              )}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionRow({
  suggestion,
  slot,
  date,
  pro,
  onLog,
}: {
  suggestion: MealSuggestion;
  slot: MealSlot;
  date: string;
  pro: boolean;
  onLog: () => void;
}) {
  const { t, locale } = useI18n();
  const { openWith } = useModals();
  return (
    <li className="bg-secondary/40 flex items-center gap-3 rounded-xl px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {foodLabel(suggestion.food, locale)}
          <span className="text-muted-foreground font-semibold"> · {suggestion.label}</span>
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {t('fuel.plan.fits', {
            calories: suggestion.calories,
            protein: suggestion.protein,
          })}{' '}
          — {suggestion.reason}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={onLog}
        aria-label={`${t('fuel.plan.logThis')} ${foodLabel(suggestion.food, locale)}`}
      >
        <Plus className="h-3.5 w-3.5" /> {t('fuel.plan.logThis')}
      </Button>
      {!pro && (
        <span className="sr-only" aria-hidden>
          {slot}
          {date}
        </span>
      )}
    </li>
  );
}

/**
 * Swap a logged meal for a macro-matched alternative.
 *
 * Writes the swapped food back through the ordinary `updateMeal` path, so the
 * edit is a normal, undoable meal edit — not a special case with its own
 * storage. The portion is chosen to keep the calories where they were, which
 * is the only kind of swap that does not quietly move the day's target.
 */
export function SwapMealButton({
  mealId,
  items,
  kcal,
  protein,
  carbs,
  fat,
  onSwap,
}: {
  mealId: string;
  items: string[];
  kcal: number;
  protein: number;
  carbs?: number;
  fat?: number;
  onSwap: (patch: {
    name: string;
    calories: number;
    protein: number;
    carbs?: number;
    fat?: number;
    items: string[];
  }) => void;
}) {
  const { state } = useStore();
  const { t, locale } = useI18n();
  const { openWith } = useModals();
  const pro = hasProAccess(state);
  const [open, setOpen] = useState(false);

  const primary = items[0];
  const alternatives = useMemo(
    () => (primary ? swapAlternatives(primary, state, { exclude: items.slice(1), limit: 5 }) : []),
    [primary, state, items],
  );

  if (!primary || alternatives.length === 0) return null;

  return (
    <div className="relative">
      <Button
        size="icon"
        variant="ghost"
        aria-label={t('action.swap')}
        aria-expanded={open}
        onClick={() => {
          if (!pro) {
            openWith({ kind: 'pro' });
            return;
          }
          setOpen((v) => !v);
        }}
      >
        {pro ? <ArrowLeftRight className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
      </Button>
      {open && (
        <div
          className="bg-popover absolute right-0 z-20 mt-1 w-64 rounded-xl p-2 shadow-lg ring-1 ring-black/10"
          role="menu"
        >
          <p className="text-muted-foreground px-2 py-1 text-[11px] font-bold uppercase">
            {t('fuel.swap.title')}
          </p>
          {alternatives.map((alt) => (
            <button
              key={alt.food.id}
              role="menuitem"
              className="hover:bg-secondary focus-visible:ring-ring flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => {
                // Keep the energy where it was: the swap exists so the day's
                // numbers barely move, which is what makes it usable.
                onSwap({
                  name: foodLabel(alt.food, locale),
                  calories: kcal,
                  protein: alt.protein,
                  carbs: carbs == null ? undefined : alt.carbs,
                  fat: fat == null ? undefined : alt.fat,
                  items: [alt.food.id],
                });
                setOpen(false);
              }}
            >
              <span className="truncate font-semibold">{foodLabel(alt.food, locale)}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {alt.label} · {alt.protein}g
              </span>
            </button>
          ))}
          <p className="text-muted-foreground px-2 pt-1.5 text-[11px]">{t('fuel.swap.subtitle')}</p>
          <span className="sr-only">{mealId}</span>
        </div>
      )}
    </div>
  );
}
