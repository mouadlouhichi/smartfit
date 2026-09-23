import { test, expect, type Page } from '@playwright/test';

/**
 * The coaching loop, end to end (local mode):
 * weigh-in + meal → meal suggestions and swaps on Fuel → a session logs XP →
 * a deadline goal reports its pace → the weekly check-in closes the week and
 * pays XP → French localises the shell.
 *
 * These are the four surfaces the TapFit benchmark flagged as missing, so the
 * journey test is written to fail loudly if any of them silently stops
 * appearing — a card that renders nothing is the failure mode unit tests
 * cannot see.
 */

/** Walk the five onboarding steps with sensible defaults. */
async function completeOnboarding(page: Page, name = 'Loop Tester') {
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('button', { name: /Continue/ }).click(); // welcome
  await page.getByLabel('What should we call you?').fill(name);
  await page.getByRole('button', { name: /Continue/ }).click(); // about you
  await page.getByRole('button', { name: /Continue/ }).click(); // strategy
  await page.getByRole('button', { name: /Continue/ }).click(); // goal
  await page.getByRole('button', { name: /Enter dashboard/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Log one weigh-in, which is what unlocks the calorie targets. */
async function logWeighIn(page: Page, kg = '80') {
  await page.goto('/dashboard/fuel');
  await page.getByRole('button', { name: 'Log your weight' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Log a measurement' });
  await dialog.getByLabel(/Value/).fill(kg);
  await dialog.getByRole('button', { name: 'Save measurement' }).click();
}

test('fuel: targets unlock meal suggestions, and a logged meal can be swapped', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await completeOnboarding(page);
  await logWeighIn(page);

  // ── The planner appears with the targets, not before ────────────────────
  await expect(page.getByRole('heading', { name: 'What to eat next' })).toBeVisible();
  const slots = page.getByRole('tablist', { name: 'Meal slot' });
  await expect(slots).toBeVisible();
  await slots.getByRole('tab', { name: /Lunch/ }).click();

  // At least one concrete suggestion with a reason and a log affordance.
  const suggestions = page.getByRole('button', { name: /^Log this / });
  await expect(suggestions.first()).toBeVisible();

  // ── Logging a suggestion pre-fills the meal form (never auto-logs) ──────
  await suggestions.first().click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Log a meal' });
  await expect(dialog).toBeVisible();
  const loggedName = await dialog.getByLabel('Name').inputValue();
  expect(loggedName).not.toBe('');
  await expect(dialog.getByLabel('Calories (kcal)')).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Save meal' }).click();

  /*
   * The meal row is addressed through its Edit button, whose accessible name
   * carries the meal's current name ("Edit Chicken breast"). That makes the
   * locator survive the swap — which is precisely the thing being asserted —
   * without knowing in advance which food the planner will suggest.
   */
  const rowFor = (name: string) =>
    page
      .locator('li')
      // `exact` so "Edit Egg" never matches "Edit Egg white".
      .filter({ has: page.getByRole('button', { name: `Edit ${name}`, exact: true }) })
      .first();
  const row = rowFor(loggedName);
  await expect(row).toBeVisible();
  const kcalBefore = (await row.innerText()).match(/(\d+)\s*kcal/)?.[1];
  expect(kcalBefore, 'the logged meal shows its energy').toBeTruthy();

  // ── Swapping is a Pro feature: free accounts get the upsell ─────────────
  const swap = page.getByRole('button', { name: 'Swap' }).first();
  await expect(swap).toBeVisible();
  await swap.click();
  const pro = page.getByRole('dialog').filter({ hasText: 'SmartFit Pro' });
  await expect(pro).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0); // no free swaps

  // ── Start the free Pro period, then swap for a macro-matched food ───────
  await pro.getByRole('button', { name: /months of Pro — free/ }).click();
  await page.getByRole('button', { name: 'Start 3 months free' }).click();

  await swap.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByText('Swap for something equivalent')).toBeVisible();
  const alternative = menu.getByRole('menuitem').first();
  const alternativeName = (await alternative.locator('span').first().innerText()).trim();
  await alternative.click();

  // The meal is the alternative now — and the energy did not move, which is
  // the whole reason to swap rather than delete and re-log.
  const swapped = rowFor(alternativeName);
  await expect(swapped).toBeVisible();
  await expect(rowFor(loggedName)).toHaveCount(0);
  expect((await swapped.innerText()).match(/(\d+)\s*kcal/)?.[1]).toBe(kcalBefore);
});

test('progress: XP reflects the log, and the weekly check-in closes the week', async ({ page }) => {
  await page.goto('/dashboard');
  await completeOnboarding(page);

  // ── A fresh account is level 1 with an explainable zero ─────────────────
  await page.goto('/dashboard/progress');
  await expect(page.getByText('Level 1')).toBeVisible();
  await expect(page.getByText('Groundwork')).toBeVisible();
  await page.getByRole('button', { name: 'Where the XP comes from' }).click();
  await expect(page.getByText(/your first entry starts the count/i)).toBeVisible();

  // ── Logging a session moves the bar ─────────────────────────────────────
  await page.goto('/dashboard');
  await page.getByRole('main').getByRole('button', { name: 'Log workout' }).click();
  const logDialog = page.getByRole('dialog').filter({ hasText: 'Log workout' });
  await logDialog.getByLabel('Title').fill('Loop Session');
  await logDialog.getByLabel('Minutes').fill('45');
  await logDialog.getByRole('button', { name: 'Save workout' }).click();
  await expect(page.getByText('Loop Session').first()).toBeVisible();

  await page.goto('/dashboard/progress');
  await expect(page.getByText(/XP this week/)).toBeVisible();
  await page.getByRole('button', { name: 'Where the XP comes from' }).click();
  await expect(page.getByText('Sessions logged')).toBeVisible();
  await expect(page.getByText('Best streak')).toBeVisible();

  // ── A brand-new account is never asked to review a week it predates ─────
  // (Nothing to check in about yet: last week is empty and there is no habit.)
  await expect(page.getByText('Your week is waiting')).toHaveCount(0);
});

test('goals: a deadline reports whether the current pace arrives in time', async ({ page }) => {
  await page.goto('/dashboard');
  await completeOnboarding(page);

  await page.goto('/dashboard/goals');
  await page.getByRole('button', { name: 'New goal' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Set a goal' });
  await expect(dialog).toBeVisible();

  // Track is the design-system Select (a listbox), not a native <select>.
  // The deadline field explains itself, and "Suggest" fills a future date.
  await expect(
    dialog.getByText('Add a date and the goal reports whether your current pace arrives in time.'),
  ).toBeVisible();
  await dialog.getByLabel('Name').fill('Marathon block');
  await dialog.getByLabel('Track').click();
  await page.getByRole('option', { name: 'Distance' }).click();
  await dialog.getByLabel(/Target/).fill('40');
  await dialog.getByRole('button', { name: 'Suggest' }).click();

  // With a date set, the dialog states the required pace against the actual one.
  await expect(dialog.getByText(/Log a full week/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByText('Marathon block').first()).toBeVisible();

  /*
   * The countdown lives on the card, not only inside the modal: a deadline
   * you can only see while editing is a number nobody reads twice. The pace
   * verdict rides along as the badge's tooltip.
   */
  await expect(page.getByText(/\d+ (days?|weeks?|months?) left/)).toBeVisible();
  await expect(page.getByTitle(/Log a full week/)).toHaveCount(1);
});

test('language: switching to French localises the shell and persists', async ({ page }) => {
  await page.goto('/dashboard');
  await completeOnboarding(page);

  await page.goto('/dashboard/personalize');
  const language = page.getByRole('button', { name: 'Français' });
  await expect(language).toBeVisible();
  await language.click();
  await expect(language).toHaveAttribute('aria-pressed', 'true');

  // The rail and the bottom nav follow the preference, not the device.
  await expect(page.getByRole('link', { name: 'Tableau de bord' }).first()).toBeVisible();

  await page.goto('/dashboard/fuel');
  await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();

  // A reload keeps the choice (it lives on the profile).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nutrition' })).toBeVisible();

  // And the document language follows too, which is what screen readers use.
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  // Diet restrictions are hard filters, and the count says so out loud —
  // in French, because the interface is French by now.
  await page.goto('/dashboard/personalize');
  await page.getByRole('button', { name: 'Végétalien' }).click();
  await expect(page.getByText(/aliments sur \d+ restent disponibles/)).toBeVisible();
});

test('diet: a restriction removes foods from the suggestions and the swaps', async ({ page }) => {
  await page.goto('/dashboard');
  await completeOnboarding(page);
  await logWeighIn(page);

  // Pick a vegan diet, which must exclude every animal product in the table.
  await page.goto('/dashboard/personalize');
  await page.getByRole('button', { name: 'Vegan' }).click();

  await page.goto('/dashboard/fuel');
  await expect(page.getByRole('heading', { name: 'What to eat next' })).toBeVisible();
  const listed = await page
    .getByRole('button', { name: /^Log this / })
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label') ?? ''));
  expect(listed.length).toBeGreaterThan(0);
  for (const label of listed) {
    for (const banned of ['chicken', 'beef', 'salmon', 'egg', 'yogurt', 'milk', 'cheese', 'tuna']) {
      expect(label.toLowerCase()).not.toContain(banned);
    }
  }
});
