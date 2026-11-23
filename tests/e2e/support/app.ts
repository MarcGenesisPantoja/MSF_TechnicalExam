import { Browser, expect, Locator, Page } from '@playwright/test';
import { Role, storageStatePath } from './env';

/**
 * Selectors use data-testid attributes set on the widgets in Service Studio
 * (widget properties > Attributes). The full list is in README.md, "Test IDs".
 * Screen names and test IDs are the only coupling between these tests and the app.
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
    await expect(this.page.getByTestId('finder-results')).toBeVisible();
  }

  cards(): Locator {
    return this.page.getByTestId('centre-card');
  }

  async search(text: string): Promise<void> {
    await this.page.getByTestId('finder-search').fill(text);
    await this.page.getByTestId('finder-search').press('Enter');
  }

  async filterType(type: 'FSC' | 'SSO' | 'StudentCare'): Promise<void> {
    await this.page.getByTestId(`finder-type-${type}`).click();
  }

  async openFirstCentre(): Promise<string> {
    const card = this.cards().first();
    const name = (await card.getByTestId('centre-card-name').innerText()).trim();
    await card.click();
    await expect(this.page.getByTestId('centre-name')).toHaveText(name);
    return name;
  }
}

export class ReferralForm {
  constructor(private readonly page: Page) {}

  async fill(opts: { client?: string; reason?: string; urgency?: string; notes?: string }): Promise<void> {
    if (opts.client) await this.page.getByTestId('referral-client').selectOption({ label: opts.client });
    if (opts.reason) await this.page.getByTestId('referral-reason').selectOption({ label: opts.reason });
    if (opts.urgency) await this.page.getByTestId('referral-urgency').selectOption({ label: opts.urgency });
    if (opts.notes !== undefined) await this.page.getByTestId('referral-notes').fill(opts.notes);
  }

  async submit(): Promise<void> {
    await this.page.getByTestId('referral-submit').click();
  }
}

export class ReferralDetail {
  constructor(private readonly page: Page) {}

  async open(referralId: string): Promise<void> {
    await this.page.goto(`ReferralDetail?ReferralId=${referralId}`);
    await expect(this.page.getByTestId('referral-reference')).toBeVisible();
  }

  status(): Locator {
    return this.page.getByTestId('referral-status');
  }

  async act(action: 'accept' | 'reject' | 'close' | 'withdraw', remarks = ''): Promise<void> {
    await this.page.getByTestId(`referral-${action}`).click();
    if (remarks) await this.page.getByTestId('referral-remarks').fill(remarks);
    await this.page.getByTestId('referral-confirm').click();
  }

  timeline(): Locator {
    return this.page.getByTestId('timeline-entry');
  }
}

/** ReferralDetail?ReferralId=123 -> "123" */
export const referralIdFromUrl = (url: string): string => {
  const id = new URL(url).searchParams.get('ReferralId');
  if (!id) throw new Error(`No ReferralId in ${url}`);
  return id;
};
