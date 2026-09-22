import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('dashboard widgets are customizable and remembered in this browser', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByLabel('Collections chart', { exact: true }).uncheck();
  await expect(page.getByText('Subscription collections', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  await expect(page.getByText('Subscription collections', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  await page.getByRole('button', { name: 'Reset layout' }).click();
  await expect(page.getByText('Subscription collections', { exact: true })).toBeVisible();
});

test('registry filters, grid view and CSV export use the same rows', async ({ page }) => {
  await page.goto('/admin/gyms');
  await page.getByLabel('Search gyms', { exact: true }).fill('Iron');
  await expect(page.getByRole('link', { name: /Iron House Strength/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Zone Fight/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Card view' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export 1 gyms' }).click();
  const file = await (await download).path();
  const csv = await readFile(file!, 'utf8');
  expect(csv).toContain('Iron House Strength');
  expect(csv).not.toContain('Zone Fight');
});

test('gym lifecycle asks for confirmation and cancel changes nothing', async ({ page }) => {
  await page.goto('/admin/gyms/iron-house');
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Suspend Iron House Strength?');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Suspend', exact: true })).toBeVisible();
});

test('storefront studio previews, validates, publishes and preserves edits across console tabs', async ({
  page,
}) => {
  await page.goto('/g/zone-fight/console');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Tagline', { exact: true }).fill('Train together. Grow stronger.');
  await expect(page.getByText('Train together. Grow stronger.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Members', exact: true }).click();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Tagline', { exact: true })).toHaveValue(
    'Train together. Grow stronger.',
  );
  await page.getByRole('button', { name: 'Ocean palette' }).click();
  await page.getByLabel('Logo image URL (HTTPS)').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Logo must be an HTTPS' })).toBeVisible();
  await page.getByLabel('Logo image URL (HTTPS)').fill('');
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByText('Your storefront is up to date')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish changes' })).toBeDisabled();
});

test('member directory opens a profile and saves internal notes', async ({ page }) => {
  await page.goto('/g/zone-fight/console');
  await page.getByRole('tab', { name: 'Members', exact: true }).click();
  await page.getByLabel('Search members', { exact: true }).fill('Amina');
  await page.getByRole('button', { name: /^Amina Rachidi/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Internal notes').fill('Prefers evening classes. Follow up on renewal.');
  await dialog.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByText('Notes saved', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save notes' })).toBeDisabled();
});

test('mobile admin navigation fits and remains keyboard dismissible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
});

test('revenue method filters export matching payments and audit action filters retain their value', async ({
  page,
}) => {
  await page.goto('/admin/revenue');
  await page.getByRole('button', { name: 'Payment method', exact: true }).click();
  await page.getByRole('option', { name: 'cash', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Payment method', exact: true })).toContainText(
    'cash',
  );
  const rows = page.locator('table tbody tr');
  await expect(rows).toHaveCount(3);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export payments', exact: true }).click();
  const csv = await readFile((await (await downloaded).path())!, 'utf8');
  expect(csv).toContain('"cash"');
  expect(csv).not.toContain('"transfer"');
  await page.getByRole('link', { name: 'Audit', exact: true }).click();
  await page.getByRole('button', { name: 'Filter audit action', exact: true }).click();
  await page.getByRole('option', { name: 'gym:suspend', exact: true }).click();
  await expect(page.locator('details')).toHaveCount(1);
  await page.locator('details summary').click();
  await expect(page.locator('details pre')).toContainText('suspended');
});

test('published opening hours reach the public storefront in the same tenant session', async ({
  page,
}) => {
  await page.goto('/g/zone-fight/console');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Hours', exact: true }).click();
  await page.getByLabel('Monday opens', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Copy Monday to weekdays' }).click();
  await expect(page.getByLabel('Tuesday opens', { exact: true })).toHaveValue('08:00');
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByText('Your storefront is up to date', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'storefront', exact: true }).click();
  await expect(page.getByText('Monday 08:00–22:30', { exact: true })).toBeVisible();
  await expect(page.getByText('Sunday Closed', { exact: true })).toBeVisible();
});
