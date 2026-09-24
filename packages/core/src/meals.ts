/**
 * Meal planning from the food table you already have.
 *
 * TapFit's nutrition side is a planner: it tells you what to eat in each slot,
 * lets you swap a food for an equivalent one, and recomputes the day when you
 * do. SmartFit had targets and a log but no plan. This module closes that with
 * no new data source: everything here is derived from `FOOD_DB` (composition
 * tables) plus `FOOD_META` below (slot affinity and allergen/diet tags).
 *
 * Two rules keep it honest:
 *
 *  1. **Suggestions are always optional.** They are ranked, explained and
 *     swappable — never auto-logged, never presented as a prescription.
 *  2. **Restrictions are hard filters.** A food that violates a declared
 *     restriction cannot be suggested or offered as a swap, regardless of how
 *     well it fits the macros.
 */
import { FOOD_DB, foodById, type FoodEntry } from './nutrition';
import type { DietaryPreferences, FitnessState, MealSlot } from './types';

/** Everything the app needs to know about a food that is not nutrition. */
export interface FoodMeta {
  /** Allergen / diet tags, used to enforce restrictions. */
  tags: FoodTag[];
  /** Meals this food belongs in, best first. */
  slots: MealSlot[];
  /** 1 = light (a snack), 3 = a main. Keeps breakfast from suggesting a tajine. */
  heft: 1 | 2 | 3;
}

export type FoodTag =
  | 'meat'
  | 'pork'
  | 'poultry'
  | 'fish'
  | 'shellfish'
  | 'dairy'
  | 'egg'
  | 'gluten'
  | 'nuts'
  | 'soy'
  | 'alcohol'
  | 'vegetable'
  | 'fruit'
  | 'grain'
  | 'legume'
  | 'drink'
  | 'sweet'
  | 'processed';

/**
 * Tag/slot table keyed by `FOOD_DB` id.
 *
 * It lives here rather than inline on each `FoodEntry` so that the composition
 * table stays a composition table (numbers you can check against a food table)
 * and this stays the product opinion (where a food belongs, what it contains).
 * A test asserts every `FOOD_DB` id has a row, so the two cannot drift.
 */
export const FOOD_META: Record<string, FoodMeta> = {
  chicken: { tags: ['meat', 'poultry'], slots: ['lunch', 'dinner'], heft: 3 },
  beef: { tags: ['meat'], slots: ['lunch', 'dinner'], heft: 3 },
  salmon: { tags: ['fish'], slots: ['lunch', 'dinner'], heft: 3 },
  tuna: { tags: ['fish'], slots: ['lunch', 'snack'], heft: 2 },
  fish: { tags: ['fish'], slots: ['lunch', 'dinner'], heft: 3 },
  egg: { tags: ['egg'], slots: ['breakfast', 'snack'], heft: 1 },
  rice: { tags: ['grain', 'vegetable'], slots: ['lunch', 'dinner'], heft: 2 },
  pasta: { tags: ['grain', 'gluten'], slots: ['lunch', 'dinner'], heft: 2 },
  couscous: { tags: ['grain', 'gluten'], slots: ['lunch', 'dinner'], heft: 2 },
  bread: { tags: ['grain', 'gluten'], slots: ['breakfast', 'snack'], heft: 1 },
  oats: { tags: ['grain'], slots: ['breakfast'], heft: 2 },
  potato: { tags: ['vegetable'], slots: ['lunch', 'dinner'], heft: 2 },
  sweetpotato: { tags: ['vegetable'], slots: ['lunch', 'dinner'], heft: 2 },
  lentils: { tags: ['legume'], slots: ['lunch', 'dinner'], heft: 2 },
  chickpeas: { tags: ['legume'], slots: ['lunch', 'dinner'], heft: 2 },
  beans: { tags: ['legume'], slots: ['lunch', 'dinner'], heft: 2 },
  tofu: { tags: ['soy'], slots: ['lunch', 'dinner'], heft: 3 },
  'greek-yogurt': { tags: ['dairy'], slots: ['breakfast', 'snack'], heft: 1 },
  milk: { tags: ['dairy', 'drink'], slots: ['breakfast', 'snack'], heft: 1 },
  cheese: { tags: ['dairy'], slots: ['snack', 'lunch'], heft: 1 },
  whey: { tags: ['dairy'], slots: ['snack', 'breakfast'], heft: 1 },
  'peanut-butter': { tags: ['nuts'], slots: ['breakfast', 'snack'], heft: 1 },
  almonds: { tags: ['nuts'], slots: ['snack'], heft: 1 },
  banana: { tags: ['fruit'], slots: ['breakfast', 'snack'], heft: 1 },
  apple: { tags: ['fruit'], slots: ['snack'], heft: 1 },
  orange: { tags: ['fruit'], slots: ['snack'], heft: 1 },
  dates: { tags: ['fruit', 'sweet'], slots: ['snack'], heft: 1 },
  avocado: { tags: ['fruit'], slots: ['breakfast', 'lunch'], heft: 2 },
  'olive-oil': { tags: ['vegetable'], slots: ['lunch', 'dinner'], heft: 1 },
  salad: { tags: ['vegetable'], slots: ['lunch', 'dinner'], heft: 2 },
  broccoli: { tags: ['vegetable'], slots: ['lunch', 'dinner'], heft: 2 },
  vegetables: { tags: ['vegetable'], slots: ['lunch', 'dinner'], heft: 2 },
  pizza: { tags: ['grain', 'gluten', 'dairy', 'processed'], slots: ['dinner'], heft: 3 },
  burger: { tags: ['meat', 'grain', 'gluten', 'processed'], slots: ['lunch', 'dinner'], heft: 3 },
  sandwich: { tags: ['grain', 'gluten', 'processed'], slots: ['lunch'], heft: 2 },
  tajine: { tags: ['meat'], slots: ['dinner', 'lunch'], heft: 3 },
  latte: { tags: ['dairy', 'drink'], slots: ['breakfast', 'snack'], heft: 1 },
  juice: { tags: ['fruit', 'drink', 'sweet'], slots: ['breakfast', 'snack'], heft: 1 },
  soda: { tags: ['drink', 'sweet', 'processed'], slots: ['snack'], heft: 1 },
  'protein-bar': { tags: ['processed', 'grain'], slots: ['snack'], heft: 1 },
};

