import { expect, test } from '@playwright/test';
import { storageStatePath } from './support/env';
import { ServiceFinder } from './support/app';

test.use({ storageState: storageStatePath('officer') });

test.describe('Service Finder', () => {
  test('lists active centres after a sync', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();
    await expect(finder.cards().first()).toBeVisible();
  });

  test('type filter narrows the list', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();
    const before = await finder.cards().count();

    await finder.filterType('SSO');
    await expect(async () => {
      const after = await finder.cards().count();
      expect(after).toBeGreaterThan(0);
      expect(after).toBeLessThanOrEqual(before);
    }).toPass();

    for (const label of await finder.cards().getByTestId('centre-card-type').allInnerTexts()) {
      expect(label).toContain('Social Service Office');
    }
  });

  test('search by name finds the centre', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();
    const name = (await finder.cards().first().getByTestId('centre-card-name').innerText()).trim();

    await finder.search(name);
    await expect(finder.cards().first().getByTestId('centre-card-name')).toHaveText(name);
  });

  test('no match shows the empty state', async ({ page }) => {
    const finder = new ServiceFinder(page);
    await finder.open();

    await finder.search('zz-no-such-centre-zz');
    await expect(finder.cards()).toHaveCount(0);
    await expect(page.getByTestId('empty-state')).toBeVisible();
  });
});
