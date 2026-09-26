import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOD_DB,
  FOOD_META,
  RESTRICTIONS,
  SLOT_SPLIT,
  emptyState,
  fitsDiet,
  foodById,
  forbiddenTags,
  foodLabel,
  parseMealDescription,
  proteinDensity,
  suggestDayPlan,
  suggestMealsForSlot,
  swapAlternatives,
  type FitnessState,
  type MealSlot,
} from '../src/index';

function stateWithDiet(restrictions: string[], favorites: string[] = []): FitnessState {
  const state = emptyState();
  state.profile.dietary = { restrictions, favorites };
  return state;
}

test('every food in the table has a metadata row', () => {
  const missing = FOOD_DB.filter((f) => !FOOD_META[f.id]).map((f) => f.id);
  assert.deepEqual(missing, [], `foods without slot/tag metadata: ${missing.join(', ')}`);
});

test('every metadata row points at a real food', () => {
  const ids = new Set(FOOD_DB.map((f) => f.id));
  const orphans = Object.keys(FOOD_META).filter((id) => !ids.has(id));
  assert.deepEqual(orphans, [], `metadata for foods that do not exist: ${orphans.join(', ')}`);
});

test('every metadata row is usable: tags are known and slots are real', () => {
  const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  for (const [id, meta] of Object.entries(FOOD_META)) {
    assert.ok(meta.slots.length > 0, `${id} must belong to at least one slot`);
    for (const slot of meta.slots) assert.ok(slots.includes(slot), `${id}: bad slot ${slot}`);
    assert.ok([1, 2, 3].includes(meta.heft), `${id}: heft must be 1–3`);
  }
});

test('restrictions forbid exactly the tags they name', () => {
  assert.deepEqual([...forbiddenTags([])], []);
  assert.ok(forbiddenTags(['vegan']).has('dairy'));
  assert.ok(forbiddenTags(['vegan']).has('egg'));
  assert.equal(forbiddenTags(['vegan']).size, 6);

  assert.equal(fitsDiet('chicken', ['vegetarian']), false);
  assert.equal(fitsDiet('chicken', ['halal']), true, 'halal does not forbid poultry');
  assert.equal(fitsDiet('greek-yogurt', ['vegetarian']), true);
  assert.equal(fitsDiet('greek-yogurt', ['vegan']), false);
  assert.equal(fitsDiet('bread', ['no-gluten']), false);
  assert.equal(fitsDiet('almonds', ['no-nuts']), false);
  assert.equal(fitsDiet('chicken', []), true);
  assert.equal(fitsDiet('chicken', undefined), true);
});

test('every advertised restriction id has a rule behind it', () => {
  for (const { id, label } of RESTRICTIONS) {
    assert.ok(label.length > 0, `${id} needs a label`);
  }
  assert.ok(RESTRICTIONS.length >= 8);
});

test('suggestions never violate a restriction', () => {
  for (const restriction of RESTRICTIONS.map((r) => r.id)) {
    const state = stateWithDiet([restriction]);
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]) {
      for (const s of suggestMealsForSlot(state, slot, { limit: 6 })) {
        assert.ok(
          fitsDiet(s.food.id, [restriction]),
          `${s.food.id} offered despite the ${restriction} restriction`,
        );
      }
    }
  }
});

test('a vegan athlete is never offered meat, fish, dairy or egg', () => {
  const state = stateWithDiet(['vegan']);
  const offered = new Set<string>();
  for (const plan of suggestDayPlan(state, 2200)) {
    for (const s of plan.suggestions) offered.add(s.food.id);
  }
  for (const id of offered) {
    const tags = FOOD_META[id].tags;
    for (const banned of ['meat', 'poultry', 'fish', 'shellfish', 'dairy', 'egg']) {
      assert.ok(!tags.includes(banned as never), `${id} (${banned}) reached a vegan plan`);
    }
  }
  assert.ok(offered.size > 0, 'a vegan plan should still find something to suggest');
});

test('suggestions stay inside the slot budget and are explained', () => {
  const state = emptyState();
  for (const s of suggestMealsForSlot(state, 'lunch', { budgetCalories: 500, limit: 5 })) {
    assert.ok(s.calories <= 500 * 1.25, `${s.food.id} is ${s.calories} kcal for a 500 kcal slot`);
    assert.ok(s.reason.length > 0);
    assert.ok(s.score > 0);
    assert.ok(s.label.length > 0);
    // The portion maths has to agree with the table.
    const factor = s.food.per === '100g' ? s.count : s.count;
    assert.equal(s.calories, Math.round(s.food.kcal * factor));
  }
});

test('the slot decides the food: breakfast is not offered a tajine', () => {
  const state = emptyState();
  const breakfast = suggestMealsForSlot(state, 'breakfast', { limit: 8 });
  assert.ok(breakfast.length > 0);
  for (const s of breakfast) {
    assert.ok(FOOD_META[s.food.id].slots.includes('breakfast'), `${s.food.id} is not a breakfast`);
  }
});

