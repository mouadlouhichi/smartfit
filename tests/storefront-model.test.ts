import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  upcomingStorefrontSlots,
  groupByDay,
  gymContactHref,
  classArtwork,
} from '../src/lib/storefront-model';
import type { GymSlot } from '../src/lib/firebase/tenant-repo';
const slot = (id: string, startsAt: number, over: Partial<GymSlot> = {}): GymSlot => ({
  id,
  classId: 'class',
  startsAt,
  endsAt: startsAt + 3600000,
  capacity: 12,
  booked: 2,
  ...over,
});
test('storefront schedule sorts before limiting and excludes past/cancelled sessions', () => {
  const source = [
    slot('late', 400),
    slot('past', 90),
    slot('soon', 110),
    slot('cancelled', 105, { cancelled: true }),
    slot('middle', 200),
  ];
  assert.deepEqual(
    upcomingStorefrontSlots(source, 100, 2).map((row) => row.id),
    ['soon', 'middle'],
  );
  assert.equal(source[0].id, 'late');
});
test('day groups and sessions are chronological without modifying source data', () => {
  const a = new Date(2026, 8, 22, 10).getTime(),
    b = new Date(2026, 8, 23, 10).getTime();
  const source = [slot('tomorrow', b), slot('afternoon', a + 3600000), slot('morning', a)];
  const groups = groupByDay(source);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups[0].slots.map((row) => row.id),
    ['morning', 'afternoon'],
  );
  assert.equal(source[0].id, 'tomorrow');
});
test('contact links use fixed safe schemes and encode the actual gym details', () => {
  assert.equal(gymContactHref('phone', '+212 522-000000'), 'tel:+212522000000');
  assert.equal(gymContactHref('whatsapp', '+212 600 000 000'), 'https://wa.me/212600000000');
  assert.equal(gymContactHref('email', 'hello@example.com'), 'mailto:hello%40example.com');
  assert.equal(gymContactHref('instagram', '@zone.fight'), 'https://www.instagram.com/zone.fight/');
  for (const kind of ['phone', 'email', 'instagram', 'whatsapp'] as const)
    assert.equal(gymContactHref(kind, 'javascript:alert(1)'), null);
  assert.equal(gymContactHref('email', 'test@example.com?bcc=another@example.com'), null);
});
test('class card artwork stays bundled and has a safe fallback', () => {
  for (const focus of ['mind', 'combat', 'cardio', 'aqua', 'hiit', 'strength', 'unknown'])
    assert.match(classArtwork(focus), /^\/images\//);
});
