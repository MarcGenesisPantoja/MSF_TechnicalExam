import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

/**
 * Two groups of tests:
 *   contract  - data.gov.sg contract + fixture tests. No app or browser needed.
 *   e2e       - browser tests against a deployed SupportFinder. Enabled only when
 *               APP_BASE_URL is set, e.g. https://<env>.outsystemscloud.com/SupportFinder/
 */

const appBaseUrl = process.env.APP_BASE_URL;

const e2eProjects = appBaseUrl
  ? [
      {
        name: 'setup',
        testDir: './e2e',
        testMatch: /auth\.setup\.ts/,
        use: { ...devices['Desktop Chrome'], baseURL: appBaseUrl, channel: process.env.PW_CHANNEL || undefined },
      },
      {
        name: 'e2e',
        testDir: './e2e',
        testMatch: /.*\.spec\.ts/,
        dependencies: ['setup'],
        use: { ...devices['Desktop Chrome'], baseURL: appBaseUrl, channel: process.env.PW_CHANNEL || undefined },
      },
    ]
  : [];

export default defineConfig({
  timeout: 120_000,
  expect: { timeout: 30_000 }, // Personal Environments can take 10s+ to load a screen
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // e2e tests share one database; keep them ordered
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'contract', testDir: './contract' }, ...e2eProjects],
});
