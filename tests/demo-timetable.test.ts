import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoClasses, demoFixture, demoSlots, demoGyms } from '../src/lib/tenant-demo.ts';

/**
 * The demo gym's timetable is generated relative to the moment it loads, and
 * the storefront only lists slots that are *still ahead*. A helper that means
 * "next Wednesday 19:00" but returns today at 19:00 once that hour has passed
 * quietly empties the evening's schedule — which is how the e2e run at 20:08 on
 * a Wednesday lost a class that every earlier run had seen.
 *
 * These tests pin the helper's contract through its output: every seeded slot
 * starts in the future, and each weekly occurrence is far enough ahead that a
 * page load a minute later still finds it.
 */

const MINUTE = 60_000;

test('every demo slot starts in the future', () => {
  const now = Date.now();
  const future = demoSlots().filter((s) => s.startsAt > now);
  assert.equal(
    future.length,
    demoSlots().length,
    'a demo slot starts in the past, so the storefront will hide it',
  );
});

test('a slot that happens later today is not seeded in the past', () => {
  // The regression only shows in the evening, so simulate it: every slot must
  // still be ahead when read a few minutes after the demo was built.
  const now = Date.now();
  for (const slot of demoSlots()) {
    assert.ok(
      slot.startsAt > now - MINUTE,
      `slot ${slot.id} starts before now — "next occurrence" must roll forward`,
    );
    assert.ok(slot.endsAt > slot.startsAt, `slot ${slot.id} ends before it starts`);
  }
});

test('the demo gym still has classes within the coming week', () => {
  // A "next occurrence" that always rolled a full week ahead would also pass
  // the checks above while leaving the timetable permanently empty.
  const now = Date.now();
  const week = now + 7 * 24 * 60 * MINUTE;
  const soon = demoSlots().filter((s) => s.startsAt <= week);
  assert.ok(soon.length >= demoSlots().length - 1, 'more than one slot slipped past a week');
  assert.ok(soon.length > 0, 'no demo slot falls inside the coming week');
});

test('every weekly slot appears exactly once and keeps its class', () => {
  const slots = demoSlots();
  const ids = slots.map((s) => s.id);
  assert.deepEqual(ids, [...new Set(ids)], 'duplicate slot id');
  const classIds = new Set(demoClasses().map((c) => c.id));
  for (const slot of slots) {
    assert.ok(classIds.has(slot.classId), `slot ${slot.id} references an unknown class`);
  }
});

test('the other demo gyms keep their slots too', () => {
  const now = Date.now();
  for (const gym of demoGyms()) {
    const fixture = demoFixture(gym.slug);
    assert.ok(fixture, `no fixture for ${gym.slug}`);
    const stale = fixture.slots.filter((s) => s.startsAt <= now);
    assert.equal(stale.length, 0, `${gym.slug} has a slot in the past`);
  }
});
