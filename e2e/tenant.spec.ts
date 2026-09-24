import { test, expect, type Page } from '@playwright/test';
import { selectOption } from './select';

/**
 * The tenant journey in local mode, end to end.
 *
 * With no Firebase configured the tenant tree runs on the demo fixture, which
 * is exactly what a preview deployment gets. This spec walks the B2B surface
 * the way its personas do:
 *
 *   - a prospect finds the gym in the directory, browses, joins;
 *   - a member books a class, appears on the waitlist when full, cancels,
 *     and toggles the opt-in progress share;
 *   - front-desk staff check someone in, take attendance and promote the
 *     waitlist — while the capability filter keeps Revenue invisible.
 *
 * The fixture always schedules one class later today ("slot-live-hiit") with
 * booked + waitlisted rows, so the staff assertions hold on any run date.
 */

const GYM = '/g/zone-fight';
/**
 * The persona labels the switcher renders (see `demoPersonaLabel`). The
 * switcher is the design-system Select, so it is driven by its option label.
 */
const PERSONA = {
  'gym-owner': 'Youssef — gym owner',
  'gym-staff': 'Salma — gym staff',
  member: 'Amina — member',
  prospect: 'A visitor — not a member',
} as const;
/** The demo persona switcher rendered on the storefront in local mode. */
const personaSwitch = (page: Page, persona: keyof typeof PERSONA) =>
  selectOption(page, 'Demo persona', PERSONA[persona]);