/** Diet names a user can declare, with the tags each one forbids. */
export const RESTRICTION_RULES: Record<
  string,
  { label: string; labelKey: string; forbids: FoodTag[] }
> = {
  vegetarian: {
    label: 'Vegetarian',
    labelKey: 'diet.rule.vegetarian',
    forbids: ['meat', 'poultry', 'fish', 'shellfish'],
  },
  vegan: {
    label: 'Vegan',
    labelKey: 'diet.rule.vegan',
    forbids: ['meat', 'poultry', 'fish', 'shellfish', 'dairy', 'egg'],
  },
  pescatarian: {
    label: 'Pescatarian',
    labelKey: 'diet.rule.pescatarian',
    forbids: ['meat', 'poultry'],
  },
  halal: { label: 'Halal — no pork', labelKey: 'diet.rule.halal', forbids: ['pork', 'alcohol'] },
  'no-pork': { label: 'No pork', labelKey: 'diet.rule.noPork', forbids: ['pork'] },
  'no-dairy': { label: 'No dairy', labelKey: 'diet.rule.noDairy', forbids: ['dairy'] },
  'no-gluten': { label: 'No gluten', labelKey: 'diet.rule.noGluten', forbids: ['gluten'] },
  'no-nuts': { label: 'No nuts', labelKey: 'diet.rule.noNuts', forbids: ['nuts'] },
  'no-shellfish': {
    label: 'No shellfish',
    labelKey: 'diet.rule.noShellfish',
    forbids: ['shellfish'],
  },
  'no-egg': { label: 'No egg', labelKey: 'diet.rule.noEgg', forbids: ['egg'] },
};

/** The choice list for Personalize / the Fuel screen. */
export const RESTRICTIONS: { id: string; label: string; labelKey: string }[] = Object.entries(
  RESTRICTION_RULES,
).map(([id, rule]) => ({ id, label: rule.label, labelKey: rule.labelKey }));

export function foodMeta(id: string): FoodMeta {
  return FOOD_META[id] ?? { tags: [], slots: ['lunch', 'dinner', 'snack', 'breakfast'], heft: 2 };
}

/** Every tag forbidden by a set of restrictions. */
export function forbiddenTags(restrictions: string[] | undefined): Set<FoodTag> {
  const out = new Set<FoodTag>();
  for (const id of restrictions ?? []) {
    for (const tag of RESTRICTION_RULES[id]?.forbids ?? []) out.add(tag);
  }
  return out;
}

