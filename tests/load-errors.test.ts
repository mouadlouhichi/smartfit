import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blockedCollectionNotice,
  describeLoadFailure,
  firestoreErrorCode,
  isPermissionDenied,
  isTransientLoadError,
  isUnauthenticated,
  readOrFallback,
} from '../src/lib/firebase/load-errors.ts';

/**
 * Sign-in hydration reads nine things in parallel. The bug this file exists to
 * prevent: one collection the deployed rules refuse (a new collection whose
 * rules were not deployed yet) rejected the whole batch, and with no cached
 * copy the athlete was locked out of an account whose data was sitting right
 * there — behind a screen blaming their connection.
 */

const denied = () =>
  Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });
const offline = () => Object.assign(new Error('Failed to fetch'), { code: 'unavailable' });
const bareNetwork = () => new TypeError('Failed to fetch');

test('error classification distinguishes a refusal from a bad connection', () => {
  assert.equal(firestoreErrorCode(denied()), 'permission-denied');
  assert.equal(firestoreErrorCode(new Error('nope')), '', 'a plain error has no code');

  assert.equal(isPermissionDenied(denied()), true);
  assert.equal(isPermissionDenied(offline()), false);
  assert.equal(isPermissionDenied(bareNetwork()), false);

  assert.equal(isUnauthenticated(Object.assign(new Error('x'), { code: 'unauthenticated' })), true);

  // Everything that never got a verdict is worth retrying.
  assert.equal(isTransientLoadError(offline()), true);
  assert.equal(isTransientLoadError(bareNetwork()), true, 'a bare fetch failure is transient');
  assert.equal(
    isTransientLoadError(Object.assign(new Error('x'), { code: 'deadline-exceeded' })),
    true,
  );
  // A refusal is not: the same request from the same account gets the same answer.
  assert.equal(isTransientLoadError(denied()), false);
});

test('a collection the rules refuse degrades to empty and is reported', async () => {
  const blocked: string[] = [];
  const rows = await readOrFallback(
    'checkIns',
    () => Promise.reject(denied()),
    [],
    (name) => blocked.push(name),
  );

  assert.deepEqual(rows, [], 'the account loads without that slice');
  assert.deepEqual(blocked, ['checkIns'], 'and the caller is told which slice');
});

test('a network failure still throws so the cached copy is used instead', async () => {
  // This is the safety property, not a detail: rendering a half-read account
  // as "your history is empty" invites someone to re-enter data that is merely
  // unreachable. Offline must reach the caller.
  await assert.rejects(
    () => readOrFallback('sessions', () => Promise.reject(offline()), []),
    /Failed to fetch/,
  );
  await assert.rejects(
    () => readOrFallback('sessions', () => Promise.reject(bareNetwork()), []),
    /Failed to fetch/,
  );
});

test('a successful read passes through untouched', async () => {
  const rows = await readOrFallback('meals', async () => [{ id: 'm1' }], []);
  assert.deepEqual(rows, [{ id: 'm1' }]);
});

test('the failure copy names the real cause instead of the connection', () => {
  const rules = describeLoadFailure(denied());
  assert.match(rules, /rules/i);
  // The exact command, not a vague instruction — this is the whole fix.
  assert.match(rules, /firebase deploy --only firestore:rules/, 'it says what to run');
  assert.doesNotMatch(rules, /connection/i, 'a rules problem is not a Wi-Fi problem');

  assert.match(describeLoadFailure(offline()), /connection/i);
  assert.match(describeLoadFailure(bareNetwork()), /connection/i);

  const index = Object.assign(new Error('The query requires an index'), {
    code: 'failed-precondition',
  });
  assert.match(describeLoadFailure(index), /index/i);

  const expired = Object.assign(new Error('x'), { code: 'unauthenticated' });
  assert.match(describeLoadFailure(expired), /sign in again/i);

  const quota = Object.assign(new Error('x'), { code: 'resource-exhausted' });
  assert.match(describeLoadFailure(quota), /quota/i);
});

test('the blocked notice names the collections and stays quiet when healthy', () => {
  assert.equal(blockedCollectionNotice([]), null);

  const one = blockedCollectionNotice(['checkIns'])!;
  assert.match(one, /checkIns/);
  assert.match(one, /firestore\.rules/);
  assert.match(one, /everything else loaded/i);

  const two = blockedCollectionNotice(['checkIns', 'meals'])!;
  assert.match(two, /checkIns, meals/);
  assert.match(two, /them\b/, 'plural reads naturally');
});

test('only permission-denied degrades — the boundary is exact', async () => {
  // Each of these must reach the catch block in the store, because each has a
  // different honest recovery: sign in, wait, or retry.
  for (const code of [
    'unavailable',
    'deadline-exceeded',
    'cancelled',
    'aborted',
    'internal',
    'resource-exhausted',
    'unauthenticated',
    '',
  ]) {
    const err = code ? Object.assign(new Error('x'), { code }) : new Error('x');
    await assert.rejects(
      () => readOrFallback('sessions', () => Promise.reject(err), []),
      `code "${code}" must not be silently swallowed`,
    );
  }
});

/**
 * The wiring itself, asserted structurally.
 *
 * `readOrFallback` is only useful if the hydration path actually uses it. A
 * future collection added as a raw `getDocs`/`loadHistoryWindow` would
 * reintroduce the exact lockout this file was written for, and no unit test of
 * the helper would notice — stubbing Firestore's dynamic imports needs a module
 * loader the suite does not have.
 *
 * So: count the call sites that matter. Every raw read must sit inside one of
 * the two wrappers, and the counts must line up.
 */
test('every collection read in loadUserState goes through the safe wrapper', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile('src/lib/firebase/repo.ts', 'utf8');

  const body = source.slice(
    source.indexOf('export async function loadUserState'),
    // Slice to the next top-level export, so the counts below only see the
    // hydration function.
    source.indexOf('export async function loadMoreSessions'),
  );
  const count = (needle: string) => body.split(needle).length - 1;

  // Four small collections, each wrapped once. The profile read above this
  // block is deliberately raw: identity must fail loudly, not degrade.
  assert.equal(count('getDocs(collection(db, colPath(uid, '), 4, 'raw collection reads');
  assert.equal(count('readAll<'), 4, 'each one is wrapped in readAll');

  // Four history windows, all through readWindow (which wraps readOrFallback).
  assert.equal(count('loadHistoryWindow(uid,'), 1, 'only readWindow calls it directly');
  assert.equal(count('readWindow('), 4, 'four history windows read through it');
  assert.equal(count('readOrFallback('), 2, 'both helpers route through it');
});
