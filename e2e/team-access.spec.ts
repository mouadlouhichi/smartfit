import { test, expect } from '@playwright/test';
import { selectOption } from './select';
test('owner grants and revokes team access with a required reason and protected ownership', async ({
  page,
}) => {
  await page.goto('/g/zone-fight/console?tab=staff');
  await expect(page.getByText('Team access', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage Youssef El Amrani' })).toBeDisabled();
  const search = page.getByLabel('Find a member to add, or search your team');
  await search.fill('Amina');
  await page.getByRole('button', { name: 'Manage Amina Rachidi' }).click();
  await selectOption(page, 'New role', 'staff');
  const confirm = page.getByRole('button', { name: 'Confirm staff access' });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Reason for this change').fill('Joining the team for the morning shift');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Amina Rachidi now has staff access.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Manage Amina Rachidi' }).click();
  await selectOption(page, 'New role', 'member');
  await page.getByLabel('Reason for this change').fill('No longer working at the front desk');
  await page.getByRole('button', { name: 'Confirm member access' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Amina Rachidi now has member access.' }),
  ).toBeVisible();
  await expect(page.getByText('Demo only:', { exact: false })).toBeVisible();
});
test('staff has no team role management tab', async ({ page }) => {
  await page.goto('/g/zone-fight/console');
  await expect(page.getByRole('tab', { name: 'Team', exact: true })).toBeVisible();
  await selectOption(page, 'Demo role', 'Gym staff');
  await expect(page.getByRole('tab', { name: 'Team', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toBeVisible();
});
test('inactive members cannot receive a privileged role', async ({ page }) => {
  await page.goto('/g/zone-fight/console?tab=staff');
  await page.getByLabel('Find a member to add, or search your team').fill('Rachid Ouazzani');
  await page.getByRole('button', { name: 'Manage Rachid Ouazzani' }).click();
  await page.getByLabel('Reason for this change').fill('Trying to grant inactive staff access');
  await expect(page.getByRole('button', { name: 'Confirm staff access' })).toBeDisabled();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Activate or renew this membership' }),
  ).toBeVisible();
});
