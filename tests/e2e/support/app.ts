import { Browser, expect, Locator, Page } from '@playwright/test';
import { Role, storageStatePath } from './env';

/**
 * Selectors use data-testid attributes set on the widgets in Service Studio
 * (widget properties > Attributes). The full list is in README.md, "Test IDs".
 */

export const feedback = (page: Page): Locator => page.locator('.feedback-message');

export async function asRole(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath(role) });
  return context.newPage();
}

export class ServiceFinder {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('ServiceFinder');
    await expect(this.page.getByTestId('finder-search')).toBeVisible();
  }

  names(): Locator {
    return this.page.getByTestId('centre-name');
  }

  types(): Locator {
    return this.page.getByTestId('centre-type');
  }

  async search(text: string): Promise<void> {
    await this.page.getByTestId('finder-search').fill(text);
    await this.page.getByTestId('finder-search').press('Enter');
  }

  async filterType(label: string): Promise<void> {
    // The data-testid sits on the OutSystems UI wrapper; the native <select> is inside it.
    await this.page.getByTestId('finder-type').locator('select').selectOption({ label });
  }

  syncStatuses(): Locator {
    return this.page.getByTestId('sync-status');
  }
}
