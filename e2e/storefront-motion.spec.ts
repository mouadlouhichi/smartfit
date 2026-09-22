import { test, expect } from '@playwright/test';

test('hero parallax moves only artwork; pause freezes decorative motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/g/zone-fight');
  const root = page.locator('.gym-storefront');
  await expect(root).toHaveAttribute('data-motion', 'running');
  const hero = page.locator('.sf-hero');
  const photo = hero.locator('.sf-parallax-cover');
  const before = await photo.evaluate((el) => getComputedStyle(el).transform);
  await page.evaluate(() => window.scrollTo(0, 200));
  await expect.poll(() => photo.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
  await expect(hero.getByRole('heading', { level: 1 })).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  await expect(root).toHaveAttribute('data-motion', 'paused');
  await expect(photo).toHaveCSS('transform', 'none');
  await expect(hero.locator('.sf-orbit-spin')).toHaveCSS('animation-play-state', 'paused');
  await expect(
    page.getByRole('button', { name: 'Resume animations', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Resume animations', exact: true }).click();
  await expect(root).toHaveAttribute('data-motion', 'running');
  const statement = page.locator('.sf-statement');
  await statement.scrollIntoViewIfNeeded();
  await expect(hero).toHaveAttribute('data-in-view', 'false');
  await expect(hero.locator('.sf-orbit-spin')).toHaveCSS('animation-play-state', 'paused');
  await expect(statement.locator('.sf-ribbon-track')).toHaveCSS('animation-play-state', 'running');
  await page.getByRole('link', { name: 'Find your next session', exact: true }).click();
  await expect(page).toHaveURL(/#timetable$/);
  expect(errors).toEqual([]);
});

test('reduced motion is respected at load and when changed while browsing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/g/zone-fight');
  const root = page.locator('.gym-storefront');
  await expect(page.getByRole('button', { name: 'Animations off: reduced motion' })).toBeDisabled();
  await expect(root).toHaveAttribute('data-motion', 'paused');
  await expect(page.locator('.sf-hero .sf-orbit-spin')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.sf-parallax-cover')).toHaveCSS('transform', 'none');
  await page.locator('#pricing').scrollIntoViewIfNeeded();
  await expect(page.locator('#pricing')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(root).toHaveAttribute('data-motion', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(root).toHaveAttribute('data-motion', 'paused');
});

test('animated storefront fits small phones and light mode without blocking controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/g/iron-house');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await page.getByRole('button', { name: 'Open gym menu' }).click();
  await page
    .locator('#gym-mobile-menu')
    .getByRole('link', { name: 'Memberships', exact: true })
    .click();
  await expect(page).toHaveURL(/#pricing$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.sf-statement').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Make room for more.' })).toBeVisible();
});

test('public identity and offers remain visible without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/g/zone-fight');
  await expect(page.getByRole('heading', { name: 'Zone Fight', level: 1 })).toBeVisible();
  await expect(page.locator('#classes')).toHaveCSS('opacity', '1');
  await expect(page.locator('#pricing article').first()).toBeVisible();
  await expect(page.locator('.gym-storefront')).toHaveAttribute('data-motion', 'paused');
  await context.close();
});
