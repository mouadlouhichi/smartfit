import { test, expect, type Page } from '@playwright/test';

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
/** The demo persona switcher rendered on the storefront in local mode. */
const personaSwitch = (page: Page) => page.getByLabel('Demo persona');

test('the public storefront is server-rendered with the gym’s own identity', async ({ page }) => {
  await page.goto(GYM);
  await expect(page).toHaveTitle('Zone Fight · SmartFit');
  await expect(page.getByRole('heading', { name: 'Zone Fight' })).toBeVisible();
  await expect(page.getByText('Timetable')).toBeVisible();
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
  await personaSwitch(page).selectOption('member');

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
  await personaSwitch(page).selectOption('prospect');

  await expect(page.getByRole('heading', { name: 'Train at Zone Fight' })).toBeVisible();
  await page.getByRole('button', { name: 'Join Zone Fight' }).click();
  await expect(page.getByText('Welcome — your trial membership is active')).toBeVisible();
  // The membership card replaces the join CTA, on a trial status.
  await expect(page.locator('section#membership').getByText('trial')).toBeVisible();
});

test('staff check in, take attendance, promote the waitlist — and see no Revenue', async ({
  page,
}) => {
  await page.goto(`${GYM}/console`);
  await page.getByLabel('Demo role').selectOption('gym-staff');

  // Staff land on Today, and the capability filter leaves Revenue absent —
  // not disabled: a receptionist must not learn the tab exists.
  await expect(page.getByRole('tab', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Revenue' })).toHaveCount(0);

  // Front-desk search → check in.
  await page.getByLabel('Search a member').fill('Lina');
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByText('Lina Fassi checked in')).toBeVisible();

  // The later-today class has two booked rows and one waitlisted.
  await expect(page.getByRole('button', { name: 'Attended' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Attended' }).first().click();
  await expect(page.getByText('Amina Rachidi attended')).toBeVisible();
  await page.getByRole('button', { name: 'No-show' }).first().click();
  await expect(page.getByText('Omar Tazi marked as no-show')).toBeVisible();

  await page.getByRole('button', { name: 'Promote' }).click();
  await expect(page.getByText('Lina Fassi promoted from the waitlist')).toBeVisible();
});

test('an owner sees the business tabs the staff cannot', async ({ page }) => {
  await page.goto(`${GYM}/console`);
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Revenue' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
});
