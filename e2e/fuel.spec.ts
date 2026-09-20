import { test, expect, type Page } from '@playwright/test';

/**
 * The Fuel journey, end to end (local mode):
 * overview glance → weigh-in unlocks targets → log a meal by hand →
 * Pro trial → adherence chart → meal scan fills the form → profile tabs.
 */

/** Walk the five onboarding steps with sensible defaults. */
async function completeOnboarding(page: Page, name = 'Fuel Tester') {
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('button', { name: /Continue/ }).click(); // welcome
  await page.getByLabel('What should we call you?').fill(name);
  await page.getByRole('button', { name: /Continue/ }).click(); // about you
  await page.getByRole('button', { name: /Continue/ }).click(); // strategy
  await page.getByRole('button', { name: /Continue/ }).click(); // goal
  await page.getByRole('button', { name: /Enter dashboard/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('fuel: targets from a weigh-in, meal log, Pro scan, adherence, profile tabs', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await completeOnboarding(page);

  // ── Overview carries the fuel glance, honest about the missing weigh-in ──
  const glance = page.getByRole('region', { name: "Today's fuel" });
  await expect(glance).toBeVisible();
  await expect(glance.getByRole('button', { name: 'Log weight' })).toBeVisible();

  // ── Fuel screen: one weigh-in unlocks the targets ────────────────────────
  await page.goto('/dashboard/fuel');
  await expect(page.getByText('One weigh-in unlocks your targets')).toBeVisible();
  await page.getByRole('button', { name: 'Log your weight' }).click();
  const body = page.getByRole('dialog').filter({ hasText: 'Log a measurement' });
  await expect(body).toBeVisible();
  await body.getByLabel(/^Value/).fill('80');
  await body.getByRole('button', { name: 'Save measurement' }).click();

  // Targets card: eaten / burned / target and the macro bars.
  await expect(page.getByText('Remaining', { exact: true })).toBeVisible();
  await expect(page.getByText('Target', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Protein versus target')).toBeVisible();

  // ── Log a meal by hand ───────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const mealDialog = page.getByRole('dialog').filter({ hasText: 'Log a meal' });
  await expect(mealDialog).toBeVisible();
  await mealDialog.getByLabel('Name').fill('Chicken & rice');
  await mealDialog.getByLabel('Calories (kcal)').fill('620');
  await mealDialog.getByLabel('Protein (g)').fill('45');
  await mealDialog.getByRole('button', { name: 'Save meal' }).click();
  await expect(page.getByText('620 kcal · 45 g protein')).toBeVisible();

  // ── Pro trial through the adherence lock ─────────────────────────────────
  await expect(page.getByText('7-day adherence')).toBeVisible();
  await page.getByRole('button', { name: 'Unlock adherence trends' }).click();
  const pro = page.getByRole('dialog').filter({ hasText: 'SmartFit Pro' });
  await expect(pro).toBeVisible();
  await pro.getByRole('button', { name: /months of Pro — free/ }).click();
  await page.getByRole('button', { name: 'Start 3 months free' }).click();
  await expect(
    page.getByRole('img', { name: /Calories eaten per day, last 7 days/ }),
  ).toBeVisible();

  // ── Meal scan fills every field (Pro perk, on-device) ────────────────────
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const scanDialog = page.getByRole('dialog').filter({ hasText: 'Log a meal' });
  await scanDialog
    .getByLabel('Describe what you ate')
    .fill('200g grilled chicken with rice and 2 eggs');
  await scanDialog.getByRole('button', { name: 'Scan', exact: true }).click();
  await expect(scanDialog.getByLabel('Calories (kcal)')).toHaveValue('604');
  await expect(scanDialog.getByLabel('Protein (g)')).toHaveValue('77');
  await expect(scanDialog.getByText('chicken 200 g')).toBeVisible();
  await scanDialog.getByRole('button', { name: 'Cancel' }).click();

  // ── Profile is navigable in Facebook-style tabs ──────────────────────────
  await page.goto('/dashboard/profile');
  const tabs = page.getByRole('tablist', { name: 'Profile sections' });
  await expect(tabs).toBeVisible();
  await tabs.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.locator('#p-name')).toBeVisible();
  await tabs.getByRole('tab', { name: 'Badges' }).click();
  await expect(page.getByRole('progressbar').first()).toBeVisible();
  await tabs.getByRole('tab', { name: 'Data' }).click();
  await expect(page.getByText('Your data', { exact: true })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Overview' }).click();
  await expect(page.getByText('SmartFit Pro')).toBeVisible();
});