/** True when a food is compatible with the declared restrictions. */
export function fitsDiet(foodId: string, restrictions: string[] | undefined): boolean {
  const banned = forbiddenTags(restrictions);
  if (banned.size === 0) return true;
  return !foodMeta(foodId).tags.some((t) => banned.has(t));
}

/** A macro snapshot scaled to a portion. */
export interface Portion {
  food: FoodEntry;
  /** How many "units" of the entry (100 g blocks, or literal units). */
  count: number;
  /** Human portion label, e.g. "150 g" or "2 × egg". */
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function scale(food: FoodEntry, count: number): Portion {
  const label =
    food.per === '100g'
      ? `${Math.round(count * 100)} g`
      : count === 1
        ? food.unitLabel
        : `${count} × ${food.unitLabel}`;
  return {
    food,
    count,
    label,
    calories: Math.round(food.kcal * count),
    protein: Math.round(food.protein * count),
    carbs: Math.round(food.carbs * count),
    fat: Math.round(food.fat * count),
  };
}

/** Property density used for ranking: grams of protein per 100 kcal. */
export function proteinDensity(food: FoodEntry): number {
  if (food.kcal <= 0) return 0;
  return (food.protein / food.kcal) * 100;
}

export interface SuggestionOptions {
  /** Foods already logged today — never suggested again by default. */
  exclude?: string[];
  /** Restriction ids; overrides the profile when given. */
  restrictions?: string[];
  limit?: number;
  /** How many kcal this slot should carry; defaults to a quarter of the day. */
  budgetCalories?: number;
  /** Protein still missing today — tilts ranking toward protein-dense foods. */
  proteinGap?: number;
}

export interface MealSuggestion extends Portion {
  /** Why this food was ranked here, in one line. */
  reason: string;
  /** 0–100 fit score (portion within budget, protein density, slot affinity). */
  score: number;
}

function dietOf(state: FitnessState, opts: SuggestionOptions): string[] {
  return opts.restrictions ?? state.profile.dietary?.restrictions ?? [];
}

/**
 * Rank foods for one meal slot.
 *
 * Scoring is additive and legible on purpose: portion fit (up to 45), protein
 * density when a protein gap exists (up to 30), slot affinity (up to 20) and
 * how close the food sits to the slot's typical weight (up to 10). Ties break
 * on the food's original table order so the list is stable between renders.
 */
export function suggestMealsForSlot(
  state: FitnessState,
  slot: MealSlot,
  opts: SuggestionOptions = {},
): MealSuggestion[] {
  const budget = Math.max(120, opts.budgetCalories ?? 550);
  const exclude = new Set(opts.exclude ?? []);
  const favorites = new Set(state.profile.dietary?.favorites ?? []);
  const dislikes = new Set(state.profile.dietary?.dislikes ?? []);
  const restrictions = dietOf(state, opts);
  const wantProtein = (opts.proteinGap ?? 0) > 20;

  const scored: { suggestion: MealSuggestion; index: number }[] = [];
  FOOD_DB.forEach((food, index) => {
    if (exclude.has(food.id) || dislikes.has(food.id)) return;
    if (!fitsDiet(food.id, restrictions)) return;
    const meta = foodMeta(food.id);
    if (!meta.slots.includes(slot)) return;

    // Pick the portion that best lands inside the slot budget: unit foods step
    // in whole units, per-100g foods in 50 g steps, both capped by the budget.
    const perUnit = food.per === '100g' ? food.kcal / 2 : food.kcal;
    let count = food.per === '100g' ? 1 : Math.max(1, Math.round(budget / food.kcal));
    const maxCount = food.per === '100g' ? 3 : 4;
    count = Math.min(Math.max(count, food.per === '100g' ? 0.5 : 1), maxCount);
    const portion = scale(food, count);
    if (portion.calories > budget * 1.15) return;
    if (perUnit <= 0) return;

    const fit = 45 * (1 - Math.min(1, Math.abs(portion.calories - budget * 0.75) / budget));
    const protein = wantProtein ? 30 * Math.min(1, proteinDensity(food) / 12) : 0;
    const slotRank = meta.slots.indexOf(slot);
    const affinity = slotRank === 0 ? 20 : slotRank === 1 ? 12 : 5;
    const heftFit = 10 * (1 - Math.min(1, Math.abs(meta.heft - (slot === 'snack' ? 1 : 2.5)) / 2));
    const bonus = favorites.has(food.id) ? 12 : 0;

    const score = Math.round(fit + protein + affinity + heftFit + bonus);
    const reason = favorites.has(food.id)
      ? 'One of your favourites'
      : wantProtein && proteinDensity(food) >= 12
        ? `High protein for this slot — ${proteinDensity(food).toFixed(1)} g per 100 kcal`
        : slotRank === 0
          ? `A ${slot} staple that fits the ${budget} kcal you have left`
          : `Fits the ${budget} kcal left in your day`;

    scored.push({ suggestion: { ...portion, reason, score }, index });
  });

  scored.sort((a, b) => b.suggestion.score - a.suggestion.score || a.index - b.index);
  const limit = opts.limit ?? 4;
  return scored.slice(0, limit).map((s) => s.suggestion);
}

export interface SwapOptions {
  /** Restriction ids; overrides the profile when given. */
  restrictions?: string[];
  /** Foods already eaten today, kept out of the alternatives. */
  exclude?: string[];
  limit?: number;
  /** Max relative calorie difference, 0.2 = within ±20%. */
  tolerance?: number;
}

/**
 * Same-macro alternatives to a logged food — the "swap this" list.
 *
 * A swap is only useful if it keeps the day's numbers roughly where they were,
 * so candidates are filtered by a calorie window and then ranked by how close
 * their protein is (protein is what people actually mind replacing).
 */
export function swapAlternatives(
  foodId: string,
  state: FitnessState,
  opts: SwapOptions = {},
): Portion[] {
  const base = foodById(foodId);
  if (!base) return [];
  const tol = opts.tolerance ?? 0.25;
  const restrictions = opts.restrictions ?? state.profile.dietary?.restrictions;
  const exclude = new Set([foodId, ...(opts.exclude ?? [])]);
  const baseMeta = foodMeta(base.id);

  const candidates: { portion: Portion; delta: number; index: number }[] = [];
  FOOD_DB.forEach((food, index) => {
    if (exclude.has(food.id) || !fitsDiet(food.id, restrictions)) return;
    // A swap must be able to stand in the same meal.
    const overlap = foodMeta(food.id).slots.some((s) => baseMeta.slots.includes(s));
    if (!overlap) return;

    // Serve it at whatever portion matches the original's energy.
    const perUnit = food.per === '100g' ? food.kcal / 100 : food.kcal;
    if (perUnit <= 0) return;
    const raw = (base.per === '100g' ? base.kcal : base.kcal) / perUnit;
    const count =
      food.per === '100g'
        ? Math.min(3, Math.max(0.5, Math.round((raw / 100) * 2) / 2))
        : Math.min(4, Math.max(1, Math.round(raw)));
    const portion = scale(food, count);
    const delta = Math.abs(portion.calories - base.kcal) / Math.max(1, base.kcal);
    if (delta > tol) return;
    candidates.push({ portion, delta, index });
  });

  candidates.sort(
    (a, b) =>
      Math.abs(a.portion.protein - base.protein) - Math.abs(b.portion.protein - base.protein) ||
      a.delta - b.delta ||
      a.index - b.index,
  );
  return candidates.slice(0, opts.limit ?? 5).map((c) => c.portion);
}

export interface SlotPlan {
  slot: MealSlot;
  /** Share of the day's calories this slot should carry. */
  calories: number;
  suggestions: MealSuggestion[];
}

/** Typical split of a day's energy across the four slots. */
export const SLOT_SPLIT: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

/**
 * A whole-day suggestion set: each slot gets its calorie share and its own
 * ranked list. Nothing is written to the log — the athlete taps what they want.
 */
export function suggestDayPlan(
  state: FitnessState,
  dailyCalories: number,
  opts: SuggestionOptions & { date?: string } = {},
): SlotPlan[] {
  const exclude = new Set(opts.exclude ?? []);
  const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  return slots.map((slot) => {
    const calories = Math.round(dailyCalories * SLOT_SPLIT[slot]);
    const suggestions = suggestMealsForSlot(state, slot, {
      ...opts,
      exclude: [...exclude],
      budgetCalories: calories,
      limit: opts.limit ?? 3,
    });
    for (const s of suggestions) exclude.add(s.food.id);
    return { slot, calories, suggestions };
  });
}

export type { DietaryPreferences };
