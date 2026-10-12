// A smoke test of the pages a release must not break : each opens, shows what it is for, and
// logs no error. Lean on purpose - a broken page fails here in seconds, and the unit tests
// (npm run test) check the logic behind it.
import { test, expect, signIn } from './fixtures.mjs';

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('the forms page lists the forms', async ({ page }) => {
  await page.goto('/forms/all');
  // the forms menu, its All forms entry first
  await expect(page.getByText('All forms').first()).toBeVisible();
});

test.describe('a form that does not exist', () => {
  // the server answers 404, and the page says so in a toast too
  test.use({ allowConsole: [/No form with the address/] });

  test('shows the page title and a one-line alert', async ({ page }) => {
    await page.goto('/form/no-such-form-e2e');
    const title = page.locator('h3', { hasText: 'Form not found' });
    await expect(title).toBeVisible();
    await expect(title).toContainText('Forms');
    const alert = page.locator('.alert-danger', { hasText: 'could not be found' });
    await expect(alert).toBeVisible();
    // one line, as tall as its text : not stretched to the window's height
    const box = await alert.boundingBox();
    expect(box.height).toBeLessThan(120);
  });
});

test('the roles page lists admin and default', async ({ page }) => {
  await page.goto('/settings/roles');
  const rows = page.locator('tbody tr');
  await expect(rows.filter({ hasText: /^\s*admin\b/ }).first()).toBeVisible();
  await expect(rows.filter({ hasText: /\bdefault\b/ }).first()).toBeVisible();
});

test('the repositories page shows a Pull and a Push column', async ({ page }) => {
  await page.goto('/settings/repositories');
  const head = page.locator('thead');
  await expect(head.getByText('Pull', { exact: true })).toBeVisible();
  await expect(head.getByText('Push', { exact: true })).toBeVisible();
  await expect(head.getByText('Status', { exact: true })).toHaveCount(0);
});
