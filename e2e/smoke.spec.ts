import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * The local-mode product journey, end to end:
 * onboarding → log a workout → see it → edit it → delete it → schedule,
 * goals, body, units, coach, export, erase. Plus the guard rails: deep links
 * enforce onboarding, unknown routes 404, PWA assets serve, legal pages render.
 */

/** Walk the five onboarding steps with sensible defaults. */
async function completeOnboarding(page: Page, name = 'Test Athlete') {
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('button', { name: /Continue/ }).click(); // welcome
  await page.getByLabel('What should we call you?').fill(name);
  await page.getByRole('button', { name: /Continue/ }).click(); // about you
  await page.getByRole('button', { name: /Continue/ }).click(); // strategy
  await page.getByRole('button', { name: /Continue/ }).click(); // goal
  await page.getByRole('button', { name: /Enter dashboard/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('a fresh visitor is guided through onboarding from any deep link', async ({ page }) => {
  await page.goto('/dashboard/goals');
  await expect(page).toHaveURL(/\/onboarding/);
  await completeOnboarding(page);
  await expect(page.getByText('Test Athlete!')).toBeVisible();
});

test('the full local-mode journey: log, edit, delete, plan, goals, body, units, coach, export, erase', async ({
  page,
}) => {
  // ── Onboarding ─────────────────────────────────────────────────────────
  await page.goto('/dashboard');
  await completeOnboarding(page);

  // ── Log a workout ──────────────────────────────────────────────────────
  // Scoped to <main>: the header pill and the overview FAB share the
  // accessible name "Log workout"; the FAB lives inside main.
  await page.getByRole('main').getByRole('button', { name: 'Log workout' }).click();
  const logDialog = page.getByRole('dialog').filter({ hasText: 'Log workout' });
  await expect(logDialog).toBeVisible();
  await logDialog.getByLabel('Title').fill('Playwright Bench Press');
  await logDialog.getByLabel('Minutes').fill('50');
  await logDialog.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByText('Playwright Bench Press').first()).toBeVisible();

  // ── Session detail shows everything that was captured ─────────────────
  await page
    .getByRole('button', { name: /Playwright Bench Press/ })
    .first()
    .click();
  const detail = page.getByRole('dialog').filter({ hasText: 'Playwright Bench Press' });
  await expect(detail.getByText('50m')).toBeVisible(); // formatMinutes renders "50m"
  await expect(detail.getByText('No exercises or notes were recorded')).toBeVisible();

  // ── Edit it ────────────────────────────────────────────────────────────
  await detail.getByRole('button', { name: 'Edit' }).click();
  const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit workout' });
  await editDialog.getByLabel('Title').fill('Renamed Session');
  await editDialog.getByLabel('Notes').fill('Felt strong.');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Renamed Session').first()).toBeVisible();

  // The note is rendered in the detail view (it used to be captured and thrown away).
  await page
    .getByRole('button', { name: /Renamed Session/ })
    .first()
    .click();
  await expect(page.getByRole('dialog').getByText('Felt strong.')).toBeVisible();
  await page.keyboard.press('Escape'); // both Close buttons say "Close"; Escape is unambiguous

  // ── The plan log lists it too ──────────────────────────────────────────
  await page.goto('/dashboard/plan');
  await expect(page.getByText('Renamed Session').first()).toBeVisible();

  // ── Schedule a recurring session ───────────────────────────────────────
  await page.getByRole('button', { name: 'Schedule session' }).click();
  const scheduleDialog = page.getByRole('dialog').filter({ hasText: 'Plan a session' });
  await scheduleDialog.getByLabel('Title').fill('E2E Upper Body');
  await scheduleDialog.getByRole('button', { name: 'Add to plan' }).click();
  await expect(page.getByText('E2E Upper Body').first()).toBeVisible();

  // ── Delete the logged workout via its detail → edit → delete flow,
  //    which now goes through the design-system confirm dialog ───────────
  await page
    .getByRole('button', { name: /Renamed Session/ })
    .first()
    .click();
  await page
    .getByRole('dialog')
    .filter({ hasText: 'Renamed Session' })
    .getByRole('button', { name: 'Edit' })
    .click();
  const editAgain = page.getByRole('dialog').filter({ hasText: 'Edit workout' });
  await editAgain.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog').filter({ hasText: 'Delete this workout?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete workout' }).click();
  await expect(page.getByText('Renamed Session')).toHaveCount(0);

  // ── Goals: the onboarding goal exists; create a distance goal ─────────
  await page.goto('/dashboard/goals');
  await expect(page.getByText('Train this week').first()).toBeVisible();
  await page.getByRole('button', { name: 'New goal' }).click();
  const goalDialog = page.getByRole('dialog').filter({ hasText: 'Set a goal' });
  await goalDialog.getByLabel('Name').fill('E2E distance goal');
  await goalDialog.getByLabel('Track').selectOption('distance');
  await goalDialog.getByLabel(/Target/).fill('20');
  await goalDialog.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByText('E2E distance goal')).toBeVisible();

  // ── Body: log a measurement, see the trend ─────────────────────────────
  await page.goto('/dashboard/body');
  await page.getByRole('button', { name: 'Log measurement' }).click();
  const bodyDialog = page.getByRole('dialog').filter({ hasText: 'Log a measurement' });
  await bodyDialog.getByLabel(/Value/).fill('80');
  await bodyDialog.getByRole('button', { name: 'Save measurement' }).click();
  await expect(page.getByText('Body weight trend')).toBeVisible();

  // ── Progress honours the distance unit and never invents targets ──────
  await page.goto('/dashboard/profile');
  await page.getByLabel('Distance unit').selectOption('mi');
  await page.getByLabel('Weight unit').selectOption('lb');
  await expect(page.getByText(/Body measurements follow this: inches/)).toBeVisible();
  await page.goto('/dashboard/progress');
  await expect(page.getByText('0 mi').first()).toBeVisible();

  // ── Coach answers from local data ──────────────────────────────────────
  await page.goto('/dashboard/coach');
  await page.getByLabel('Message your coach').fill('What should I train today?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('What should I train today?').first()).toBeVisible();

  // ── Export a complete JSON backup ──────────────────────────────────────
  await page.goto('/dashboard/profile');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(exported.profile.name).toBe('Test Athlete');
  expect(exported.profile.distanceUnit).toBe('mi');
  expect(exported.schedule.some((s: { title: string }) => s.title === 'E2E Upper Body')).toBe(true);
  expect(exported.goals.some((g: { name: string }) => g.name === 'E2E distance goal')).toBe(true);
  expect(exported.bodyLogs.length).toBe(1);
  expect(exported.sessions.length).toBe(0); // the logged workout was deleted

  // ── Erase everything → back to onboarding (fresh state) ────────────────
  await page.getByRole('button', { name: 'Erase everything' }).click();
  const eraseConfirm = page
    .getByRole('dialog')
    .filter({ hasText: 'Erase all your SmartFit data?' });
  await eraseConfirm.getByRole('button', { name: 'Erase everything' }).click();
  await expect(page).toHaveURL(/\/onboarding/);
});

test('data survives a reload (localStorage round-trip)', async ({ page }) => {
  await page.goto('/dashboard');
  await completeOnboarding(page, 'Persist Pat');
  await page.getByRole('main').getByRole('button', { name: 'Log workout' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Log workout' });
  await dialog.getByLabel('Title').fill('Reload Rowing');
  await dialog.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByText('Reload Rowing').first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Reload Rowing').first()).toBeVisible();
});

test('system, legal and PWA endpoints all respond', async ({ page, request }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible();
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByText('404')).toBeVisible();

  for (const asset of [
    '/manifest.webmanifest',
    '/sw.js',
    '/favicon.ico',
    '/og.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/maskable-512.png',
    '/robots.txt',
    '/sitemap.xml',
  ]) {
    const res = await request.get(asset);
    expect(res.ok(), `${asset} should serve`).toBeTruthy();
  }
});
