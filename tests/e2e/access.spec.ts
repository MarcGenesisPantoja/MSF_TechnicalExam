import { expect, test } from '@playwright/test';
import { asRole, ServiceFinder } from './support/app';

/**
 * Role checks from the UI side. Sync_Now enforces the same rule on the server;
 * this only confirms users are not offered an action they cannot perform.
 */

test('user without SyncAdmin does not see Sync now', async ({ browser }) => {
  const page = await asRole(browser, 'officer');
  const finder = new ServiceFinder(page);
  await finder.open();

  await expect(page.getByTestId('sync-now')).toHaveCount(0);
  await page.context().close();
});

test('signed-out user is sent to login', async ({ page }) => {
  await page.goto('ServiceFinder');
  await expect(page).toHaveURL(/\/Login/i);
});
