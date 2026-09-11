import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WriteQueue, type SyncStatus } from '../src/lib/firebase/write-queue.ts';

/**
 * The write queue is the fix for the "fire-and-forget cloud writes" blocker:
 * before it, a failed Firestore write vanished silently while the UI showed
 * the record as saved. These tests pin the behaviour that makes that
 * impossible — ordering, retries, collapsing, and surfacing failures.
 */

/** Collect every status transition the queue reports. */
function track(q: WriteQueue) {
  const statuses: SyncStatus[] = [];
  let last: { status: SyncStatus; pending: number; error: string | null } | null = null;
  const unsub = q.subscribe((status, pending, error) => {
    if (statuses[statuses.length - 1] !== status) statuses.push(status);
    last = { status, pending, error };
  });
  return {
    statuses,
    get current() {
      return last!;
    },
    unsub,
  };
}

/**
 * Resolve once the queue reports a terminal status.
 *
 * `subscribe` replays the current state synchronously, so that first call is
 * skipped — otherwise this would resolve on the queue's initial idle state
 * before any work had been pushed.
 */
function settled(q: WriteQueue): Promise<{ status: SyncStatus; error: string | null }> {
  return new Promise((resolve) => {
    let replay = true;
    const unsub = q.subscribe((status, pending, error) => {
      if (replay) {
        replay = false;
        return;
      }
      if (status === 'error' || (status === 'idle' && pending === 0)) {
        unsub();
        resolve({ status, error });
      }
    });
  });
}

const fail = (code: string) => Object.assign(new Error(code), { code });

test('runs queued operations in order', async () => {
  const q = new WriteQueue();
  const order: number[] = [];

  const done = settled(q);
  for (const n of [1, 2, 3]) {
    q.push({
      key: `op-${n}`,
      run: async () => {
        // Stagger the first op so a naive implementation would reorder.
        await new Promise((r) => setTimeout(r, n === 1 ? 20 : 0));
        order.push(n);
      },
    });
  }
  await done;

  assert.deepEqual(order, [1, 2, 3], 'a later write must not overtake an earlier one');
  assert.equal(q.pending, 0);
});

test('collapses repeated writes to the same key', async () => {
  const q = new WriteQueue();
  const written: string[] = [];

  // Block the head of the queue so the rest pile up behind it.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));

  const done = settled(q);
  q.push({ key: 'blocker', run: () => gate });
  q.push({ key: 'profile', run: async () => void written.push('name-1') });
  q.push({ key: 'profile', run: async () => void written.push('name-2') });
  q.push({ key: 'profile', run: async () => void written.push('name-3') });

  assert.equal(q.pending, 2, 'three profile writes collapse into one');
  release();
  await done;

  assert.deepEqual(written, ['name-3'], 'only the newest value is written');
});

test('keeps the newest same-key write queued while an older one is in flight', async () => {
  const q = new WriteQueue();
  const written: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));

  const done = settled(q);
  q.push({
    key: 'profile',
    run: async () => {
      await gate;
      written.push('old');
    },
  });
  // This must wait behind the in-flight operation, not replace it.
  q.push({ key: 'profile', run: async () => void written.push('new') });

  assert.equal(q.pending, 2);
  release();
  await done;
  assert.deepEqual(written, ['old', 'new']);
});

test('retries a transient failure and then succeeds', async () => {
  const q = new WriteQueue();
  let attempts = 0;

  const done = settled(q);
  q.push({
    key: 'flaky',
    run: async () => {
      attempts++;
      if (attempts < 3) throw fail('unavailable');
    },
  });
  const result = await done;

  assert.equal(attempts, 3, 'backs off and tries again');
  assert.equal(result.status, 'idle');
});

test('gives up immediately on a permission error and reports it', async () => {
  const q = new WriteQueue();
  let attempts = 0;

  const done = settled(q);
  q.push({
    key: 'denied',
    run: async () => {
      attempts++;
      throw fail('permission-denied');
    },
  });
  const result = await done;

  assert.equal(attempts, 1, 'a rules failure is not worth retrying');
  assert.equal(result.status, 'error');
  assert.match(result.error ?? '', /isn't allowed/i);
  assert.equal(q.pending, 1, 'the failed op stays queued so it is not lost');
});

test('a failed op stays at the head and retry() resumes from it', async () => {
  const q = new WriteQueue();
  const written: string[] = [];
  let allowed = false;

  const firstRun = settled(q);
  q.push({
    key: 'first',
    run: async () => {
      if (!allowed) throw fail('permission-denied');
      written.push('first');
    },
  });
  q.push({ key: 'second', run: async () => void written.push('second') });

  const failure = await firstRun;
  assert.equal(failure.status, 'error');
  assert.deepEqual(written, [], 'nothing ran past the failure');
  assert.equal(q.pending, 2);

  allowed = true;
  const resumed = settled(q);
  q.retry();
  await resumed;

  assert.deepEqual(written, ['first', 'second'], 'order survives the failure');
  assert.equal(q.pending, 0);
});

test('reports saving while work is in flight and idle when drained', async () => {
  const q = new WriteQueue();
  const t = track(q);

  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));

  const done = settled(q);
  q.push({ key: 'slow', run: () => gate });
  assert.equal(t.current.status, 'saving');

  release();
  await done;

  assert.deepEqual(t.statuses, ['idle', 'saving', 'idle']);
  t.unsub();
});

test('flushStrict rejects a parked error so onboarding can stay put', async () => {
  const q = new WriteQueue();
  q.push({
    key: 'finish',
    run: async () => {
      throw fail('permission-denied');
    },
  });
  await assert.rejects(q.flushStrict(), /isn't allowed/i);
  assert.equal(q.pending, 1);
});

test('clear() drops pending work — used on sign-out', async () => {
  const q = new WriteQueue();
  const written: string[] = [];

  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));

  q.push({ key: 'blocker', run: () => gate });
  q.push({ key: 'leak', run: async () => void written.push('should-not-run') });

  q.clear();
  assert.equal(q.pending, 0);

  release();
  await new Promise((r) => setTimeout(r, 10));

  assert.deepEqual(written, [], "a signed-out session's writes never land");
});

test('flush() waits for in-flight writes, and parks (not hangs) on error', async () => {
  const q = new WriteQueue();

  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  q.push({ key: 'a', run: () => gate });

  let flushed = false;
  const pending = q.flush().then(() => void (flushed = true));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(flushed, false, 'flush must not resolve while a write is in flight');

  release();
  await pending;
  assert.equal(flushed, true);
  assert.equal(q.pending, 0);

  // A navigation that awaits flush() must never hang on a rules failure.
  const denied = new WriteQueue();
  denied.push({
    key: 'denied',
    run: async () => {
      throw Object.assign(new Error('nope'), { code: 'permission-denied' });
    },
  });
  await denied.flush();
  assert.equal(denied.pending, 1, 'the parked op stays queued for a manual retry');
});