test('the public storefront is server-rendered with the gym’s own identity', async ({ page }) => {
  await page.goto(GYM);
  await expect(page).toHaveTitle('Zone Fight · SmartFit');
  await expect(page.getByRole('heading', { name: 'Zone Fight', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timetable', exact: true })).toBeVisible();
  // Metadata comes from the gym's branding, not a generic template.
  const desc = page.locator('meta[name="description"]');
  await expect(desc).toHaveAttribute('content', 'Combat, conditioning and community.');
});

test('the directory lists live gyms and links through to them', async ({ page }) => {
  await page.goto('/gyms');
  await expect(page.getByRole('heading', { name: 'Find a gym' })).toBeVisible();
  await page.getByRole('link', { name: /Visit Zone Fight/ }).click();
  await expect(page).toHaveURL(/\/g\/zone-fight$/);
});

// ── The second demo tenant (local mode) ──────────────────────────────────────

test('a second gym is reachable at its own slug with its own identity', async ({ page }) => {
  await page.goto('/g/iron-house');
  await expect(page).toHaveTitle('Iron House Strength · SmartFit');
  await expect(page.getByRole('heading', { name: 'Iron House Strength', level: 1 })).toBeVisible();
  // Its own branding, not Zone Fight's.
  const desc = page.locator('meta[name="description"]');
  await expect(desc).toHaveAttribute('content', 'Strength first. Everything follows.');
  // Its own timetable — Zone Fight's classes must not leak in.
  await expect(page.getByText('Powerlifting Basics').first()).toBeVisible();
  await expect(page.getByText('Boxing Fundamentals')).toHaveCount(0);
  // The persona switcher is per-gym: the owner here is Nadia, not Youssef.
  await expect(page.getByLabel('Demo persona', { exact: true })).toContainText('Nadia — gym owner');
});

test('the directory lists both demo gyms', async ({ page }) => {
  await page.goto('/gyms');
  await expect(page.getByRole('link', { name: /Visit Zone Fight/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Visit Iron House Strength/ })).toBeVisible();
});

test('an unknown slug is not any gym — the storefront says so', async ({ page }) => {
  await page.goto('/g/does-not-exist');
  await expect(page.getByText('This gym is not open yet')).toBeVisible();
  await expect(page.getByText('Zone Fight')).toHaveCount(0);
});

test('a class detail page shows the template and its upcoming times', async ({ page }) => {
  await page.goto(`${GYM}/class/cls-boxing`);
  await expect(page).toHaveTitle('Boxing Fundamentals at Zone Fight · SmartFit');
  await expect(page.getByRole('heading', { name: 'Boxing Fundamentals' })).toBeVisible();
  await expect(page.getByText('Karim Idrissi').first()).toBeVisible();
  await expect(page.getByText('Upcoming times')).toBeVisible();
  // An unknown class 404s rather than rendering an empty shell.
  const res = await page.goto(`${GYM}/class/does-not-exist`);
  expect(res?.status()).toBe(404);
});

test('a member books, waits, cancels and shares — the whole member loop', async ({ page }) => {
  await page.goto(GYM);

  // Arrive as the member persona.
  await personaSwitch(page, 'member');

  // The membership card: status, expiry, visits — all from the roster row.
  const member = page.locator('section#membership');
  await expect(member.getByText('Amina Rachidi')).toBeVisible();
  await expect(member.getByText('12 days left').or(member.getByText('11 days left'))).toBeVisible();
  await expect(member.getByText('My classes')).toBeVisible();
  await expect(member.getByText('Recorded at the door')).toBeVisible();

  // Book the first class without a seat of hers (Wed strength or Sat cardio).
  await page.getByRole('button', { name: 'Book', exact: true }).first().click();
  await expect(page.getByText('Booked — see you there')).toBeVisible();
  await expect(
    member.getByText('Strength Foundations').or(member.getByText('Cardio Burn')),
  ).toBeVisible();

  // A full class offers the waitlist instead of a lie.
  await expect(page.getByRole('button', { name: 'Join waitlist' })).toBeVisible();

  // Cancel from "My classes" — the seat goes back.
  await member.getByRole('button', { name: 'Cancel' }).first().click();
  await expect(page.getByText('Booking cancelled')).toBeVisible();

  // The progress share is explicit about the three numbers, and revocable.
  const share = page.getByLabel('Share progress aggregates with this gym');
  await share.click();
  await expect(page.getByText('Sharing on — the gym sees your three numbers')).toBeVisible();
  await expect(page.getByText('Sessions logged this month:')).toBeVisible();
  await share.click();
  await expect(page.getByText('Off — the gym sees nothing')).toBeVisible();
});

test('a visitor joins the gym in one tap', async ({ page }) => {
  await page.goto(GYM);
  await personaSwitch(page, 'prospect');

  await expect(page.getByText('Train at Zone Fight', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Join Zone Fight' }).click();
  await expect(page.getByText('Welcome — your trial membership is active')).toBeVisible();
  // The membership card replaces the join CTA, on a trial status.
  await expect(
    page.locator('section#membership').getByText('Trial', { exact: true }),
  ).toBeVisible();
});

test('staff check in, take attendance, promote the waitlist — and see no Revenue', async ({
  page,
}) => {
  await page.goto(`${GYM}/console`);
  await selectOption(page, 'Demo role', 'Gym staff');

  // Staff land on Today, and the capability filter leaves Revenue absent —
  // not disabled: a receptionist must not learn the tab exists.
  await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Revenue' })).toHaveCount(0);

  // Front-desk search → check in.
  await page.getByLabel('Search a member').fill('Lina');
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByText('Lina Fassi checked in')).toBeVisible();

  // Scope the later-today fixture: other classes may also run on the current weekday.
  const liveClass = page.locator('[data-slot-id="slot-live-hiit"]');
  await expect(liveClass.getByRole('button', { name: 'Attended' }).first()).toBeVisible();
  await liveClass.getByRole('button', { name: 'Attended' }).first().click();
  await expect(page.getByText('Amina Rachidi attended')).toBeVisible();
  await liveClass.getByRole('button', { name: 'No-show' }).first().click();
  await expect(page.getByText('Omar Tazi marked as no-show')).toBeVisible();

  await liveClass.getByRole('button', { name: 'Promote' }).click();
  await expect(page.getByText('Lina Fassi promoted from the waitlist')).toBeVisible();
});

test('an owner sees the business tabs the staff cannot', async ({ page }) => {
  await page.goto(`${GYM}/console`);
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Revenue' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
});

// ── Platform admin (demo mode) ────────────────────────────────────────────────

test('the admin console renders the KPI band and registry from demo data', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  await expect(page.getByText('Live gyms')).toBeVisible();
  await expect(page.getByText('Platform MRR')).toBeVisible();
  await expect(page.getByText('Needs attention')).toBeVisible();

  await page.getByRole('link', { name: 'Gyms', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/gyms$/);
  await expect(page.getByText('Zone Fight')).toBeVisible();
  await expect(page.getByText('Atlas Fit Club')).toBeVisible();

  // Status filter narrows the registry.
  await page.getByRole('button', { name: 'Filter gym status' }).click();
  await page.getByRole('option', { name: 'suspended', exact: true }).click();
  await expect(page.getByText('Pilates & Co')).toBeVisible();
  await expect(page.getByText('Zone Fight')).toHaveCount(0);
});

test('an admin suspends a gym and the registry reflects it', async ({ page }) => {
  await page.goto('/admin/gyms/iron-house');
  await expect(page.getByRole('heading', { name: 'Iron House Strength' })).toBeVisible();
  await page.getByRole('button', { name: 'Suspend' }).click();
  await page.getByRole('button', { name: 'Confirm suspend' }).click();
  await expect(page.getByText('Gym lifecycle updated')).toBeVisible();

  // The audit trail records the action — append-only, visible here.
  await page.getByRole('link', { name: 'Audit', exact: true }).click();
  await expect(page.getByText('gym:suspend', { exact: true }).first()).toBeVisible();
});

test('approving an application provisions a tenant', async ({ page }) => {
  await page.goto('/admin/applications');
  await expect(page.getByRole('heading', { name: 'Application inbox' })).toBeVisible();

  await page.getByRole('button', { name: 'Approve & provision' }).first().click();
  await expect(page.getByText(/Provisioned/)).toBeVisible();

  // Client navigation retains session-only demo mutations.
  await page.getByRole('link', { name: 'Gyms', exact: true }).click();
  await expect(page.getByText('Casablanca Boxing Club')).toBeVisible();
});

test('plans config edits a tier', async ({ page }) => {
  await page.goto('/admin/plans');
  // The Field contract gives every control a stable id (see docs/design-system.md §4).
  await page.locator('#starter-members').fill('150');
  await page.getByRole('button', { name: 'Save Starter' }).click();
  await expect(page.getByText('Starter updated')).toBeVisible();
});

// ── Membership purchase (demo mode) ───────────────────────────────────────────

test('a member requests a plan online and the desk collects it', async ({ page }) => {
  // As Amina (member): pick the Quarterly plan on the storefront.
  await page.goto(GYM);
  await personaSwitch(page, 'member');
  const quarterly = page.locator('section#pricing article', { hasText: 'Quarterly' });
  await quarterly.getByRole('button', { name: 'Choose this plan' }).click();
  await expect(page.getByText('Request sent — pay at the desk to activate')).toBeVisible();
  // The card flips to "waiting" — one open request per member+plan.
  await expect(quarterly.getByText('Waiting for the desk')).toBeVisible();

  // Change persona and navigate within the tenant layout to keep demo state.
  await personaSwitch(page, 'gym-owner');
  await page.getByRole('link', { name: 'Manage gym', exact: true }).click();
  await page.getByRole('tab', { name: 'Revenue' }).click();
  const queue = page.getByText('To collect — online plan requests');
  await expect(queue).toBeVisible();
  await page.getByRole('button', { name: /Collect/ }).click();
  await expect(page.getByText('Collected — membership applied')).toBeVisible();
});

test('a walk-in sale applies the plan to the membership', async ({ page }) => {
  await page.goto(`${GYM}/console`);
  await page.getByRole('tab', { name: 'Revenue' }).click();
  await page.locator('#pay-member').click();
  await page.getByRole('option', { name: 'Omar Tazi', exact: true }).click();
  await page.locator('#pay-plan').click();
  await page.getByRole('option', { name: /Annual/ }).click();
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Recorded 3,800 MAD — membership applied')).toBeVisible();
});

// ── Member app: gyms are tenants (local mode) ────────────────────────────────

test('the onboarding gym picker lists the real tenants', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: /Continue/ }).click(); // welcome
  await page.getByLabel('What should we call you?').fill('E2E Picker');
  await page.getByRole('button', { name: /Continue/ }).click(); // about you → strategy

  // The picker offers the live tenants — the static in-repo registry is gone.
  const gymSelect = page.getByLabel('Your gym — optional');
  await expect(gymSelect).toBeVisible();
  await gymSelect.click();
  const options = page.getByRole('option');
  await expect(options.filter({ hasText: 'Zone Fight' })).toHaveCount(1);
  await expect(options.filter({ hasText: 'Iron House Strength' })).toHaveCount(1);

  await page.keyboard.press('Escape');
  // And the gyms are real: the note points at the directory, not a builder.
  const browse = page.getByRole('link', { name: /Browse classes & book on their pages/ });
  await expect(browse).toHaveAttribute('href', '/gyms');
});

test('GET /api/gym-programs returns every live tenant as a program', async ({ request }) => {
  const res = await request.get('/api/gym-programs');
  expect(res.ok()).toBeTruthy();
  const { gyms } = (await res.json()) as {
    gyms: Array<{ id: string; classes: Record<string, unknown>; week: unknown[]; hours: string }>;
  };
  const ids = gyms.map((g) => g.id);
  expect(ids).toContain('zone-fight');
  expect(ids).toContain('iron-house');
  for (const g of gyms) {
    // Every tenant arrives folded into the suggested-week engine's shape.
    expect(Object.keys(g.classes).length).toBeGreaterThan(0);
    expect(g.week.length).toBeGreaterThan(0);
    expect(g.hours).toMatch(/Mon/);
  }
});

test('the plan screen picks a tenant gym and links through to its page', async ({ page }) => {
  // Local mode: a fresh visitor is walked through onboarding first.
  await page.goto('/dashboard/plan');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('What should we call you?').fill('E2G Planner');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click(); // strategy
  await page.getByRole('button', { name: /Continue/ }).click(); // goal
  await page.getByRole('button', { name: /Enter dashboard/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/dashboard/plan');
  const ironHouse = page.getByRole('button', { name: /Iron House Strength/ });
  await expect(ironHouse).toBeVisible();
  await ironHouse.click();
  await expect(ironHouse).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'Open page' })).toHaveAttribute(
    'href',
    '/g/iron-house',
  );
  // The suggested-week card follows the selection.
  await expect(page.getByText('Quick Import: Suggested Week')).toBeVisible();
});

test('an admin sets up a gym from scratch', async ({ page }) => {
  await page.goto('/admin/gyms');
  await page.getByRole('button', { name: /Set up a gym/ }).click();

  // The address follows the name until edited by hand.
  await page.getByLabel('Gym name').fill('Atlas Strength Club');
  await expect(page.getByLabel('Address (slug)')).toHaveValue('atlas-strength-club');

  await page.getByLabel('City').fill('Casablanca');
  await page.getByRole('button', { name: /Provision gym/ }).click();

  // The registry reflects the new tenant immediately…
  await expect(
    page.getByText('Atlas Strength Club set up at atlas-strength-club.smartfit'),
  ).toBeVisible();
  const row = page.getByRole('link', { name: /Atlas Strength Club/ });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/\/admin\/gyms\/atlas-strength-club$/);
  await expect(page.getByText('owner unassigned')).toBeVisible();

  // …and the audit trail records the provisioning.
  await page.getByRole('link', { name: 'Audit', exact: true }).click();
  await expect(page.getByText('gym:create', { exact: true }).first()).toBeVisible();
});
