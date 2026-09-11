import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byDateDesc, isMissingIndexError, olderThan } from '../src/lib/firebase/repo.ts';

/**
 * When the composite indexes were never deployed, the ordered history queries
 * throw `failed-precondition` — while onboarding writes (which need no index)
 * succeed. Without a fallback the user lands back on onboarding with empty
 * data on every login. These tests pin the pure pieces of that fallback:
 * recognising the missing-index error and windowing history in memory exactly
 * like the server-side (date desc, createdAt desc) window would.
 */

test('isMissingIndexError recognises only the missing-index failure', () => {
  assert.equal(
    isMissingIndexError({
      code: 'failed-precondition',
      message:
        'The query requires an index. You can create it here: https://console.firebase.google.com/…',
    }),
    true,
  );
  // Other failures must keep propagating — never silently downgrade reads.
  assert.equal(isMissingIndexError({ code: 'permission-denied', message: 'nope' }), false);
  assert.equal(isMissingIndexError({ code: 'unavailable', message: 'offline' }), false);
  assert.equal(
    isMissingIndexError({ code: 'failed-precondition', message: 'transaction expired' }),
    false,
  );
  assert.equal(isMissingIndexError(null), false);
  assert.equal(isMissingIndexError(undefined), false);
  assert.equal(isMissingIndexError({}), false);
});

test('byDateDesc matches the server ordering (date desc, createdAt desc)', () => {
  const rows = [
    { date: '2026-09-10', createdAt: 100 },
    { date: '2026-09-11', createdAt: 50 },
    { date: '2026-09-10', createdAt: 300 },
    { date: '2026-09-09', createdAt: 999 },
  ];
  assert.deepEqual(
    [...rows].sort(byDateDesc).map((r) => r.createdAt),
    [50, 300, 100, 999],
  );
});

test('olderThan pages like startAfter(date, createdAt)', () => {
  const rows = [
    { date: '2026-09-11', createdAt: 50 },
    { date: '2026-09-10', createdAt: 300 },
    { date: '2026-09-10', createdAt: 100 },
    { date: '2026-09-09', createdAt: 999 },
  ];
  // Mid-list cursor: same-date older siblings plus everything older.
  assert.deepEqual(
    olderThan(rows, { date: '2026-09-10', createdAt: 300 }).map((r) => r.createdAt),
    [100, 999],
  );
  // Cursor on the oldest row: nothing left.
  assert.deepEqual(olderThan(rows, { date: '2026-09-09', createdAt: 999 }), []);
  // Cursor past the end: everything, newest-first (input order must not matter).
  assert.deepEqual(
    olderThan([...rows].reverse(), { date: '2026-09-12', createdAt: 0 }).map((r) => r.createdAt),
    [50, 300, 100, 999],
  );
});
