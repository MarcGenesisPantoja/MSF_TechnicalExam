import { expect, test } from '@playwright/test';
import { storageStatePath } from './support/env';
import { ServiceFinder } from './support/app';

test.use({ storageState: storageStatePath('officer') });

test.describe('Service directory', () => {
  test('lists centres after a sync', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();
    await expect(finder.names().first()).toBeVisible();
  });

  test('type filter shows only that type', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();

    await finder.filterType('Social Service Office');
    await expect(finder.types().first()).toContainText('Social Service Office');

    for (const label of await finder.types().allInnerTexts()) {
      expect(label).toContain('Social Service Office');
    }
  });

  test('search by name finds the centre', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();
    const name = (await finder.names().first().innerText()).trim();

    await finder.search(name);
    await expect(finder.names().first()).toHaveText(name);
  });

  test('no match shows the empty state', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();

    await finder.search('zz-no-such-centre-zz');
    await expect(finder.names()).toHaveCount(0);
    await expect(page.getByTestId('empty-state')).toBeVisible();
  });

  test('postal sector accepts two digits only', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();

    const sector = page.getByTestId('finder-sector');
    test.skip((await sector.count()) === 0, 'Postal sector filter not included in this build');

    await sector.fill('ABC');
    await sector.press('Enter');
    await expect(page.locator('.validation-message').first()).toBeVisible();
  });
});
