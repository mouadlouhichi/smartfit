/**
 * Tenancy primitives: slugs, host resolution, plan limits and roster helpers.
 *
 * Host resolution is the piece that decides whether a request lands on a
 * tenant, so it is tested against the awkward inputs a real `Host` header
 * produces — ports, trailing dots, mixed case, a loose apex that would make
 * the preview base host look like a gym.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AT_RISK_DAYS,
  DEFAULT_TENANT_PLANS,
  GYM_STATUSES,
  LIVE_GYM_STATUSES,
  OCCUPYING_BOOKING_STATUSES,
  RESERVED_SUBDOMAINS,
  SLUG_MAX_LENGTH,
  buildTenantUrl,
  checkLimit,
  daysUntilExpiry,
  expiringSoon,
  findTenantPlan,
  isAtRisk,
  isGymLive,
  isReservedSlug,
  isTenantPath,
  isValidSlug,
  normalizeHost,
  resolveTenantHost,
  seatsLeft,
  seatsTaken,
  slugFromTenantPath,
  slugify,
  suggestSlug,
  tenantPath,
  type BookingStatus,
  type GymMembership,
} from '../src/index.ts';

const DAY = 86_400_000;

// ── slugify ──────────────────────────────────────────────────────────────────

test('slugify produces subdomain-safe labels from ordinary names', () => {
  assert.equal(slugify('Zone Fight'), 'zone-fight');
  assert.equal(slugify('  Power   House  '), 'power-house');
  assert.equal(slugify('Gym42'), 'gym42');
  assert.equal(slugify('a'), 'a');
});

test('slugify strips diacritics rather than mangling them', () => {
  // French gym names are the realistic input for this market.
  assert.equal(slugify('Salle de Sport Marrakech'), 'salle-de-sport-marrakech');
  assert.equal(slugify('Énergie Fitness'), 'energie-fitness');
  assert.equal(slugify('Ça Va Gym'), 'ca-va-gym');
  assert.equal(slugify('Ô Forme'), 'o-forme');
});

test('slugify maps unusable characters to separators instead of keeping them', () => {
  // Arabic input cannot survive as an ASCII label; the honest outcome is an
  // empty slug the caller must handle, not a broken half-transliteration.
  assert.equal(slugify('نادي الرياضة'), '');
  assert.equal(slugify('💪 Gym'), 'gym');
  assert.equal(slugify('Gym 🏋️ Club'), 'gym-club');
  assert.equal(slugify('___'), '');
  assert.equal(slugify(''), '');
});

test('slugify enforces the length cap and never ends on a hyphen', () => {
  const long = slugify('a'.repeat(200));
  assert.equal(long.length, SLUG_MAX_LENGTH);
  // Truncation must not leave a dangling separator.
  const longWithSpaces = slugify(`${'word '.repeat(40)}`);
  assert.ok(!longWithSpaces.endsWith('-'), `trailing hyphen in ${longWithSpaces}`);
  assert.ok(longWithSpaces.length <= SLUG_MAX_LENGTH);
});

// ── isValidSlug / reserved ───────────────────────────────────────────────────

test('isValidSlug accepts real tenant labels', () => {
  for (const slug of ['acme', 'zone-fight', 'gym42', 'a1', 'ab']) {
    assert.equal(isValidSlug(slug), true, `${slug} should be valid`);
  }
});

test('isValidSlug rejects malformed labels', () => {
  for (const slug of ['', 'a', '-acme', 'acme-', 'Acme', 'ac me', 'acme_1', 'acme.gym']) {
    assert.equal(isValidSlug(slug), false, `${slug} should be invalid`);
  }
  assert.equal(isValidSlug('a'.repeat(SLUG_MAX_LENGTH + 1)), false);
  assert.equal(isValidSlug('a'.repeat(SLUG_MAX_LENGTH)), true);
  assert.equal(isValidSlug(42 as unknown as string), false);
});

test('reserved words can never be a tenant', () => {
  for (const word of ['www', 'api', 'admin', 'app', 'login', 'g', 'dashboard', 'console']) {
    assert.ok(RESERVED_SUBDOMAINS.includes(word), `${word} should be reserved`);
    assert.equal(isValidSlug(word), false, `${word} must not be a usable slug`);
    assert.equal(isReservedSlug(word), true);
  }
});

test('punycode labels are rejected to avoid homograph tenants', () => {
  assert.equal(isReservedSlug('xn--80ak6aa92e'), true);
  assert.equal(isValidSlug('xn--80ak6aa92e'), false);
});

// ── suggestSlug ──────────────────────────────────────────────────────────────

test('suggestSlug returns the name itself when it is free', () => {
  const r = suggestSlug('Zone Fight', () => false);
  assert.deepEqual(r, { slug: 'zone-fight', disambiguated: false });
});

test('suggestSlug appends a numeric suffix when the name is taken', () => {
  const taken = new Set(['zone-fight']);
  const r = suggestSlug('Zone Fight', (c) => taken.has(c));
  assert.deepEqual(r, { slug: 'zone-fight-2', disambiguated: true });

  taken.add('zone-fight-2');
  assert.equal(suggestSlug('Zone Fight', (c) => taken.has(c)).slug, 'zone-fight-3');
});

test('suggestSlug never returns a reserved slug', () => {
  // "Admin Fitness" slugs to a label starting with a reserved word; the bare
  // reserved word itself must never come back.
  const r = suggestSlug('Admin', () => false);
  assert.equal(isReservedSlug(r.slug), false);
  assert.equal(isValidSlug(r.slug), true);
});

test('suggestSlug handles a name that slugs to nothing', () => {
  const r = suggestSlug('نادي', () => false);
  assert.equal(r.slug, 'gym');
  assert.equal(r.disambiguated, false);
});

test('suggestSlug is deterministic for the same inputs', () => {
  const taken = (c: string) => c === 'acme' || c === 'acme-2';
  assert.equal(suggestSlug('Acme', taken).slug, suggestSlug('Acme', taken).slug);
});

// ── normalizeHost ────────────────────────────────────────────────────────────

test('normalizeHost lowercases and strips ports and trailing dots', () => {
  assert.equal(normalizeHost('ACME.SmartFit.App'), 'acme.smartfit.app');
  assert.equal(normalizeHost('acme.smartfit.app:3000'), 'acme.smartfit.app');
  assert.equal(normalizeHost('acme.smartfit.app.'), 'acme.smartfit.app');
  assert.equal(normalizeHost('  acme.smartfit.app:443  '), 'acme.smartfit.app');
  assert.equal(normalizeHost(''), '');
});

// ── resolveTenantHost ────────────────────────────────────────────────────────

const APEX = { apexDomains: ['smartfit.app'] };

test('resolveTenantHost extracts the tenant from a real subdomain', () => {
  assert.equal(resolveTenantHost('acme.smartfit.app', APEX), 'acme');
  assert.equal(resolveTenantHost('zone-fight.smartfit.app', APEX), 'zone-fight');
  assert.equal(resolveTenantHost('ACME.SmartFit.App:443', APEX), 'acme');
  assert.equal(resolveTenantHost('acme.smartfit.app.', APEX), 'acme');
});

test('resolveTenantHost returns null for the apex and www', () => {
  assert.equal(resolveTenantHost('smartfit.app', APEX), null);
  assert.equal(resolveTenantHost('www.smartfit.app', APEX), null);
  assert.equal(resolveTenantHost('www.smartfit.app:3000', APEX), null);
});

test('resolveTenantHost refuses reserved labels', () => {
  for (const label of ['admin', 'api', 'www', 'login', 'g']) {
    assert.equal(
      resolveTenantHost(`${label}.smartfit.app`, APEX),
      null,
      `${label} must not resolve to a tenant`,
    );
  }
});

test('resolveTenantHost refuses hosts under no configured apex', () => {
  assert.equal(resolveTenantHost('acme.evil.com', APEX), null);
  assert.equal(resolveTenantHost('acme.smartfit.app.evil.com', APEX), null);
  assert.equal(resolveTenantHost('notacme.com', APEX), null);
});

test('resolveTenantHost refuses empty and absent hosts', () => {
  for (const host of [null, undefined, '', '   ']) {
    assert.equal(resolveTenantHost(host, APEX), null);
  }
  assert.equal(resolveTenantHost('acme.smartfit.app', {}), null);
});

test('resolveTenantHost never resolves PaaS deployment hosts, whatever the apex', () => {
  // The trap in the wild: apex misconfigured to `vercel.app`, and a
  // deployment alias whose prefix is a valid slug — the whole site rewrote
  // into a phantom tenant (/admin and /dashboard 404, / said "not open yet").
  const loose = { apexDomains: ['vercel.app'] };
  assert.equal(resolveTenantHost('smartfit-mouadlouhichis-projects.vercel.app', loose), null);
  assert.equal(resolveTenantHost('acme.vercel.app', loose), null);
  const sandbox = { apexDomains: ['e2b.app'] };
  assert.equal(resolveTenantHost('8080-abc123.e2b.app', sandbox), null);
  // Real apexes keep resolving.
  assert.equal(resolveTenantHost('acme.smartfit.app', APEX), 'acme');
});

test('resolveTenantHost honours explicit base hosts', () => {
  const opts = { apexDomains: ['e2b.app'], baseHosts: ['8080-abc123.e2b.app'] };
  // Without baseHosts this prefix is a perfectly valid slug — which is exactly
  // the trap: the preview base host would render a "gym not found" page.
  assert.equal(resolveTenantHost('8080-abc123.e2b.app', opts), null);
  assert.equal(resolveTenantHost('acme.smartfit.app', opts), null);
});

test('resolveTenantHost rejects a loose apex that would swallow the base host', () => {
  // With a loose apex the sandbox host itself has a slug-shaped prefix. (The
  // fixture is a neutral domain: the real PaaS suffixes vercel.app/e2b.app
  // are never tenants at all — see the dedicated test above.)
  assert.equal(isValidSlug('8080-abc123'), true);
  assert.equal(
    resolveTenantHost('8080-abc123.paas-sandbox.test', { apexDomains: ['paas-sandbox.test'] }),
    '8080-abc123',
  );
});

test('resolveTenantHost rejects multi-label prefixes unless explicitly allowed', () => {
  const loose = { apexDomains: ['paas-sandbox.test'] };
  assert.equal(resolveTenantHost('acme.8080-abc123.paas-sandbox.test', loose), null);
  assert.equal(
    resolveTenantHost('acme.8080-abc123.paas-sandbox.test', { ...loose, allowNestedHosts: true }),
    'acme',
  );
  // A reserved leading label is still refused even when nesting is allowed.
  assert.equal(
    resolveTenantHost('admin.8080-abc123.paas-sandbox.test', { ...loose, allowNestedHosts: true }),
    null,
  );
});

test('resolveTenantHost lets the longest apex win', () => {
  const opts = { apexDomains: ['e2b.app', 'preview.smartfit.app'] };
  assert.equal(resolveTenantHost('acme.preview.smartfit.app', opts), 'acme');
});

test('resolveTenantHost accepts extra reserved words', () => {
  assert.equal(resolveTenantHost('beta2.smartfit.app', APEX), 'beta2');
  assert.equal(
    resolveTenantHost('beta2.smartfit.app', { ...APEX, extraReserved: ['beta2'] }),
    null,
  );
});

// ── Tenant URLs and paths ────────────────────────────────────────────────────

test('buildTenantUrl prefers host mode and falls back to the path', () => {
  assert.equal(buildTenantUrl('acme', { apexDomain: 'smartfit.app' }), 'https://acme.smartfit.app');
  assert.equal(
    buildTenantUrl('acme', { baseUrl: 'http://localhost:3000/' }),
    'http://localhost:3000/g/acme',
  );
  assert.equal(buildTenantUrl('acme'), '/g/acme');
});

test('tenantPath builds clean paths without double slashes', () => {
  assert.equal(tenantPath('acme'), '/g/acme');
  assert.equal(tenantPath('acme', ''), '/g/acme');
  assert.equal(tenantPath('acme', '/timetable'), '/g/acme/timetable');
  assert.equal(tenantPath('acme', 'timetable/'), '/g/acme/timetable');
  assert.equal(tenantPath('acme', '//a//b//'), '/g/acme/a/b');
});

test('isTenantPath and slugFromTenantPath round-trip', () => {
  assert.equal(isTenantPath('/g/acme'), true);
  assert.equal(isTenantPath('/g/acme/timetable'), true);
  assert.equal(isTenantPath('/dashboard'), false);
  assert.equal(isTenantPath('/gym/acme'), false);
  assert.equal(isTenantPath(null), false);

  assert.equal(slugFromTenantPath('/g/acme/timetable'), 'acme');
  assert.equal(slugFromTenantPath('/g/acme'), 'acme');
  assert.equal(slugFromTenantPath('/dashboard'), null);
  assert.equal(slugFromTenantPath(null), null);
  // A malformed slug in the URL must not become a tenant lookup.
  assert.equal(slugFromTenantPath('/g/admin'), null);
  assert.equal(slugFromTenantPath('/g/-bad'), null);
});

// ── Tenant status ────────────────────────────────────────────────────────────

test('only live statuses serve the public site', () => {
  assert.deepEqual([...LIVE_GYM_STATUSES].sort(), ['active', 'past_due', 'trial']);
  assert.equal(isGymLive('active'), true);
  assert.equal(isGymLive('trial'), true);
  // past_due keeps the gym usable — cutting off members because the owner's
  // card bounced is how a platform loses both sides of the marketplace.
  assert.equal(isGymLive('past_due'), true);
  assert.equal(isGymLive('suspended'), false);
  assert.equal(isGymLive('pending'), false);
  assert.equal(isGymLive('closed'), false);
  assert.equal(isGymLive(null), false);
  assert.ok(GYM_STATUSES.length >= 6);
});

// ── Plan limits ──────────────────────────────────────────────────────────────

test('checkLimit allows room and reports which limit was hit', () => {
  const growth = findTenantPlan(DEFAULT_TENANT_PLANS, 'growth');
  assert.ok(growth);
  assert.deepEqual(checkLimit(growth, 'members', 10), { ok: true });
  assert.deepEqual(checkLimit(growth, 'members', 500), {
    ok: false,
    reason: 'members limit reached (500 on Growth).',
  });
  // Exact boundary is allowed; one past it is not.
  assert.equal(checkLimit(growth, 'members', 499).ok, true);
  assert.equal(checkLimit(growth, 'members', 499, 2).ok, false);
});

test('checkLimit handles boolean feature flags', () => {
  const starter = findTenantPlan(DEFAULT_TENANT_PLANS, 'starter');
  assert.ok(starter);
  assert.equal(checkLimit(starter, 'customBranding', 0).ok, false);
  const growth = findTenantPlan(DEFAULT_TENANT_PLANS, 'growth');
  assert.equal(checkLimit(growth, 'customBranding', 0).ok, true);
});

test('checkLimit refuses everything when there is no plan', () => {
  assert.equal(checkLimit(null, 'members', 0).ok, false);
  assert.equal(findTenantPlan(DEFAULT_TENANT_PLANS, 'nope'), null);
});

test('the shipped tier ladder increases monotonically', () => {
  for (let i = 1; i < DEFAULT_TENANT_PLANS.length; i++) {
    const prev = DEFAULT_TENANT_PLANS[i - 1];
    const next = DEFAULT_TENANT_PLANS[i];
    assert.ok(next.limits.members > prev.limits.members, `${next.id} members`);
    assert.ok(
      next.monthlyPriceMinor > prev.monthlyPriceMinor,
      `${next.id} price should exceed ${prev.id}`,
    );
  }
  for (const plan of DEFAULT_TENANT_PLANS) {
    assert.ok(plan.monthlyPriceMinor > 0);
    assert.ok(plan.currency.length === 3);
    assert.ok(plan.limits.staffSeats >= 1);
    assert.ok(plan.limits.locations >= 1);
  }
});

// ── Roster helpers ───────────────────────────────────────────────────────────

const member = (over: Partial<GymMembership> = {}): GymMembership => ({
  uid: 'u1',
  role: 'member',
  status: 'active',
  joinedAt: Date.now() - 90 * DAY,
  checkins: 12,
  ...over,
});

test('isAtRisk flags only active members with a stale last visit', () => {
  const now = Date.now();
  assert.equal(isAtRisk(member({ lastVisitAt: now - 30 * DAY }), now), true);
  assert.equal(isAtRisk(member({ lastVisitAt: now - 2 * DAY }), now), false);
  assert.equal(isAtRisk(member({ lastVisitAt: now - AT_RISK_DAYS * DAY + 1 }), now), false);
});

test('isAtRisk abstains when there is no attendance signal', () => {
  const now = Date.now();
  // Never visited = new member, not at risk. Nagging on day one loses them.
  assert.equal(isAtRisk(member({ lastVisitAt: undefined }), now), false);
  // Frozen members opted out; expired ones are a different worklist.
  assert.equal(isAtRisk(member({ status: 'frozen', lastVisitAt: now - 90 * DAY }), now), false);
  assert.equal(isAtRisk(member({ status: 'expired', lastVisitAt: now - 90 * DAY }), now), false);
});

test('daysUntilExpiry handles absent, future and lapsed memberships', () => {
  const now = Date.parse('2026-09-20T00:00:00Z');
  assert.equal(daysUntilExpiry(undefined, now), null);
  assert.equal(daysUntilExpiry(now + 3 * DAY, now), 3);
  assert.equal(daysUntilExpiry(now - 2 * DAY, now), -2);
  assert.equal(daysUntilExpiry(now, now), 0);
});

test('expiringSoon returns the renewal worklist, soonest first', () => {
  const now = Date.parse('2026-09-20T00:00:00Z');
  const list: GymMembership[] = [
    member({ uid: 'later', expiresAt: now + 5 * DAY }),
    member({ uid: 'soon', expiresAt: now + 1 * DAY }),
    member({ uid: 'far', expiresAt: now + 60 * DAY }),
    member({ uid: 'gone', expiresAt: now - 5 * DAY, status: 'expired' }),
    member({ uid: 'none' }),
  ];
  const result = expiringSoon(list, now, 7).map((m) => m.uid);
  assert.deepEqual(result, ['soon', 'later']);
});

// ── Capacity ─────────────────────────────────────────────────────────────────

test('only seat-occupying bookings count against capacity', () => {
  const statuses: BookingStatus[] = ['booked', 'attended', 'waitlist', 'cancelled', 'no_show'];
  assert.deepEqual([...OCCUPYING_BOOKING_STATUSES].sort(), ['attended', 'booked']);
  // A no-show still took the seat for that occurrence, but it is recorded
  // after the fact; the live count is what fills the class.
  assert.equal(seatsTaken(statuses), 2);
  assert.equal(seatsTaken(['booked', 'booked', 'attended']), 3);
  assert.equal(seatsTaken([]), 0);
});

test('seatsLeft never goes negative on an overbooked class', () => {
  assert.equal(seatsLeft(10, ['booked', 'booked']), 8);
  assert.equal(seatsLeft(2, ['booked', 'booked', 'booked', 'attended']), 0);
  assert.equal(seatsLeft(5, []), 5);
});
