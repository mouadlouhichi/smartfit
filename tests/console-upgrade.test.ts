import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvEscape, toCsv, toCsvHref } from '../src/lib/csv';
import {
  collectAttention,
  countOpenDays,
  invoicesByMethod,
  monthBuckets,
  relativeTime,
} from '../src/lib/admin-model';
import { demoAdminData } from '../src/lib/admin-demo';
import { profileFromGym, safeImageUrl, validateGymProfile } from '../src/lib/gym-profile';
import type { GymTenant } from '@smartfit/core';

const NOW = new Date(2026, 8, 21, 12).getTime();

test('CSV preserves commas, quotes, line breaks and Unicode names', () => {
  assert.equal(csvEscape('Riad, "Yoga"\nMarrakech'), '"Riad, ""Yoga""\nMarrakech"');
  assert.equal(csvEscape(null), '""');
  assert.equal(csvEscape(0), '"0"');
  assert.equal(
    toCsv(
      [{ name: 'أمينة', count: 2 }],
      [
        { header: 'Name', value: (r) => r.name },
        { header: 'Count', value: (r) => r.count },
      ],
    ),
    '"Name","Count"\r\n"أمينة","2"',
  );
  assert.ok(decodeURIComponent(toCsvHref('name')).endsWith('\ufeffname'));
});

test('CSV neutralizes formula-like strings, including whitespace prefixes, but keeps numeric values numeric', () => {
  for (const value of [
    '=SUM(1,2)',
    '+212522123456',
    '@SUM(A1)',
    '-2+3',
    '\t=cmd()',
    '\r\n  =HYPERLINK("bad")',
  ])
    assert.ok(csvEscape(value).startsWith('"\''));
  assert.equal(csvEscape(-25), '"-25"');
  assert.equal(csvEscape('ordinary value'), '"ordinary value"');
});

test('month buckets fill zero months and do not smear older payments into the window', () => {
  const result = monthBuckets(
    [
      { at: new Date(2026, 5, 1).getTime(), value: 999 },
      { at: new Date(2026, 6, 1).getTime(), value: 100 },
      { at: NOW, value: 300 },
    ],
    3,
    (i) => i.at,
    (i) => i.value,
    NOW,
  );
  assert.deepEqual(
    result.map((b) => b.key),
    ['2026-07', '2026-08', '2026-09'],
  );
  assert.deepEqual(
    result.map((b) => b.total),
    [100, 0, 300],
  );
  assert.deepEqual(
    result.map((b) => b.count),
    [1, 0, 1],
  );
});

test('month buckets cross a year boundary and ignore invalid or future timestamps', () => {
  const jan = new Date(2026, 0, 10).getTime();
  const result = monthBuckets(
    [
      { at: NaN },
      { at: new Date(2026, 0, 30).getTime() },
      { at: new Date(2025, 11, 31).getTime() },
    ],
    3,
    (i) => i.at,
    () => 1,
    jan,
  );
  assert.deepEqual(
    result.map((b) => b.key),
    ['2025-11', '2025-12', '2026-01'],
  );
  assert.deepEqual(
    result.map((b) => b.total),
    [0, 1, 0],
  );
});

test('attention queue puts overdue money and pending applications ahead of trial followups', () => {
  const demo = demoAdminData();
  const gyms = [
    { ...demo.gyms[0], contract: 'overdue' as const },
    { ...demo.gyms[1], status: 'trial' as const, createdAt: NOW - 15 * 86400000 },
  ];
  const rows = collectAttention(gyms, demo.applications, NOW);
  assert.equal(rows[0].severity, 'high');
  assert.ok(rows.some((r) => r.reason.includes('15d old')));
  assert.ok(rows.some((r) => r.href === '/admin/applications'));
  assert.deepEqual(collectAttention([], [], NOW), []);
});

test('payment mix conserves count and amount of input invoices', () => {
  const { invoices } = demoAdminData();
  const result = invoicesByMethod(invoices);
  assert.equal(
    result.reduce((s, r) => s + r.count, 0),
    invoices.length,
  );
  assert.equal(
    result.reduce((s, r) => s + r.totalMinor, 0),
    invoices.reduce((s, r) => s + r.amountMinor, 0),
  );
  assert.deepEqual(invoicesByMethod([]), []);
});

test('relative time and opening day summaries handle empty data', () => {
  assert.equal(relativeTime(NOW, NOW), 'just now');
  assert.equal(relativeTime(NOW - 3 * 86400000, NOW), '3d ago');
  assert.equal(countOpenDays(undefined), 0);
  assert.equal(countOpenDays({ 0: null, 1: { open: '09:00', close: '18:00' } }), 1);
});

const GYM: GymTenant = {
  id: 'test-gym',
  slug: 'test-gym',
  subdomain: 'test-gym',
  name: 'Test Gym',
  status: 'trial',
  tenantPlanId: 'growth',
  ownerUid: 'owner',
  createdAt: NOW,
  branding: { accentColor: '#8ad200' },
  location: { lat: 33, lng: -7 },
  hours: { 1: { open: '07:00', close: '23:00' } },
};

test('profile draft excludes protected tenant fields and retains location coordinates', () => {
  const profile = profileFromGym(GYM);
  assert.deepEqual(Object.keys(profile).sort(), [
    'branding',
    'contact',
    'hours',
    'location',
    'name',
  ]);
  assert.equal(profile.location?.lat, 33);
  assert.equal(profile.hours?.[0], null);
  assert.deepEqual(validateGymProfile(profile), []);
  profile.hours![1]!.open = '08:00';
  assert.equal(GYM.hours?.[1]?.open, '07:00');
});

test('profile rejects malformed colors, unsafe assets, invalid email and invalid hours', () => {
  const profile = profileFromGym(GYM);
  profile.name = ' ';
  profile.branding = {
    accentColor: 'red',
    logoUrl: 'javascript:alert(1)',
    coverUrl: 'http://images.test/x.jpg',
    tagline: 'x'.repeat(161),
  };
  profile.contact = { email: 'not an email' };
  profile.hours = { 1: { open: '24:00', close: '25:00' }, 2: { open: '23:00', close: '04:00' } };
  assert.equal(validateGymProfile(profile).length, 8);
});

test('safe image URL accepts HTTPS, rejects credentials, scripts and relative schemes', () => {
  assert.equal(safeImageUrl('https://images.test/logo.png'), 'https://images.test/logo.png');
  for (const url of [
    'data:image/svg+xml,bad',
    'javascript:alert(1)',
    '//images.test/pic',
    'https://user:pass@images.test/pic',
    'http://images.test/pic',
    '',
  ])
    assert.equal(safeImageUrl(url), undefined);
});
