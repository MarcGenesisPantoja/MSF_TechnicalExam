import { expect, test } from '@playwright/test';
import { storageStatePath } from './support/env';
import { asRole, feedback, ReferralDetail, ReferralForm, referralIdFromUrl, ServiceFinder } from './support/app';

/**
 * Referral lifecycle. Each test leaves its referral in a terminal state
 * (Closed or Withdrawn) so the duplicate-referral rule does not block the next run.
 * Clients are the synthetic records seeded by Bootstrap_Clients.
 */

test.use({ storageState: storageStatePath('officer') });
test.describe.configure({ mode: 'serial' });

const NOTES = 'Automated test referral. Synthetic data.';

test('required fields are validated before submit', async ({ page }) => {
  const finder = new ServiceFinder(page);
  await finder.open();
  await finder.openFirstCentre();
  await page.getByTestId('centre-refer-button').click();

  await new ReferralForm(page).submit();

  await expect(page.locator('.validation-message').first()).toBeVisible();
  await expect(page).toHaveURL(/ReferralNew/);
});

test('officer submits, supervisor accepts and closes, history is recorded', async ({ page, browser }) => {
  const finder = new ServiceFinder(page);
  await finder.open();
  await finder.openFirstCentre();
  await page.getByTestId('centre-refer-button').click();

  const form = new ReferralForm(page);
  await form.fill({ client: 'Test Client 01', reason: 'Financial', urgency: 'Medium', notes: NOTES });
  await form.submit();

  await expect(page).toHaveURL(/ReferralDetail\?ReferralId=\d+/);
  const referralId = referralIdFromUrl(page.url());
  const officerView = new ReferralDetail(page);
  await expect(page.getByTestId('referral-reference')).toHaveText(/^REF-\d{4}-\d{6}$/);
  await expect(officerView.status()).toHaveText('Submitted');

  // An officer cannot approve their own referral.
  await expect(page.getByTestId('referral-accept')).toHaveCount(0);

  const supervisorPage = await asRole(browser, 'supervisor');
  const supervisorView = new ReferralDetail(supervisorPage);
  await supervisorView.open(referralId);

  await supervisorView.act('accept');
  await expect(supervisorView.status()).toHaveText('Accepted');

  await supervisorView.act('close', 'Family attended first session.');
  await expect(supervisorView.status()).toHaveText('Closed');

  // Submitted -> Accepted -> Closed: one audit row per change.
  await expect(supervisorView.timeline()).toHaveCount(3);
  await supervisorPage.context().close();
});

test('duplicate open referral is refused, then withdrawn', async ({ page }) => {
  const finder = new ServiceFinder(page);
  await finder.open();
  await finder.openFirstCentre();
  const centreUrl = page.url();

  await page.getByTestId('centre-refer-button').click();
  const form = new ReferralForm(page);
  await form.fill({ client: 'Test Client 02', reason: 'Caregiving', urgency: 'Low', notes: NOTES });
  await form.submit();
  await expect(page).toHaveURL(/ReferralDetail/);
  const firstId = referralIdFromUrl(page.url());

  await page.goto(centreUrl);
  await page.getByTestId('centre-refer-button').click();
  await form.fill({ client: 'Test Client 02', reason: 'Caregiving', urgency: 'Low', notes: NOTES });
  await form.submit();

  await expect(feedback(page)).toContainText('already has an open referral');
  await expect(page).toHaveURL(/ReferralNew/);

  const detail = new ReferralDetail(page);
  await detail.open(firstId);
  await detail.act('withdraw', 'Created by automated test.');
  await expect(detail.status()).toHaveText('Withdrawn');
});

test('reject requires remarks', async ({ page, browser }) => {
  const finder = new ServiceFinder(page);
  await finder.open();
  await finder.openFirstCentre();
  await page.getByTestId('centre-refer-button').click();

  const form = new ReferralForm(page);
  await form.fill({ client: 'Test Client 03', reason: 'Childcare', urgency: 'High', notes: NOTES });
  await form.submit();
  const referralId = referralIdFromUrl(page.url());

  const supervisorPage = await asRole(browser, 'supervisor');
  const view = new ReferralDetail(supervisorPage);
  await view.open(referralId);

  await supervisorPage.getByTestId('referral-reject').click();
  await supervisorPage.getByTestId('referral-confirm').click();
  await expect(supervisorPage.locator('.validation-message').first()).toBeVisible();
  await expect(view.status()).toHaveText('Submitted');

  await supervisorPage.getByTestId('referral-remarks').fill('Outside service area.');
  await supervisorPage.getByTestId('referral-confirm').click();
  await expect(view.status()).toHaveText('Rejected');
  await supervisorPage.context().close();
});
