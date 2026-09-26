import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOD_DB,
  MEAL_PHOTO_MAX_BYTES,
  buildMealScanPrompt,
  mealScanFromItems,
  parseJsonLoose,
  parseRecognizedItems,
  type RecognizedItem,
} from '../src/index';

const dataUrl = 'data:image/jpeg;base64,AAAA';

test('the prompt asks for food and portions — never for calories', () => {
  const prompt = buildMealScanPrompt();
  assert.ok(prompt.includes('You do NOT compute calories'), 'the prompt must refuse the macro job');
  assert.ok(prompt.includes('"items"'), 'the prompt must name the response shape');
  // Every food id has to be offered, or the model invents ids we must drop.
  for (const food of FOOD_DB)
    assert.ok(prompt.includes(food.id), `${food.id} missing from the catalog`);
});

test('the prompt teaches the local words for the local model', () => {
  const fr = buildMealScanPrompt('fr');
  assert.ok(fr.includes('poulet'), 'French aliases must reach the prompt');
  assert.ok(fr.includes('"fr"'));
});

test('a well-formed provider reply becomes recognised items', () => {
  const items = parseRecognizedItems({
    items: [
      { id: 'chicken', amount: 180, confidence: 0.9 },
      { id: 'rice', amount: 150, confidence: 0.7 },
    ],
  });
  assert.deepEqual(
    items.map((i) => [i.id, i.amount]),
    [
      ['chicken', 180],
      ['rice', 150],
    ],
  );
  assert.equal(items[0].confidence, 0.9);
});

test('a chatty provider reply is unwrapped, not rejected', () => {
  const wrapped = {
    choices: [
      {
        message: {
          content: '```json\n{"items":[{"id":"egg","amount":2,"confidence":0.8}]}\n```',
        },
      },
    ],
  };
  const items = parseRecognizedItems(wrapped);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'egg');
  assert.equal(items[0].amount, 2);
});

test('Gemini-shaped and bare-array replies both work', () => {
  const gemini = {
    candidates: [
      {
        content: {
          parts: [{ text: '{"items":[{"id":"banana","amount":1,"confidence":0.6}]}' }],
        },
      },
    ],
  };
  assert.equal(parseRecognizedItems(gemini)[0].id, 'banana');
  assert.equal(parseRecognizedItems([{ id: 'tofu', amount: 120 }])[0].id, 'tofu');
});

test('a free-text name resolves through the alias table', () => {
  const items = parseRecognizedItems({ items: [{ name: 'poulet grillé', amount: 200 }] }, 'fr');
  assert.equal(items[0].id, 'chicken');
  assert.equal(items[0].asSeen, 'poulet grillé', 'the model’s word is kept for the UI');
});

test('invented ids are dropped rather than logged', () => {
  const items = parseRecognizedItems({
    items: [
      { id: 'unicorn-steak', amount: 300 },
      { id: 'salmon', amount: 120 },
    ],
  });
  assert.deepEqual(
    items.map((i) => i.id),
    ['salmon'],
    'a hallucinated food must never reach the log',
  );
  assert.deepEqual(parseRecognizedItems({ items: [] }), []);
  assert.deepEqual(parseRecognizedItems({ nope: true }), []);
  assert.deepEqual(parseRecognizedItems(null), []);
  assert.deepEqual(parseRecognizedItems('not json at all'), []);
});

test('amounts are clamped to something a human could eat', () => {
  const huge = parseRecognizedItems({ items: [{ id: 'chicken', amount: 9000 }] });
  assert.ok(huge[0].amount <= 1000, `clamped to ${huge[0].amount}`);
  const zero = parseRecognizedItems({ items: [{ id: 'egg', amount: 0 }] });
  assert.equal(zero[0].amount, 1, 'zero falls back to a single serving, not zero grams');
  const negative = parseRecognizedItems({ items: [{ id: 'rice', amount: -50 }] });
  assert.ok(negative[0].amount > 0);
  const nonsense = parseRecognizedItems({ items: [{ id: 'rice', amount: 'lots' }] });
  assert.equal(nonsense[0].amount, 100, 'per-100 g foods default to a 100 g portion');
});

test('the same food twice in one photo is counted once', () => {
  const items = parseRecognizedItems({
    items: [
      { id: 'chicken', amount: 100 },
      { id: 'chicken', amount: 200 },
    ],
  });
  assert.equal(items.length, 1);
});

test('at most eight items survive, in the order the model ranked them', () => {
  const many = FOOD_DB.slice(0, 12).map((f) => ({ id: f.id, amount: f.per === '100g' ? 100 : 1 }));
  const items = parseRecognizedItems({ items: many });
  assert.equal(items.length, 8);
  assert.equal(items[0].id, FOOD_DB[0].id);
});

test('macros come from our own table, not from the model', () => {
  const recognised: RecognizedItem[] = [
    { id: 'chicken', amount: 200, confidence: 0.9 },
    { id: 'rice', amount: 100, confidence: 0.9 },
  ];
  const scan = mealScanFromItems(recognised);
  const chicken = FOOD_DB.find((f) => f.id === 'chicken')!;
  const rice = FOOD_DB.find((f) => f.id === 'rice')!;
  assert.equal(scan.calories, Math.round(chicken.kcal * 2 + rice.kcal));
  assert.equal(scan.protein, Math.round(chicken.protein * 2 + rice.protein));
  assert.deepEqual(scan.items, ['chicken', 'rice']);
  assert.equal(scan.empty, false);
});

test('unit-based foods scale by count, weight foods by grams', () => {
  const scan = mealScanFromItems([
    { id: 'egg', amount: 2, confidence: 1 },
    { id: 'milk', amount: 1, confidence: 1 },
  ]);
  const egg = FOOD_DB.find((f) => f.id === 'egg')!;
  const milk = FOOD_DB.find((f) => f.id === 'milk')!;
  assert.equal(scan.calories, Math.round(egg.kcal * 2 + milk.kcal));
  assert.ok(scan.matched[0].includes('2 ×'), scan.matched.join(' | '));
});

test('an empty recognition is empty, with a usable fallback name', () => {
  const scan = mealScanFromItems([], { name: '  ' });
  assert.equal(scan.empty, true);
  assert.equal(scan.calories, 0);
  assert.equal(scan.name, 'Photo meal');

  const named = mealScanFromItems([], { name: 'Lunch at the office' });
  assert.equal(named.name, 'Lunch at the office');
  assert.equal(named.empty, true);
});

test('the photo result is labelled in the athlete’s language', () => {
  const scan = mealScanFromItems([{ id: 'chicken', amount: 150, confidence: 1 }], { locale: 'fr' });
  assert.ok(scan.matched[0].startsWith('poulet'), scan.matched[0]);
  const named = mealScanFromItems([{ id: 'egg', amount: 2, confidence: 1 }], { locale: 'fr' });
  assert.equal(named.name, 'œuf', 'the meal gets a French fallback name');
});

test('loose JSON survives fences, prose and truncation', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Sure! {"a":1} hope that helps'), { a: 1 });
  assert.equal(parseJsonLoose('no json here'), null);
  assert.equal(parseJsonLoose('{"a":'), null);
});

test('the photo ceiling is declared and sane for a phone camera', () => {
  // ~1.1 MB of base64 payload: a downscaled phone photo, not a RAW file.
  assert.ok(MEAL_PHOTO_MAX_BYTES >= 300_000 && MEAL_PHOTO_MAX_BYTES <= 4_000_000);
  assert.ok(dataUrl.startsWith('data:image/'));
});
