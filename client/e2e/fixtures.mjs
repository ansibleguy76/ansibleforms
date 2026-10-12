// What every browser test shares : a page that fails the test on any uncaught error or console
// error, and signing in.
import { test as base, expect } from '@playwright/test';

// The account the tests sign in with : CI's fresh install sets ADMIN_PASSWORD, so its admin
// never has to change the default password first
export const USERNAME = process.env.E2E_USERNAME || 'admin';
export const PASSWORD = process.env.E2E_PASSWORD || 'E2e-Browser-2026!';

// Console errors that are not the page's fault, each with why
const BENIGN = [
  // the browser's own line for an answer of 4xx/5xx : the tests check what the page does with
  // it (a not-found form answers 404 on purpose), and a real failure shows as a page error
  /Failed to load resource/,
];

/**
 * The test's page, watched : an uncaught error, or a console error not in BENIGN, fails the test
 * once it is done. A test that expects one (a not-found form) lists it with `allowConsole`.
 */
export const test = base.extend({
  // patterns of console errors a test expects
  allowConsole: [[], { option: true }],
  page: async ({ page, allowConsole }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`page error : ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if ([...BENIGN, ...allowConsole].some((re) => re.test(text))) return;
      errors.push(`console error : ${text}`);
    });
    await use(page);
    expect(errors, 'the page logged errors').toEqual([]);
  },
});
export { expect };

/**
 * Signs in with the local account, and waits for the forms page it lands on.
 *
 * Args:
 *   page (Page): the page.
 */
export async function signIn(page) {
  await page.goto('/login?local');
  await page.locator('input[type=text], input[name=username], #username').first().fill(USERNAME);
  await page.locator('input[type=password]').first().fill(PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
