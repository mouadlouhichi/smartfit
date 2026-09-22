import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('owner imports a logo, customizes the gym and publishes the same preview to its storefront', async ({
  page,
}) => {
  const logo = await sharp({
    create: { width: 96, height: 96, channels: 4, background: '#7c3aed' },
  })
    .png()
    .toBuffer();
  await page.route('https://media.example/gym.jpg', (route) =>
    route.fulfill({ contentType: 'image/png', body: logo }),
  );
  await page.goto('/g/zone-fight/console');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page
    .getByLabel('Upload logo', { exact: true })
    .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo });
  await expect(page.getByRole('button', { name: 'Remove uploaded logo' })).toBeVisible();
  await page.getByRole('button', { name: 'circle logo', exact: true }).click();
  await page.getByRole('button', { name: 'Ocean palette' }).click();
  await page.getByRole('button', { name: 'Use Mindful studio cover' }).click();
  await page.getByRole('button', { name: 'banner hero layout' }).click();
  await page.getByLabel('Membership button label').fill('Explore memberships');
  await page.getByLabel('Parking', { exact: true }).check();
  await page
    .getByLabel('Gallery photo 1 (HTTPS)', { exact: true })
    .fill('https://media.example/gym.jpg');
  await page.getByRole('button', { name: 'Publish changes' }).click();
  await expect(page.getByText('Your storefront is up to date', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'storefront', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Explore memberships', exact: true }),
  ).toHaveAttribute('href', '/g/zone-fight/#pricing');
  await expect(page.getByRole('list', { name: 'Gym amenities' })).toContainText('Parking');
  const logoBadge = page.getByRole('img', { name: 'Zone Fight logo', exact: true });
  await expect(logoBadge.locator('img')).toHaveAttribute('src', /^data:image\/(webp|png);base64,/);
  await expect(logoBadge).toHaveClass(/rounded-full/);
  await expect(
    page.getByRole('region', { name: 'Gym photo gallery' }).locator('img'),
  ).toHaveAttribute('src', 'https://media.example/gym.jpg');
  await expect(page.locator('header img[src*="studio-cover.webp"]')).toBeVisible();
  await expect(page.locator('.gym-storefront button.bg-primary').first()).toHaveCSS(
    'background-color',
    'rgb(2, 132, 199)',
  );
});

test('invalid logo files give useful feedback without changing the profile', async ({ page }) => {
  await page.goto('/g/zone-fight/console');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page
    .getByLabel('Upload logo', { exact: true })
    .setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(
    page.getByRole('alert').filter({ hasText: 'Choose a PNG, JPEG or WebP logo' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish changes' })).toBeDisabled();
});

test('visual card images load and branded pages fit mobile screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/gyms', '/library', '/g/zone-fight']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const image = page.locator('img[src*="/images/"]').first();
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      route,
    ).toBeTruthy();
  }
  await page.goto('/g/zone-fight/console');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Upload logo', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
