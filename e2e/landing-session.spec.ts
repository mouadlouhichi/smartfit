import { test, expect } from '@playwright/test';
import { emptyState, STORAGE_KEY } from '@smartfit/core';

test('new visitors can sign in from desktop and mobile landing navigation', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.locator('header').getByRole('link', { name: 'Sign in', exact: true }),
  ).toHaveAttribute('href', '/login');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(
    page.locator('#mobile-menu').getByRole('link', { name: 'Sign in', exact: true }),
  ).toBeVisible();
});

test('returning on-device users get continue links everywhere, including mobile and footer', async ({
  page,
}) => {
  const state = emptyState();
  state.profile.name = 'Returning member';
  state.profile.onboardingDone = true;
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, data), {
    key: STORAGE_KEY,
    data: JSON.stringify(state),
  });
  await page.goto('/');
  await expect(
    page.locator('header').getByRole('link', { name: 'Open dashboard', exact: true }),
  ).toHaveAttribute('href', '/dashboard');
  await expect(page.locator('a[href="/login"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(
    page.locator('footer').getByRole('link', { name: 'Open dashboard', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .locator('#mobile-menu')
    .getByRole('link', { name: 'Open dashboard', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
