import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GOAL_METRIC_KEYS,
  GOAL_METRIC_META,
  MESSAGES,
  PLANS,
  PLAN_KEYS,
  SEEDED_GOAL_NAMES,
  createTranslator,
  goalDisplayName,
  goalMetricLabel,
  goalMetricUnit,
  seededGoalName,
  planDescription,
  planName,
} from '../src/index.ts';

/**
 * The training vocabulary — plan names, plan descriptions and goal metrics.
 *
 * It is the same arrangement as the measurement types: the English copy lives
 * in the data (`PLANS`, `GOAL_METRIC_META`) because the mobile client and the
 * stored profile read it directly, and the web UI goes through these helpers
 * so the words translate without a second English copy living in a component.
 *
 * The point of the tests is the *pair*: a key per id, and the English entry
 * still saying what the data says. Two lists that drift are how a French user
 * ends up reading a translated plan name with an English description.
 */

const LOCALES = ['en', 'fr'] as const;

test('every training plan has copy keyed in both locales', () => {
  for (const plan of PLANS) {
    const keys = PLAN_KEYS[plan.id];
    assert.ok(keys, `${plan.id} has no catalogue keys`);
    for (const key of [keys.name, keys.description]) {
      for (const locale of LOCALES) {
        const message = MESSAGES[locale][key];
        assert.equal(typeof message, 'string', `${key} is missing from ${locale}`);
        assert.ok((message as string).trim().length > 0, `${key} is empty in ${locale}`);
      }
    }
  }
});

test('the English plan copy still says what the data says', () => {
  for (const plan of PLANS) {
    assert.equal(MESSAGES.en[PLAN_KEYS[plan.id].name], plan.name);
    assert.equal(MESSAGES.en[PLAN_KEYS[plan.id].description], plan.description);
  }
});

test('every goal metric has a name and a unit in both locales', () => {
  for (const metric of Object.keys(GOAL_METRIC_META)) {
    const keys = GOAL_METRIC_KEYS[metric];
    assert.ok(keys, `${metric} has no catalogue keys`);
    for (const key of [keys.label, keys.unit]) {
      for (const locale of LOCALES) {
        const message = MESSAGES[locale][key];
        assert.equal(typeof message, 'string', `${key} is missing from ${locale}`);
        assert.ok((message as string).trim().length > 0, `${key} is empty in ${locale}`);
      }
    }
    // The data is the English source of truth, so the English entry cannot
    // quietly say something else.
    assert.equal(MESSAGES.en[keys.label], GOAL_METRIC_META[metric].label);
    assert.equal(MESSAGES.en[keys.unit], GOAL_METRIC_META[metric].unit);
  }
});

test('the helpers return catalogue copy, never a key', () => {
  const en = createTranslator('en');
  const fr = createTranslator('fr');
  for (const plan of PLANS) {
    assert.equal(planName(plan.id, en), plan.name);
    assert.equal(planDescription(plan.id, en), plan.description);
    for (const value of [planName(plan.id, fr), planDescription(plan.id, fr)]) {
      assert.ok(!value.startsWith('plan.'), `a raw key leaked: ${value}`);
      assert.ok(value.trim().length > 0, `${plan.id} has empty French copy`);
    }
  }
  for (const metric of Object.keys(GOAL_METRIC_META)) {
    assert.equal(goalMetricLabel(metric, en), GOAL_METRIC_META[metric].label);
    assert.equal(goalMetricUnit(metric, en), GOAL_METRIC_META[metric].unit);
    assert.ok(!goalMetricLabel(metric, fr).startsWith('goal.'));
  }
});

test('without a translator the helpers fall back to the English data', () => {
  // Core callers, the mobile app and the run-detail share card have no
  // translator in scope; they must still get words, not an empty string.
  for (const plan of PLANS) {
    assert.equal(planName(plan.id), plan.name);
    assert.equal(planDescription(plan.id), plan.description);
  }
  assert.equal(goalMetricLabel('minutes'), GOAL_METRIC_META.minutes.label);
  assert.equal(goalMetricUnit('minutes'), GOAL_METRIC_META.minutes.unit);
});

test('the goal onboarding seeds is stored in English and shown translated', () => {
  // Stored data stays canonical: a goal created in French still reads
  // correctly if the athlete switches language later.
  assert.equal(seededGoalName('workouts'), 'Train this week');
  assert.equal(seededGoalName('minutes'), 'Active minutes this week');
  assert.equal(seededGoalName('unknown'), 'Train this week');

  const fr = createTranslator('fr');
  const en = createTranslator('en');
  for (const metric of Object.keys(SEEDED_GOAL_NAMES)) {
    const stored = SEEDED_GOAL_NAMES[metric];
    assert.equal(MESSAGES.en[`goal.seed.${metric}`], stored, 'the English copy is the stored name');
    assert.equal(goalDisplayName(stored, en), stored);
    const translated = goalDisplayName(stored, fr);
    assert.ok(!translated.startsWith('goal.'), `a raw key leaked: ${translated}`);
    assert.notEqual(translated, stored, `${metric} was not translated`);
  }
});

test('a goal created without a name is stored as English and shown translated', () => {
  const fr = createTranslator('fr');
  const en = createTranslator('en');
  for (const metric of Object.keys(GOAL_METRIC_META)) {
    const generated = `${GOAL_METRIC_META[metric].label} goal`;
    assert.equal(goalDisplayName(generated, en), generated);
    const translated = goalDisplayName(generated, fr);
    assert.ok(!translated.startsWith('goal.'), `a raw key leaked: ${translated}`);
    assert.notEqual(translated, generated, `${metric} was not translated`);
  }
});

test("the athlete's own goal names pass through untouched", () => {
  // Half of a goal's value is the personal name; translating it would be worse
  // than leaving it, and there is nothing to translate it from.
  const fr = createTranslator('fr');
  assert.equal(goalDisplayName('Marathon block', fr), 'Marathon block');
  assert.equal(goalDisplayName('Couper le sucre', fr), 'Couper le sucre');
  assert.equal(goalDisplayName('', fr), '');
});

test('an unknown id degrades instead of throwing', () => {
  assert.equal(planName('does-not-exist'), PLANS[0].name);
  assert.equal(planDescription('does-not-exist'), '');
  assert.equal(goalMetricLabel('does-not-exist'), 'does-not-exist');
  assert.equal(goalMetricUnit('does-not-exist'), '');
});
