import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_COACH_REPLIES_PER_DAY,
  PRO_FEATURES,
  PRO_PLANS,
  emptyState,
  isPro,
  parseStateJSON,
} from '../src/index.ts';

test('free tier by default', () => {
  assert.equal(isPro(emptyState()), false);
});

test('isPro requires a well-formed stamp', () => {
  const state = emptyState();
  assert.equal(
    isPro({ ...state, profile: { ...state.profile, pro: { plan: 'yearly', since: 1 } } }),
    true,
  );
  assert.equal(
    isPro({ ...state, profile: { ...state.profile, pro: { plan: 'lifetime', since: 1 } } }),
    true,
  );
  assert.equal(
    isPro({ ...state, profile: { ...state.profile, pro: { plan: 'weekly', since: 1 } as never } }),
    false,
  );
  assert.equal(
    isPro({ ...state, profile: { ...state.profile, pro: { plan: 'monthly', since: 0 } } }),
    false,
  );
});

test('pro stamp survives parsing; junk is dropped', () => {
  const ok = parseStateJSON(
    JSON.stringify({ profile: { pro: { plan: 'monthly', since: 1717171717 } } }),
  );
  assert.ok(ok, 'valid state parses');
  assert.deepEqual(ok.profile.pro, { plan: 'monthly', since: 1717171717 });

  const lifetime = parseStateJSON(
    JSON.stringify({ profile: { pro: { plan: 'lifetime', since: 1717171717 } } }),
  );
  assert.ok(lifetime, 'state still parses');
  assert.deepEqual(lifetime.profile.pro, { plan: 'lifetime', since: 1717171717 });

  const junk = parseStateJSON(JSON.stringify({ profile: { pro: { plan: 'weekly', since: 5 } } }));
  assert.ok(junk, 'state still parses');
  assert.equal('pro' in junk.profile, false);

  const none = parseStateJSON(JSON.stringify({ profile: {} }));
  assert.ok(none, 'state still parses');
  assert.equal('pro' in none.profile, false);
});

test('catalog is sellable: three plans, priced, with promises', () => {
  assert.equal(PRO_PLANS.length, 3);
  for (const p of PRO_PLANS) {
    assert.match(p.price, /^\$\d/);
    assert.ok(p.name.length > 0);
  }
  assert.ok(PRO_FEATURES.length >= 4);
  assert.equal(FREE_COACH_REPLIES_PER_DAY, 6);
});
