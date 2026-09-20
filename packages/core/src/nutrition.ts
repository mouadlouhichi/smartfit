import type { FitnessState, MealLog, MealSlot, UserProfile } from './types';
import { latestWeightKg } from './program';

/**
 * Fuel — the nutrition half of "calories in vs calories out".
 *
 * Targets are deliberately transparent: every number the Fuel screen shows
 * can be recomputed from the profile plus the latest weigh-in, and
 * `nutritionTargets` returns the basis lines so the UI can print them. No
 * black-box "smart" scores — people quit trackers that won't show their math.
 *
 * Energy model:
 *  - BMR: Mifflin-St Jeor when sex/age/height are provided (the equation
 *    every clinical calculator uses), otherwise the classic quick estimate
 *    of 24 kcal per kg of body weight.
 *  - TDEE: BMR × activity multiplier (self-reported, editable).
 *  - Goal: a 15% deficit to cut, level to maintain, 10% surplus to gain —
 *    the ranges sports-nutrition position stands actually recommend.
 *  - Protein: 2.0 g/kg cutting (muscle retention in a deficit), 1.6 g/kg
 *    maintaining, 1.8 g/kg gaining. Fat 25% of energy; carbs take the rest.
 */

export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

export type ActivityLevel = NonNullable<UserProfile['activityLevel']>;
export type NutritionGoal = NonNullable<UserProfile['nutritionGoal']>;

export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; factor: number }[] = [
  { id: 'sedentary', label: 'Desk days, little training', factor: 1.2 },
  { id: 'light', label: 'Training 1–3× / week', factor: 1.375 },
  { id: 'moderate', label: 'Training 4–5× / week', factor: 1.55 },
  { id: 'active', label: 'Training 6–7× / week', factor: 1.725 },
];

export const NUTRITION_GOALS: {
  id: NutritionGoal;
  label: string;
  factor: number;
  protein: number;
}[] = [
  { id: 'cut', label: 'Lose fat', factor: 0.85, protein: 2.0 },
  { id: 'maintain', label: 'Maintain', factor: 1, protein: 1.6 },
  { id: 'gain', label: 'Build muscle', factor: 1.1, protein: 1.8 },
];

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Intermediates, surfaced in the "how we calculate it" explainer. */
  bmr: number;
  tdee: number;
  weightKg: number;
  goal: NutritionGoal;
  activity: ActivityLevel;
  /** Human lines explaining where the numbers come from. */
  basis: string[];
}

// latestWeightKg(state) is shared with the program engine (see ./program).

/** Goal from the profile override, else from target vs current weight. */
export function deriveNutritionGoal(profile: UserProfile, weightKg: number): NutritionGoal {
  if (profile.nutritionGoal) return profile.nutritionGoal;
  const target = profile.targetWeightKg;
  if (target == null) return 'maintain';
  const delta = target - weightKg;
  if (delta <= -1) return 'cut';
  if (delta >= 1) return 'gain';
  return 'maintain';
}

/** Daily calorie/macro targets, or null until a weigh-in exists. */
export function nutritionTargets(state: FitnessState): NutritionTargets | null {
  const weightKg = latestWeightKg(state);
  if (weightKg == null || weightKg <= 0) return null;

  const { profile } = state;
  const activity = profile.activityLevel ?? 'light';
  const goal = deriveNutritionGoal(profile, weightKg);

  const basis: string[] = [];
  let bmr: number;
  if (profile.sex && profile.ageYears && profile.heightCm) {
    const s = profile.sex === 'male' ? 5 : -161;
    bmr = Math.round(10 * weightKg + 6.25 * profile.heightCm - 5 * profile.ageYears + s);
    basis.push(
      `BMR ${bmr} kcal — Mifflin-St Jeor for ${weightKg.toFixed(1)} kg, ${profile.heightCm} cm, ${profile.ageYears} y (${profile.sex}).`,
    );
  } else {
    bmr = Math.round(24 * weightKg);
    basis.push(`BMR ${bmr} kcal — quick estimate of 24 kcal per kg at ${weightKg.toFixed(1)} kg.`);
  }

  const factor = ACTIVITY_LEVELS.find((a) => a.id === activity)?.factor ?? 1.375;
  const tdee = Math.round(bmr * factor);
  basis.push(`Maintenance ${tdee} kcal — BMR × ${factor} (${activity} activity).`);

  const g = NUTRITION_GOALS.find((x) => x.id === goal) ?? NUTRITION_GOALS[1];
  const calories = Math.round((tdee * g.factor) / 5) * 5;
  basis.push(
    goal === 'maintain'
      ? `Target ${calories} kcal — level intake to hold your weight.`
      : `Target ${calories} kcal — ${goal === 'cut' ? '15% deficit' : '10% surplus'} to ${goal === 'cut' ? 'lose fat' : 'build muscle'}.`,
  );

  const protein = Math.round(weightKg * g.protein);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  basis.push(
    `Protein ${protein} g (${g.protein} g/kg), fat ${fat} g (25% of energy), carbs ${carbs} g fill the rest.`,
  );

  return { calories, protein, carbs, fat, bmr, tdee, weightKg, goal, activity, basis };
}

export interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const EMPTY_TOTALS: MealTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

/** Meals logged for one ISO date. */
export function mealsOn(meals: MealLog[], date: string): MealLog[] {
  return meals.filter((m) => m.date === date);
}

/** Sum a day's (or any list's) meals into totals. */
export function sumMeals(meals: MealLog[]): MealTotals {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories || 0),
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
    }),
    { ...EMPTY_TOTALS },
  );
}

/** Calories burned today across logged sessions (the "out" side). */
export function burnedOn(state: FitnessState, date: string): number {
  return state.sessions.filter((s) => s.date === date).reduce((a, s) => a + s.calories, 0);
}

/* ── on-device meal scan ─────────────────────────────────────────────────── */

/**
 * A rough-but-honest food table for the meal scanner. Values are per 100 g
 * (or per unit where a unit is the natural portion) from standard composition
 * tables, rounded — the scan is a head start, never a lab measurement, and
 * the UI says so.
 */
export interface FoodEntry {
  id: string;
  names: string[];
  per: '100g' | 'unit';
  unitLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const FOOD_DB: FoodEntry[] = [
  {
    id: 'chicken',
    names: ['chicken', 'chicken breast', 'grilled chicken'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },
  {
    id: 'beef',
    names: ['beef', 'steak', 'minced beef', 'kefta'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 250,
    protein: 26,
    carbs: 0,
    fat: 15,
  },
  {
    id: 'salmon',
    names: ['salmon'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 208,
    protein: 20,
    carbs: 0,
    fat: 13,
  },
  {
    id: 'tuna',
    names: ['tuna'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 132,
    protein: 28,
    carbs: 0,
    fat: 1.3,
  },
  {
    id: 'fish',
    names: ['fish', 'white fish', 'cod'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 105,
    protein: 23,
    carbs: 0,
    fat: 1.5,
  },
  {
    id: 'egg',
    names: ['egg', 'eggs'],
    per: 'unit',
    unitLabel: 'egg',
    kcal: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
  },
  {
    id: 'rice',
    names: ['rice', 'cooked rice'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
  },
  {
    id: 'pasta',
    names: ['pasta', 'cooked pasta', 'spaghetti'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 158,
    protein: 5.8,
    carbs: 31,
    fat: 0.9,
  },
  {
    id: 'couscous',
    names: ['couscous'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 112,
    protein: 3.8,
    carbs: 23,
    fat: 0.2,
  },
  {
    id: 'bread',
    names: ['bread', 'khobz', 'baguette', 'slice of bread'],
    per: 'unit',
    unitLabel: 'slice',
    kcal: 80,
    protein: 3,
    carbs: 15,
    fat: 1,
  },
  {
    id: 'oats',
    names: ['oats', 'oatmeal', 'porridge'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 389,
    protein: 17,
    carbs: 66,
    fat: 7,
  },
  {
    id: 'potato',
    names: ['potato', 'potatoes'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 87,
    protein: 2,
    carbs: 20,
    fat: 0.1,
  },
  {
    id: 'sweetpotato',
    names: ['sweet potato'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 86,
    protein: 1.6,
    carbs: 20,
    fat: 0.1,
  },
  {
    id: 'lentils',
    names: ['lentils', 'lentil'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 116,
    protein: 9,
    carbs: 20,
    fat: 0.4,
  },
  {
    id: 'chickpeas',
    names: ['chickpeas', 'chickpea'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 164,
    protein: 8.9,
    carbs: 27,
    fat: 2.6,
  },
  {
    id: 'beans',
    names: ['beans', 'white beans', 'red beans'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 127,
    protein: 8.7,
    carbs: 23,
    fat: 0.5,
  },
  {
    id: 'tofu',
    names: ['tofu'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 76,
    protein: 8,
    carbs: 1.9,
    fat: 4.8,
  },
  {
    id: 'greek-yogurt',
    names: ['greek yogurt', 'yogurt', 'greek yoghurt'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 59,
    protein: 10,
    carbs: 3.6,
    fat: 0.4,
  },
  {
    id: 'milk',
    names: ['milk', 'glass of milk'],
    per: 'unit',
    unitLabel: 'glass (250 ml)',
    kcal: 158,
    protein: 8,
    carbs: 12,
    fat: 8,
  },
  {
    id: 'cheese',
    names: ['cheese'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 356,
    protein: 25,
    carbs: 1.3,
    fat: 28,
  },
  {
    id: 'whey',
    names: ['whey', 'whey scoop', 'protein shake', 'protein powder'],
    per: 'unit',
    unitLabel: 'scoop',
    kcal: 120,
    protein: 24,
    carbs: 3,
    fat: 1.5,
  },
  {
    id: 'peanut-butter',
    names: ['peanut butter'],
    per: 'unit',
    unitLabel: 'tbsp',
    kcal: 94,
    protein: 3.8,
    carbs: 3.3,
    fat: 8,
  },
  {
    id: 'almonds',
    names: ['almonds', 'almond', 'nuts'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 579,
    protein: 21,
    carbs: 22,
    fat: 50,
  },
  {
    id: 'banana',
    names: ['banana'],
    per: 'unit',
    unitLabel: 'banana',
    kcal: 105,
    protein: 1.3,
    carbs: 27,
    fat: 0.4,
  },
  {
    id: 'apple',
    names: ['apple'],
    per: 'unit',
    unitLabel: 'apple',
    kcal: 95,
    protein: 0.5,
    carbs: 25,
    fat: 0.3,
  },
  {
    id: 'orange',
    names: ['orange'],
    per: 'unit',
    unitLabel: 'orange',
    kcal: 62,
    protein: 1.2,
    carbs: 15,
    fat: 0.2,
  },
  {
    id: 'dates',
    names: ['dates', 'date'],
    per: 'unit',
    unitLabel: 'date',
    kcal: 66,
    protein: 0.4,
    carbs: 18,
    fat: 0,
  },
  {
    id: 'avocado',
    names: ['avocado'],
    per: 'unit',
    unitLabel: 'avocado',
    kcal: 240,
    protein: 3,
    carbs: 12,
    fat: 22,
  },
  {
    id: 'olive-oil',
    names: ['olive oil', 'oil'],
    per: 'unit',
    unitLabel: 'tbsp',
    kcal: 119,
    protein: 0,
    carbs: 0,
    fat: 13.5,
  },
  {
    id: 'salad',
    names: ['salad', 'green salad'],
    per: 'unit',
    unitLabel: 'bowl',
    kcal: 120,
    protein: 2.5,
    carbs: 12,
    fat: 7,
  },
  {
    id: 'broccoli',
    names: ['broccoli'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 34,
    protein: 2.8,
    carbs: 7,
    fat: 0.4,
  },
  {
    id: 'vegetables',
    names: ['vegetables', 'veggies', 'cooked vegetables'],
    per: '100g',
    unitLabel: '100 g',
    kcal: 35,
    protein: 2,
    carbs: 7,
    fat: 0.3,
  },
  {
    id: 'pizza',
    names: ['pizza', 'pizza slice'],
    per: 'unit',
    unitLabel: 'slice',
    kcal: 285,
    protein: 12,
    carbs: 36,
    fat: 10,
  },
  {
    id: 'burger',
    names: ['burger', 'cheeseburger'],
    per: 'unit',
    unitLabel: 'burger',
    kcal: 540,
    protein: 25,
    carbs: 40,
    fat: 29,
  },
  {
    id: 'sandwich',
    names: ['sandwich'],
    per: 'unit',
    unitLabel: 'sandwich',
    kcal: 350,
    protein: 18,
    carbs: 40,
    fat: 12,
  },
  {
    id: 'tajine',
    names: ['tajine', 'tagine'],
    per: 'unit',
    unitLabel: 'portion',
    kcal: 380,
    protein: 30,
    carbs: 35,
    fat: 12,
  },
  {
    id: 'latte',
    names: ['latte', 'coffee with milk'],
    per: 'unit',
    unitLabel: 'cup',
    kcal: 120,
    protein: 6,
    carbs: 12,
    fat: 5,
  },
  {
    id: 'juice',
    names: ['juice', 'orange juice'],
    per: 'unit',
    unitLabel: 'glass',
    kcal: 110,
    protein: 1.7,
    carbs: 26,
    fat: 0.3,
  },
  {
    id: 'soda',
    names: ['soda', 'coke', 'cola'],
    per: 'unit',
    unitLabel: 'can',
    kcal: 140,
    protein: 0,
    carbs: 39,
    fat: 0,
  },
  {
    id: 'protein-bar',
    names: ['protein bar'],
    per: 'unit',
    unitLabel: 'bar',
    kcal: 210,
    protein: 20,
    carbs: 22,
    fat: 7,
  },
];

const QTY_UNITS: Record<string, number> = {
  g: 1,
  gr: 1,
  kg: 1000,
  ml: 1, // treat ml ≈ g for scan purposes
  oz: 28.35,
  cup: 240,
  cups: 240,
  tbsp: 1, // tablespoon-sized entries are per-unit in FOOD_DB
  spoon: 1,
  scoop: 1,
  scoops: 1,
  piece: 1,
  pieces: 1,
  pcs: 1,
  slice: 1,
  slices: 1,
  unit: 1,
  units: 1,
};

export interface MealScan {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Human-readable matches, e.g. "chicken ×200 g". */
  matched: string[];
  /** True when nothing in the text mapped to the food table. */
  empty: boolean;
}

/**
 * On-device "AI" meal scan: turns a free-text description ("200g grilled
 * chicken with rice and 2 eggs") into macro estimates. Deterministic, free
 * and offline — the expensive provider path stays optional on top of it.
 * Explicit numbers in the text ("450 kcal", "30g protein") always win.
 */
export function parseMealDescription(text: string): MealScan {
  const lower = ` ${text
    .toLowerCase()
    .replace(/[,;.+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
  const matched: string[] = [];
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  // Explicit macro call-outs win over table math.
  const explicit = (re: RegExp) => {
    const m = lower.match(re);
    return m ? Number(m[1].replace(',', '.')) : null;
  };
  const exKcal = explicit(/\b(\d{2,4})\s*(?:kcal|calories|cal)\b/);
  const exProtein =
    explicit(/\b(\d{1,3})\s*g\s*(?:of\s*)?protein\b/) ??
    explicit(/\bprotein\s*:?\s*(\d{1,3})\s*g\b/);
  const exCarbs = explicit(/\b(\d{1,3})\s*g\s*(?:of\s*)?(?:carbs|carbohydrates)\b/);
  const exFat = explicit(/\b(\d{1,3})\s*g\s*(?:of\s*)?fat\b/);

  const consumed = new Set<string>();
  for (const food of FOOD_DB) {
    // Longest name first so "chicken breast" beats "chicken".
    const names = [...food.names].sort((a, b) => b.length - a.length);
    const hit = names.find(
      (n) => lower.includes(` ${n} `) || lower.includes(` ${n}`) || lower.includes(`${n} `),
    );
    if (!hit || consumed.has(food.id)) continue;
    consumed.add(food.id);

    // Quantity right before ("200g chicken") or after ("chicken 200g") the name.
    const before = lower.match(
      new RegExp(
        `(\\d+(?:[.,]\\d+)?)\\s*(g|gr|kg|ml|oz|cups?|tbsp|scoops?|pieces?|pcs|slices?)\\s+${hit}\\b`,
      ),
    );
    const countBefore = lower.match(new RegExp(`(\\d+)\\s+(?:x\\s*)?${hit}\\b`));
    const after = lower.match(
      new RegExp(
        `\\b${hit}\\b\\s*(\\d+(?:[.,]\\d+)?)\\s*(g|gr|kg|ml|oz|cups?|tbsp|scoops?|pieces?|pcs|slices?)`,
      ),
    );
    const countAfter = lower.match(new RegExp(`\\b${hit}\\b\\s*[x:]?\\s*(\\d{1,2})\\b`));

    let grams = 100; // default portion when nothing is specified
    let units = 1;
    let qtyLabel = '';
    if (before || after) {
      const q = before ?? after;
      const value = Number(q![1].replace(',', '.'));
      const unit = q![2];
      if (food.per === '100g') {
        grams = value * (QTY_UNITS[unit] ?? 1);
        qtyLabel = `${value} ${unit}`;
      } else {
        units =
          unit === 'tbsp' ||
          unit === 'scoop' ||
          unit === 'slice' ||
          unit === 'piece' ||
          unit === 'pcs'
            ? value
            : Math.round(value / 100) || 1;
        qtyLabel = `${value} ${unit}`;
      }
    } else if (countBefore && Number(countBefore[1]) <= 12) {
      units = Number(countBefore[1]);
      qtyLabel = `×${units}`;
    } else if (countAfter && Number(countAfter[1]) <= 12 && !/\d/.test(hit)) {
      // "eggs 2" style — only when the name itself carries no digit.
      units = Number(countAfter[1]);
      qtyLabel = `×${units}`;
    }

    const scale = food.per === '100g' ? grams / 100 : units;
    kcal += food.kcal * scale;
    protein += food.protein * scale;
    carbs += food.carbs * scale;
    fat += food.fat * scale;
    matched.push(`${food.names[0]} ${qtyLabel}`.trim());
  }

  const scan: MealScan = {
    name: text.trim().slice(0, 120),
    calories: Math.round(exKcal ?? kcal),
    protein: Math.round(exProtein ?? protein),
    carbs: Math.round(exCarbs ?? carbs),
    fat: Math.round(exFat ?? fat),
    matched,
    empty: matched.length === 0 && exKcal == null,
  };
  return scan;
}
