import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_LEVELS,
  NUTRITION_GOALS,
  burnedOn,
  deriveNutritionGoal,
  emptyState,
  mealsOn,
  nutritionTargets,
  parseMealDescription,
  parseState,
  sumMeals,
} from '../src/index.ts';
import type { FitnessState, MealLog } from '../src/index.ts';

function stateWith(over: Partial<FitnessState> = {}): FitnessState {
  return { ...emptyState(), ...over };
}

function weightLog(kg: number, date = '2026-09-01') {
  return { id: `b-${date}`, date, unit: 'weight' as const, value: kg, createdAt: 1 };
}

function meal(over: Partial<MealLog> = {}): MealLog {
  return {
    id: 'meal-1',
    date: '2026-09-10',
    name: 'Chicken & rice',
    slot: 'lunch',
    calories: 620,
    protein: 45,
    createdAt: 1,
    ...over,
  };
}

test('targets stay null until a weigh-in exists', () => {
  assert.equal(nutritionTargets(stateWith()), null);
});

test('quick estimate: 24 kcal/kg, light activity, maintain by default', () => {
  const t = nutritionTargets(stateWith({ bodyLogs: [weightLog(80)] }));
  assert.ok(t);
  assert.equal(t.bmr, 1920); // 24 × 80
  assert.equal(t.tdee, 2640); // × 1.375 (default light)
  assert.equal(t.calories, 2640); // maintain = level
  assert.equal(t.protein, 128); // 1.6 g/kg
  assert.equal(t.fat, 73); // 25% of kcal / 9
  assert.equal(t.carbs, 368); // remainder / 4
  assert.ok(t.basis.length >= 4);
});

test('Mifflin-St Jeor path with a cut goal', () => {
  const s = stateWith({ bodyLogs: [weightLog(80)] });
  s.profile.sex = 'male';
  s.profile.ageYears = 30;
  s.profile.heightCm = 178;
  s.profile.activityLevel = 'moderate';
  s.profile.nutritionGoal = 'cut';
  const t = nutritionTargets(s);
  assert.ok(t);
  assert.equal(t.bmr, 1768); // 10·80 + 6.25·178 − 5·30 + 5
  assert.equal(t.tdee, 2740); // × 1.55
  assert.equal(t.calories, 2330); // × 0.85, rounded to 5
  assert.equal(t.protein, 160); // 2.0 g/kg while cutting
  assert.equal(t.goal, 'cut');
  assert.ok(t.basis.some((b) => b.includes('Mifflin-St Jeor')));
});

test('deriveNutritionGoal: override wins, else target vs scale', () => {
  const s = stateWith();
  s.profile.nutritionGoal = 'gain';
  assert.equal(deriveNutritionGoal(s.profile, 80), 'gain');
  delete s.profile.nutritionGoal;
  s.profile.targetWeightKg = 75;
  assert.equal(deriveNutritionGoal(s.profile, 80), 'cut');
  s.profile.targetWeightKg = 85;
  assert.equal(deriveNutritionGoal(s.profile, 80), 'gain');
  s.profile.targetWeightKg = 80.5;
  assert.equal(deriveNutritionGoal(s.profile, 80), 'maintain');
  delete s.profile.targetWeightKg;
  assert.equal(deriveNutritionGoal(s.profile, 80), 'maintain');
});

test('activity factors and goal factors are the published ranges', () => {
  assert.deepEqual(
    ACTIVITY_LEVELS.map((a) => a.factor),
    [1.2, 1.375, 1.55, 1.725],
  );
  assert.deepEqual(
    NUTRITION_GOALS.map((g) => [g.factor, g.protein]),
    [
      [0.85, 2.0],
      [1, 1.6],
      [1.1, 1.8],
    ],
  );
});

test('mealsOn / sumMeals / burnedOn aggregate the day', () => {
  const s = stateWith({
    meals: [meal(), meal({ id: 'meal-2', date: '2026-09-11', calories: 200, protein: 10 })],
  });
  // Build a real session for the burn side.
  s.sessions = [
    {
      id: 'ses-1',
      date: '2026-09-10',
      title: 'Push',
      categoryId: 'cat-strength',
      durationMin: 45,
      intensity: 'moderate',
      calories: 310,
      createdAt: 1,
      exercises: [],
    } as FitnessState['sessions'][number],
  ];
  assert.equal(mealsOn(s.meals, '2026-09-10').length, 1);
  assert.deepEqual(sumMeals(mealsOn(s.meals, '2026-09-10')), {
    calories: 620,
    protein: 45,
    carbs: 0,
    fat: 0,
  });
  assert.equal(burnedOn(s, '2026-09-10'), 310);
  assert.equal(burnedOn(s, '2026-09-11'), 0);
});

test('meal scan reads quantities before and after the food name', () => {
  const scan = parseMealDescription('200g grilled chicken with rice and 2 eggs');
  assert.equal(scan.empty, false);
  assert.equal(scan.calories, 604); // 330 + 130 + 144
  assert.equal(scan.protein, 77); // 62 + 2.7 + 12.6
  assert.equal(scan.matched.length, 3);
});

test('meal scan: explicit kcal/protein call-outs win', () => {
  const scan = parseMealDescription('big salad 450 kcal 30g protein');
  assert.equal(scan.calories, 450);
  assert.equal(scan.protein, 30);
  assert.equal(scan.empty, false);
});

test('meal scan covers local dishes and reports honest misses', () => {
  const local = parseMealDescription('tajine and khobz');
  assert.equal(local.calories, 460); // 380 + 80
  assert.equal(local.matched.length, 2);
  const miss = parseMealDescription('mystery goo');
  assert.equal(miss.empty, true);
  assert.equal(miss.calories, 0);
});

test('parseState sanitizes meals and the new profile fuel fields', () => {
  const parsed = parseState({
    profile: { nutritionGoal: 'bulk', activityLevel: 'moderate', ageYears: 200, heightCm: 178 },
    meals: [
      meal({ id: 'm-a', date: '2026-09-01' }),
      { id: 'm-b', date: '2026-09-05', name: 'Junk', slot: 'brunch', calories: -40, protein: -3 },
      { id: '', date: '2026-09-05', calories: 10 }, // no id → dropped
    ],
  });
  // junk profile values are omitted, valid ones kept
  assert.equal(parsed.profile.nutritionGoal, undefined);
  assert.equal(parsed.profile.activityLevel, 'moderate');
  assert.equal(parsed.profile.ageYears, undefined);
  assert.equal(parsed.profile.heightCm, 178);
  // meals: sorted date-desc, slot fallback, negatives clamped
  assert.equal(parsed.meals.length, 2);
  assert.equal(parsed.meals[0].id, 'm-b');
  assert.equal(parsed.meals[0].slot, 'snack');
  assert.equal(parsed.meals[0].calories, 0);
  assert.equal(parsed.meals[0].protein, 0);
  assert.equal(parsed.meals[1].id, 'm-a');
});
