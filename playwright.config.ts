import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke suite.
 *
 * Runs against the real production build (`next start`) with NO Firebase
 * environment configured, i.e. the app's local mode — the same path a preview
 * deployment takes. It covers the journeys unit tests cannot: routing guards,
 * onboarding, the modal system, the store's persistence round-trip and the
 * destructive-action confirm dialogs.
 *
 * Local:  pnpm build && pnpm test:e2e
 * CI:     see .github/workflows/ci.yml (job `e2e`)
 */
export default defineConfig({
  testDir: './e2e',
  /* The journey test is stateful by design; never shard it across workers. */
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
