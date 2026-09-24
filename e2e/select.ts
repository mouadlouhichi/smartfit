import { type Locator, type Page } from '@playwright/test';

/**
 * Drive the design-system `Select`.
 *
 * `Select` is a real button plus an ARIA listbox, not a native `<select>`, so
 * Playwright's `selectOption()` — which only drives native controls — cannot be
 * used on it. These helpers open the listbox and click the option instead.
 *
 * Naming is unchanged from the native select it replaced: the component keeps
 * its `aria-label` (or the `Field` label association), so `getByLabel` still
 * finds the trigger.
 */
export async function selectOption(page: Page, label: string, option: string): Promise<void> {
  await trigger(page, label).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Same, but the trigger lives inside an already-scoped region. */
export async function selectOptionIn(
  scope: Page | Locator,
  label: string,
  option: string,
): Promise<void> {
  await trigger(scope, label).click();
  await scope.getByRole('option', { name: option, exact: true }).click();
}

/**
 * Pick an option by position, for lists built from data (dates, members) where
 * the label is only known at runtime. `index` is the option's index, so 1 is
 * the first real choice when a "All …" option sits at 0.
 */
export async function selectIndex(
  scope: Page | Locator,
  label: string,
  index: number,
): Promise<void> {
  await trigger(scope, label).click();
  await scope.getByRole('option').nth(index).click();
}

function trigger(scope: Page | Locator, label: string): Locator {
  return scope.getByLabel(label, { exact: true });
}
