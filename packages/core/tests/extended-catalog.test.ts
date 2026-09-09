import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyExtendedCatalog,
  extendedCatalogStatus,
  extendedExerciseCount,
  loadExtendedCatalog,
  type GifDbItem,
} from '../src/extended-catalog.ts';
import { matchExercise, measureForExerciseName } from '../src/exercises.ts';

/**
 * The runtime loader backs the "full 1,323-exercise catalog" feature. These
 * tests pin its lifecycle: status transitions for the library's sync
 * indicator, shared in-flight requests, retryability after a failure, and
 * the session cache. Runs in its own process (node --test) so module state
 * starts pristine.
 */

const deadBug = {
  id: 'abs/dead-bug',
  slug: 'dead-bug',
  name: 'Dead Bug',
  muscle: 'abs',
  equipment: 'bodyweight',
  category: 'strength',
};

test('loader lifecycle: http error → retry → ready → cached', async () => {
  const realFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response('nope', { status: 404 });
      return new Response(JSON.stringify({ count: 1, items: [deadBug] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    // 1. A failing response rejects, flags the error status, applies nothing.
    assert.equal(extendedCatalogStatus(), 'idle');
    await assert.rejects(loadExtendedCatalog(), /responded 404/);
    assert.equal(extendedCatalogStatus(), 'error');
    assert.equal(extendedExerciseCount(), 0);
    assert.equal(matchExercise('Dead Bug'), null, 'nothing applied from a failed load');

    // 2. Retry: the pending request is shared and lands as ready.
    const first = loadExtendedCatalog();
    const second = loadExtendedCatalog();
    assert.equal(first, second, 'concurrent loads share one request');
    assert.equal(extendedCatalogStatus(), 'loading');
    const added = await first;
    assert.equal(calls, 2);
    assert.equal(extendedCatalogStatus(), 'ready');
    assert.equal(added.length, 1);
    assert.equal(matchExercise('Dead Bug')?.id, 'abs/dead-bug');

    // 3. A successful load is cached for the session — no third fetch.
    const cached = await loadExtendedCatalog();
    assert.equal(cached.length, 1);
    assert.equal(calls, 2, 'the session cache avoids refetching');
    assert.equal(extendedCatalogStatus(), 'ready');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('applyExtendedCatalog skips malformed items', () => {
  const added = applyExtendedCatalog([
    deadBug,
    { slug: 'no-muscle', name: 'No Muscle', muscle: '' },
    { slug: '', name: 'No Slug', muscle: 'abs' },
    { muscle: 'abs', slug: 'no-name' } as GifDbItem, // name missing at runtime
  ]);
  assert.equal(added.length, 1);
  assert.equal(added[0]?.id, 'abs/dead-bug');
  assert.ok(matchExercise('Dead Bug'));
});

test('runtime cardio entries log distance, strength entries log load', () => {
  const added = applyExtendedCatalog([
    {
      id: 'cardio/treadmill-running',
      slug: 'treadmill-running',
      name: 'Treadmill Running',
      muscle: 'cardio',
      equipment: 'treadmill',
      category: 'cardio',
    },
    {
      id: 'cardio/stationary-bike-ride',
      slug: 'stationary-bike-ride',
      name: 'Stationary Bike Ride',
      muscle: 'quads',
      equipment: 'stationary bike',
      category: 'cardio',
    },
    deadBug,
  ]);
  assert.equal(added.length, 3);
  const run = added.find((e) => e.name === 'Treadmill Running');
  assert.equal(run?.measure, 'distance');
  assert.equal(run?.equipment, 'running');
  const bike = added.find((e) => e.name === 'Stationary Bike Ride');
  assert.equal(bike?.measure, 'distance');
  const bug = added.find((e) => e.name === 'Dead Bug');
  assert.equal(bug?.measure, undefined);
  assert.equal(measureForExerciseName('Treadmill Running'), 'distance');
});
