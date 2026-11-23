import { expect, test as setup } from '@playwright/test';
import { credentials, ROLES, storageStatePath } from './support/env';

// Signs in once per role and saves the session for the other tests to reuse.
// Works with the default O11 Reactive Login screen; data-testid attributes take
// precedence if they have been added.
for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    const { username, password } = credentials(role);

    const user = page.getByTestId('login-username').or(page.locator('#Input_UsernameVal'));
    const pass = page.getByTestId('login-password').or(page.locator('#Input_PasswordVal'));
    const submit = page.getByTestId('login-submit').or(page.getByRole('button', { name: /log\s?in/i }));

    await page.goto('Login');
    await user.fill(username);
    await pass.fill(password);
    await submit.click();

    await expect(page).not.toHaveURL(/\/Login/i);
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
