import { expect, test } from '@playwright/test';
import { storageStatePath } from './support/env';

test.use({ storageState: storageStatePath('admin') });

test('shows the latest run for each dataset', async ({ page }) => {
  await page.goto('SyncStatus');

  const latest = page.getByTestId('sync-latest-row');
  await expect(latest).toHaveCount(3);
  await expect(latest.filter({ hasText: 'Family Service Centre' })).toHaveCount(1);
  await expect(latest.filter({ hasText: 'Social Service Office' })).toHaveCount(1);
  await expect(latest.filter({ hasText: 'Student Care Centre' })).toHaveCount(1);
});

test('Sync now queues a run that finishes', async ({ page }) => {
  await page.goto('SyncStatus');
  const runs = page.getByTestId('sync-run-row');
  const before = await runs.count();

  await page.getByTestId('sync-now').click();

  // The timer runs asynchronously; refresh until the new runs appear and finish.
  await expect(async () => {
    await page.reload();
    expect(await runs.count()).toBeGreaterThan(before);
    await expect(runs.first()).not.toContainText('Running');
  }).toPass({ timeout: 120_000, intervals: [5_000] });

  await expect(runs.first()).toContainText(/Success|Partial/);
});
