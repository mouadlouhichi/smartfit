import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStaleDeploymentError } from '../src/lib/stale-deployment';

/**
 * The stale-deployment detector: a tab left open across a redeploy asks for
 * chunk hashes the new deployment no longer has, and the boundaries use this
 * to self-heal with one fresh load instead of a dead screen. The matcher must
 * catch the real shapes of that error and nothing else — an ordinary crash
 * must keep its honest error screen.
 */

const realWorld = new Error(
  'Loading chunk 3170 failed.\n(error: https://example.vercel.app/_next/static/chunks/3170-ef38a1a4f68fd9ee.js)',
);

test('recognises the real ChunkLoadError message (webpack)', () => {
  assert.equal(isStaleDeploymentError(realWorld), true);
});

test('recognises the ChunkLoadError name and CSS chunks', () => {
  const named = new Error('boom');
  named.name = 'ChunkLoadError';
  assert.equal(isStaleDeploymentError(named), true);
  assert.equal(isStaleDeploymentError(new Error('Loading CSS chunk 12 failed')), true);
});

test('ordinary errors are NOT stale-deployment errors', () => {
  assert.equal(isStaleDeploymentError(new Error('Loading of data failed')), false);
  assert.equal(isStaleDeploymentError(new TypeError('Cannot read properties of undefined')), false);
  assert.equal(isStaleDeploymentError(new Error('Loading chunk failed')), false); // no chunk number
  assert.equal(isStaleDeploymentError('Loading chunk 3 failed'), false); // not an Error
  assert.equal(isStaleDeploymentError(null), false);
});
