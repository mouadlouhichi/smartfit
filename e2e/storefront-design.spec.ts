import { test, expect } from '@playwright/test';

test('storefront class discovery, timetable filters and visit links use the current gym', async ({
  page,
}) => {
  await page.goto('/g/zone-fight');
  await expect(page.getByRole('navigation', { name: 'Gym navigation' })).toBeVisible();
  const discovery = page.locator('section#classes');
  await expect(discovery.getByRole('link', { name: /Boxing Fundamentals/ })).toHaveAttribute(
    'href',
    '/g/zone-fight/class/cls-boxing',
  );
  const timetable = page.locator('section#timetable');
  await timetable.getByRole('button', { name: 'Combat', exact: true }).click();
  await expect(
    timetable.getByRole('link', { name: 'Boxing Fundamentals', exact: true }).first(),
  ).toBeVisible();
  await expect(
    timetable.getByRole('link', { name: 'Strength Foundations', exact: true }),
  ).toHaveCount(0);
  await timetable.getByRole('button', { name: 'All classes', exact: true }).click();
  await expect(
    timetable.getByRole('link', { name: 'Strength Foundations', exact: true }),
  ).toBeVisible();
  const dates = timetable.getByRole('combobox', { name: 'Timetable date' });
  await dates.selectOption({ index: 1 });
  await expect(timetable.getByRole('heading', { level: 3 })).toHaveCount(1);
  const directions = page.getByRole('link', { name: 'Get directions' });
  await expect(directions).toHaveAttribute(
    'href',
    /https:\/\/www.google.com\/maps\/search\/\?api=1&query=.*Casablanca/,
  );
  await expect(page.locator('section#pricing')).not.toContainText('Staff');
});
test('storefront mobile menu and bottom shortcuts work without horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/g/iron-house');
  await page.getByRole('button', { name: 'Open gym menu' }).click();
  const menu = page.locator('#gym-mobile-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: 'Timetable', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(/#timetable$/);
  await page.getByRole('button', { name: 'Open gym menu' }).click();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open gym menu' })).toBeFocused();
  await page.getByRole('link', { name: 'Find a class', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('h1')).toContainText('Iron House Strength');
  expect(errors).toEqual([]);
});
