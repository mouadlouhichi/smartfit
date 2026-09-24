import { test, expect } from '@playwright/test';
import { emptyState, STORAGE_KEY } from '@smartfit/core';
import { selectOption } from './select';

test('editor publishes a revision into guest discovery and archives it again', async ({ page }) => {
  await page.goto('/studio');
  await page.getByLabel('Title', { exact: true }).fill('Beginner test workout');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Exercise name', { exact: true }).fill('Bodyweight Squat');
  await selectOption(page, 'Status', 'published');
  await page.getByRole('button', { name: 'Save revision', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Content saved');
  await page.getByRole('link', { name: 'Preview published library' }).click();
  await page.getByLabel('Search', { exact: true }).fill('Beginner test workout');
  await expect(page.getByRole('heading', { name: 'Beginner test workout' })).toBeVisible();
  await page.getByRole('button', { name: 'View details' }).click();
  await expect(page.getByText(/Bodyweight Squat · 2 sets/)).toBeVisible();
  await page.goto('/studio');
  await page.getByRole('button', { name: /Beginner test workout/ }).click();
  await selectOption(page, 'Status', 'archived');
  await page.getByRole('button', { name: 'Save revision', exact: true }).click();
  await page.getByRole('link', { name: 'Preview published library' }).click();
  await page.getByLabel('Search', { exact: true }).fill('Beginner test workout');
  await expect(page.getByText('No matching content yet')).toBeVisible();
});

test('support requester and agent exchange messages and resolve/reopen a ticket', async ({
  page,
}) => {
  await page.goto('/support');
  await page.getByLabel('Subject', { exact: true }).fill('Workout will not open');
  await page.getByLabel('What happened?').fill('The workout player is not opening on my phone.');
  await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ticket created');
  await page.getByRole('button', { name: /Workout will not open/ }).click();
  await page.getByLabel('Preview support-agent persona (demo only)').check();
  await page.getByRole('button', { name: /Workout will not open/ }).click();
  await page.getByLabel('Your reply').fill('Please retry after refreshing the workout page.');
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await expect(
    page.getByText('Please retry after refreshing the workout page.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mark resolved', exact: true }).click();
  await page.getByLabel('Preview support-agent persona (demo only)').uncheck();
  await page.getByRole('button', { name: /Workout will not open/ }).click();
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('status updated');
});

test('owner assigns trainer; member consent gates routines and staff stays read-only', async ({
  page,
}) => {
  await page.goto('/g/zone-fight/coaching');
  // Option labels are the people's names, not their uids.
  await selectOption(page, 'Member', 'Amina Rachidi');
  await selectOption(page, 'Trainer', 'Karim Idrissi');
  await page.getByRole('button', { name: 'Assign trainer', exact: true }).click();
  await selectOption(page, 'Demo coaching persona', 'Trainer');
  await page.getByRole('button', { name: /Amina Rachidi/ }).click();
  await expect(page.getByLabel('Routine title')).toHaveCount(0);
  await selectOption(page, 'Demo coaching persona', 'Member');
  await page.getByRole('button', { name: /Amina Rachidi/ }).click();
  await page.getByRole('button', { name: 'Accept coaching' }).click();
  await selectOption(page, 'Demo coaching persona', 'Trainer');
  await page.getByRole('button', { name: /Amina Rachidi/ }).click();
  await page.getByLabel('Routine title').fill('Coached starter');
  await page.getByLabel('Exercise to add').fill('Bodyweight Squat');
  await page.getByRole('button', { name: 'Add exercise & save routine' }).click();
  await expect(page.getByRole('heading', { name: 'Coached starter' })).toBeVisible();
  await page.getByLabel('Feedback', { exact: true }).fill('Keep a comfortable pace.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await selectOption(page, 'Demo coaching persona', 'Gym staff');
  await page.getByRole('button', { name: /Amina Rachidi/ }).click();
  await expect(page.getByText('Keep a comfortable pace.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0);
});

test('member preferences persist and generate a constrained scheduled week', async ({ page }) => {
  const state = emptyState();
  state.profile.onboardingDone = true;
  state.profile.name = 'Member';
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, data);
    },
    { key: STORAGE_KEY, data: JSON.stringify(state) },
  );
  await page.goto('/dashboard/personalize');
  await page.getByLabel('Avoid floor exercises', { exact: true }).check();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('preferences saved');
  await page.getByRole('button', { name: 'Apply starter week' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Replace week', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('starter week applied');
  await page.getByRole('link', { name: 'Open training plan' }).click();
  await expect(page.getByText('Personal starter 1', { exact: true })).toBeVisible();
  await page.goto('/dashboard/personalize');
  await expect(page.getByLabel('Avoid floor exercises', { exact: true })).toBeChecked();
  await page.getByLabel(/I have pain, an injury/).check();
  await expect(page.getByRole('button', { name: 'Apply starter week' })).toBeDisabled();
});

test('new workspaces fit narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/library', '/studio', '/support', '/g/zone-fight/coaching']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      route,
    ).toBeTruthy();
  }
});

test('protected APIs deny unauthenticated and cross-origin requests without leaking data', async ({
  request,
}) => {
  for (const route of [
    '/api/support',
    '/api/content?editorial=1',
    '/api/coaching?gym=zone-fight',
    '/api/account/export',
  ]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(401);
    expect(await response.json()).toHaveProperty('error');
  }
  for (const route of ['/api/support', '/api/content', '/api/coaching']) {
    expect(
      (
        await request.post(route, { headers: { origin: 'https://attacker.example' }, data: {} })
      ).status(),
    ).toBe(403);
  }
});
