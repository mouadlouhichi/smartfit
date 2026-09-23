'use client';

import { useMemo, useState } from 'react';
import { Check, Languages, Utensils } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store-context';
import { useI18n } from '@/lib/i18n-context';
import {
  FOOD_DB,
  LOCALES,
  RESTRICTIONS,
  fitsDiet,
  foodLabel,
  suggestMealsForSlot,
  type Locale,
} from '@smartfit/core';

/**
 * Diet and language — the two preferences that change what the app *says*.
 *
 * Diet: restrictions are hard filters on every meal suggestion and swap;
 * favourites and dislikes only reorder the ranking (`suggestMealsForSlot`).
 * The consequence is shown live, by counting how many foods in the table
 * survive the current restriction set — a number going from 41 to 12 is a much
 * clearer warning than a colour change on a chip.
 *
 * Language: stored on the profile, so it syncs and travels to the mobile app.
 * Food *aliases* are not translations — the scanner needs the local word, and
 * that table lives next to the food table (see `FOOD_ALIASES`).
 */
export function DietPreferences() {
  const { state, updateProfile } = useStore();
  const { t, locale, setLocale } = useI18n();
  const [query, setQuery] = useState('');

  // Memoised identities: these arrays are rebuilt on every store write, so a
  // bare `?? []` would make every downstream `useMemo` recompute each render.
  const restrictions = useMemo(
    () => state.profile.dietary?.restrictions ?? [],
    [state.profile.dietary?.restrictions],
  );
  const favorites = useMemo(
    () => state.profile.dietary?.favorites ?? [],
    [state.profile.dietary?.favorites],
  );
  const dislikes = useMemo(
    () => state.profile.dietary?.dislikes ?? [],
    [state.profile.dietary?.dislikes],
  );

  const patch = (
    next: Partial<{ restrictions: string[]; favorites: string[]; dislikes: string[] }>,
  ) =>
    updateProfile({
      dietary: {
        restrictions,
        favorites,
        dislikes,
        ...next,
      },
    });

  const toggle = (list: string[], id: string, on: boolean) =>
    on ? [...new Set([...list, id])] : list.filter((x) => x !== id);

  /** How much of the food table survives the restrictions — shown, not implied. */
  const allowed = useMemo(
    () => FOOD_DB.filter((f) => fitsDiet(f.id, restrictions)).length,
    [restrictions],
  );

  /** Proof the filters work: the first suggestion for tonight under this diet. */
  const sample = useMemo(() => suggestMealsForSlot(state, 'dinner', { limit: 1 })[0], [state]);

  const search = query.trim().toLowerCase();
  const foods = useMemo(
    () =>
      FOOD_DB.filter((f) =>
        search
          ? f.names.some((n) => n.includes(search)) ||
            foodLabel(f, locale).toLowerCase().includes(search)
          : true,
      ).slice(0, 24),
    [search, locale],
  );

  return (
    <section className="bg-card space-y-5 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-volt-soft/25 text-volt-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        >
          <Utensils className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{t('diet.title')}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">{t('diet.subtitle')}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">{t('diet.restrictions')}</p>
        <p className="text-muted-foreground mb-2 text-xs">{t('diet.restrictionsHint')}</p>
        <div className="flex flex-wrap gap-2">
          {RESTRICTIONS.map((rule) => {
            const on = restrictions.includes(rule.id);
            return (
              <button
                key={rule.id}
                type="button"
                aria-pressed={on}
                onClick={() => patch({ restrictions: toggle(restrictions, rule.id, !on) })}
                className={cn(
                  'focus-visible:ring-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  on
                    ? 'bg-volt text-ink shadow-sm'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {on && <Check className="h-3 w-3" aria-hidden />}
                {t(rule.labelKey)}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          {t('diet.available', { allowed, total: FOOD_DB.length })}{' '}
          {sample
            ? t('diet.sample', { name: foodLabel(sample.food, locale), label: sample.label })
            : t('diet.nothingFits')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FoodPicker
          label={t('diet.favorites')}
          hint={t('diet.favoriteHint')}
          foods={foods}
          selected={favorites}
          query={query}
          onQuery={setQuery}
          queryLabel={t('diet.search')}
          onToggle={(id, on) => patch({ favorites: toggle(favorites, id, on) })}
        />
        <FoodPicker
          label={t('diet.dislikes')}
          hint={t('diet.dislikeHint')}
          foods={foods}
          selected={dislikes}
          query={query}
          onQuery={setQuery}
          queryLabel={t('diet.search')}
          onToggle={(id, on) => patch({ dislikes: toggle(dislikes, id, on) })}
        />
      </div>

      {/* ── language ─────────────────────────────────────────────────────── */}
      <div className="border-t pt-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          >
            <Languages className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">{t('language.title')}</p>
            <p className="text-muted-foreground text-xs">{t('language.subtitle')}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {LOCALES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={locale === option.id}
              onClick={() => setLocale(option.id as Locale)}
              className={cn(
                'focus-visible:ring-ring rounded-full px-3.5 py-2 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none',
                locale === option.id
                  ? 'bg-volt text-ink shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {option.native}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FoodPicker({
  label,
  hint,
  foods,
  selected,
  query,
  onQuery,
  queryLabel,
  onToggle,
}: {
  label: string;
  hint: string;
  foods: typeof FOOD_DB;
  selected: string[];
  query: string;
  onQuery: (value: string) => void;
  queryLabel: string;
  onToggle: (id: string, on: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold">{label}</p>
        <Badge variant="secondary">
          {selected.length > 0 ? t('diet.selected', { count: selected.length }) : t('diet.none')}
        </Badge>
      </div>
      <Input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={queryLabel}
        aria-label={queryLabel}
      />
      <p className="text-muted-foreground text-xs">{hint}</p>
      <div className="max-h-52 overflow-y-auto rounded-xl border">
        <ul className="divide-y">
          {foods.map((food) => {
            const on = selected.includes(food.id);
            return (
              <li key={food.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(food.id, !on)}
                  className={cn(
                    'focus-visible:ring-ring flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none',
                    on ? 'bg-volt/10 font-bold' : 'hover:bg-secondary/60',
                  )}
                >
                  <span className="truncate">{food.names[0]}</span>
                  {on && <Check className="text-volt-ink h-3.5 w-3.5 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
          {foods.length === 0 && (
            <li className="text-muted-foreground px-3 py-2 text-sm">No food matches that.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
