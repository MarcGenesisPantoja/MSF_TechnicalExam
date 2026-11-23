import { expect, test } from '@playwright/test';
import { storageStatePath } from './support/env';
import { feedback, ServiceFinder } from './support/app';

test.use({ storageState: storageStatePath('admin') });

test('shows the latest sync status for each dataset', async ({ page }) => {
  const finder = new ServiceFinder(page);
  await finder.open();

  const statuses = finder.syncStatuses();
  await expect(statuses).toHaveCount(3);
  await expect(statuses.filter({ hasText: /FSC|Family Service/ })).toHaveCount(1);
  await expect(statuses.filter({ hasText: /SSO|Social Service/ })).toHaveCount(1);
  await expect(statuses.filter({ hasText: /StudentCare|Student Care/ })).toHaveCount(1);
});

test('Sync now starts a run that finishes', async ({ page }) => {
  const finder = new ServiceFinder(page);
  await finder.open();
  const lastRun = page.getByTestId('sync-last-run');
  const before = (await lastRun.innerText()).trim();

  await page.getByTestId('sync-now').click();
  await expect(feedback(page)).toBeVisible();

  // The timer runs asynchronously; reload until the latest run time changes.
  await expect(async () => {
    await page.reload();
    expect((await lastRun.innerText()).trim()).not.toBe(before);
    await expect(finder.syncStatuses().first()).not.toContainText('Running');
  }).toPass({ timeout: 180_000, intervals: [10_000] });

  await expect(finder.syncStatuses().filter({ hasText: /Success|Partial/ }).first()).toBeVisible();
});