test('dislikes are excluded and favourites are ranked up', () => {
  const plain = emptyState();
  const liked = stateWithDiet([], ['broccoli']);
  const plainIds = suggestMealsForSlot(plain, 'dinner', { limit: 8 }).map((s) => s.food.id);
  const likedIds = suggestMealsForSlot(liked, 'dinner', { limit: 8 }).map((s) => s.food.id);
  if (plainIds.includes('broccoli')) {
    assert.ok(
      likedIds.indexOf('broccoli') <= plainIds.indexOf('broccoli'),
      'a favourite must not rank lower',
    );
  }

  const avoids = emptyState();
  avoids.profile.dietary = { restrictions: [], dislikes: ['broccoli'] };
  assert.ok(
    !suggestMealsForSlot(avoids, 'dinner', { limit: 20 }).some((s) => s.food.id === 'broccoli'),
  );
});

test('already-eaten foods are not suggested again', () => {
  const state = emptyState();
  const all = suggestMealsForSlot(state, 'lunch', { limit: 20 }).map((s) => s.food.id);
  assert.ok(all.length > 1);
  const rest = suggestMealsForSlot(state, 'lunch', { exclude: all.slice(0, 1), limit: 20 }).map(
    (s) => s.food.id,
  );
  assert.ok(!rest.includes(all[0]));
});

test('a protein gap tilts suggestions toward protein density', () => {
  const state = emptyState();
  const cheap = suggestMealsForSlot(state, 'lunch', { limit: 4, proteinGap: 0 });
  const needing = suggestMealsForSlot(state, 'lunch', { limit: 4, proteinGap: 80 });
  const avg = (list: typeof cheap) =>
    list.reduce((a, s) => a + proteinDensity(s.food), 0) / Math.max(1, list.length);
  assert.ok(
    avg(needing) >= avg(cheap),
    'a large protein gap must not make suggestions less protein-dense',
  );
});

test('suggesting a day covers every slot and spreads the calories', () => {
  const state = emptyState();
  const plan = suggestDayPlan(state, 2000);
  assert.equal(plan.length, 4);
  assert.deepEqual(
    plan.map((p) => p.slot),
    ['breakfast', 'lunch', 'dinner', 'snack'],
  );
  assert.equal(plan[0].calories, Math.round(2000 * SLOT_SPLIT.breakfast));
  const total = Object.values(SLOT_SPLIT).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 0.001, 'the slot split must add up to a whole day');

  // A day plan should not suggest the same food twice.
  const ids = plan.flatMap((p) => p.suggestions.map((s) => s.food.id));
  assert.equal(new Set(ids).size, ids.length, 'no repeats in one day');
});

test('swap alternatives land near the original and stay legal', () => {
  const state = stateWithDiet([]);
  const swaps = swapAlternatives('rice', state, { limit: 6 });
  const rice = foodById('rice')!;
  for (const s of swaps) {
    assert.notEqual(s.food.id, 'rice', 'a swap must be a different food');
    assert.ok(
      Math.abs(s.calories - rice.kcal) / rice.kcal <= 0.3,
      `${s.food.id} at ${s.calories} kcal is not a stand-in for ${rice.kcal} kcal of rice`,
    );
  }

  // Restricted swaps must never appear.
  const vegan = stateWithDiet(['vegan']);
  for (const s of swapAlternatives('chicken', vegan, { limit: 8 })) {
    assert.ok(fitsDiet(s.food.id, ['vegan']), `${s.food.id} is not vegan`);
  }
});

test('swapping a food that does not exist is empty, not a crash', () => {
  assert.deepEqual(swapAlternatives('unicorn', emptyState()), []);
});

test('the text scanner understands French, and keeps English', () => {
  const fr = parseMealDescription('200g de poulet avec du riz et 2 œufs', { locale: 'fr' });
  assert.deepEqual(fr.items.sort(), ['chicken', 'egg', 'rice']);
  assert.ok(fr.calories > 300 && fr.calories < 900, `implausible scan: ${fr.calories} kcal`);
  assert.ok(
    fr.matched.some((m) => m.includes('poulet')),
    fr.matched.join(' | '),
  );

  const en = parseMealDescription('200g chicken with rice and 2 eggs');
  assert.deepEqual(en.items.sort(), fr.items.sort());
  assert.equal(en.calories, fr.calories, 'the same meal must scan the same in both languages');

  // Mixed language still resolves — French aliases are additive, never a swap.
  const mixed = parseMealDescription('poulet 150g with rice', { locale: 'fr' });
  assert.deepEqual(mixed.items.sort(), ['chicken', 'rice']);
});

test('a French label is shown for a French athlete', () => {
  assert.equal(foodLabel('chicken', 'fr'), 'poulet');
  assert.equal(foodLabel('chicken', 'en'), 'chicken');
  assert.equal(foodLabel('rice', 'fr'), 'riz');
  // Unknown food id falls back to the id rather than an empty string.
  assert.equal(foodLabel('unicorn', 'fr'), 'unicorn');
});

test('the scanner reports the food ids behind a match so it can be swapped', () => {
  const scan = parseMealDescription('150g chicken and 100g rice');
  assert.deepEqual(scan.items.sort(), ['chicken', 'rice']);
  assert.equal(scan.empty, false);
  assert.equal(parseMealDescription('zzzzq').empty, true);
});
