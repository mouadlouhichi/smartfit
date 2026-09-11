import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const theme of ['light', 'dark']) {
  for (const width of [320, 390, 1280]) {
    test(`onboarding accessibility: ${theme}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await page.goto('/onboarding');
      const next = page.getByRole('button', { name: 'Continue' });
      await expect(next).toBeVisible();
      for (let step = 0; step < 5; step++) {
        await expect(page.getByText(`Step ${step + 1} of 5`)).toBeVisible();
        // Scan after step transitions settle, including text on selected cards.
        await page.waitForTimeout(350);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(result.violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (step > 0) await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
        if (step === 1) {
          await expect(next).toBeDisabled();
          const nameBorder = await page
            .getByLabel('What should we call you?')
            .evaluate((el) => getComputedStyle(el).borderColor);
          expect(nameBorder).toBe(theme === 'light' ? 'rgb(129, 122, 114)' : 'rgb(148, 135, 125)');
          await page.getByLabel('What should we call you?').fill('A'.repeat(80));
          const unit = page.getByLabel('Preferred weight unit');
          await unit.click();
          await page.waitForTimeout(350);
          const openSelect = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(openSelect.violations).toEqual([]);
          await page.getByRole('option', { name: 'Pounds (lb)' }).click();
          await page.getByLabel('Target weight (lb) — optional').fill('450');
          await expect(next).toBeEnabled();
          expect(
            await page
              .getByLabel('Target weight (lb) — optional')
              .evaluate((el: HTMLInputElement) => el.validity.valid),
          ).toBe(true);
        }
        if (step === 2 || step === 3) {
          await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1);
          const selectedBorder = await page
            .locator('button[aria-pressed="true"]')
            .evaluate((el) => getComputedStyle(el).borderColor);
          const primaryColor = await page
            .getByRole('heading', { level: 2 })
            .evaluate((el) => getComputedStyle(el).color);
          expect(selectedBorder).toBe(primaryColor);
          const other = page.locator('button[aria-pressed="false"]').first();
          await other.focus();
          await page.keyboard.press('Space');
          await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1);
        }
        if (step === 3) {
          const target = page.getByLabel(/^Target \(/);
          for (const value of ['', '0', '-1']) {
            await target.fill(value);
            await expect(next).toBeDisabled();
            await expect(target).toHaveAttribute('aria-invalid', 'true');
          }
          await target.fill('150');
          await expect(next).toBeEnabled();
        }
        if (step < 4) await next.click();
      }
      await page.getByRole('button', { name: 'Enter dashboard' }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.reload();
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  }
}
