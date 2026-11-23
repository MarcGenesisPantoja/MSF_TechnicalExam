import { expect, test } from '@playwright/test';
import { asRole } from './support/app';

/**
 * Role checks from the UI side. The server actions enforce the same rules;
 * these tests only confirm users are not offered actions they cannot perform.
 */

test('officer cannot open Sync Status', async ({ browser }) => {
  const page = await asRole(browser, 'officer');
  await page.goto('SyncStatus');
  await expect(page.getByTestId('sync-now')).toHaveCount(0);
  await page.context().close();
});

test('supervisor cannot open Sync Status', async ({ browser }) => {
  const page = await asRole(browser, 'supervisor');
  await page.goto('SyncStatus');
  await expect(page.getByTestId('sync-now')).toHaveCount(0);
  await page.context().close();
});

test('signed-out user is sent to login', async ({ page }) => {
  await page.goto('ReferralList');
  await expect(page).toHaveURL(/\/Login/i);
});
