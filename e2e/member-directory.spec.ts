import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { selectOption } from './select';

test('View as gym preserves the three-member roster and is read-only even for an admin without membership', async ({
  page,
}) => {
  await page.goto('/admin/gyms/iron-house');
  await page.getByRole('link', { name: 'View as gym' }).click();
  await selectOption(page, 'Demo role', 'Platform admin');
  await page.getByRole('tab', { name: 'Members', exact: true }).click();
  await expect(page.getByTestId('member-metric-total')).toHaveText('3');
  await expect(
    page.getByRole('status').filter({ hasText: 'read-only gym workspace' }),
  ).toBeVisible();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);
  await page.getByRole('button', { name: /^Sofia Idrissi/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Internal notes')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Check in', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Save notes', exact: true })).toBeDisabled();
});
test('directory search, view switch, filters and export stay connected to the same members', async ({
  page,
}) => {
  await page.goto('/g/iron-house/console?tab=members');
  await page.getByLabel('Search members', { exact: true }).fill('Sofia');
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered roster' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('iron-house-members.csv');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('Sofia Idrissi');
  expect(csv).not.toContain('Imane Fatihi');
  await page.getByRole('button', { name: 'Grid view', exact: true }).click();
  await expect(page.getByRole('button', { name: /Sofia Idrissi/ })).toBeVisible();
  await page.getByLabel('Search members', { exact: true }).fill('no-such-person');
  await expect(page.getByText('No members match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByTestId('member-metric-total')).toHaveText('3');
});
test('member workspace fits a phone and keeps read-only profiles accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/g/iron-house/console?viewAs=1&tab=members');
  await expect(page.getByTestId('member-metric-total')).toHaveText('3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: /Sofia Idrissi/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Internal notes')).toBeDisabled();
  await page.getByRole('button', { name: 'Close dialog' }).click();
});
