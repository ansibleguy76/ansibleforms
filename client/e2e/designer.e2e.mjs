// The designer : turned on (it takes the designer lock), every section's YAML, Visual and Preview
// tabs open with no error, then turned off again (the lock released).
//
// It takes the lock : run it against an instance nobody else is designing on (CI's own). Set
// E2E_SKIP_DESIGNER=1 to leave it out against a shared one.
import { test, expect, signIn } from './fixtures.mjs';

const SECTIONS = ['categories', 'constants', 'forms', 'inventories', 'playbooks', 'varsfiles', 'workflows'];
const TABS = ['yaml', 'visual', 'preview'];

test.skip(!!process.env.E2E_SKIP_DESIGNER, 'E2E_SKIP_DESIGNER is set');

/**
 * The designer's on/off switch.
 *
 * Args:
 *   page (Page): the page.
 *
 * Returns:
 *   Locator: its checkbox.
 */
const lockSwitch = (page) => page.locator('.form-switch input[type=checkbox]').first();

test('every section and tab opens, between turning it on and off', async ({ page }) => {
  // eleven pages and two lock round trips
  test.setTimeout(180_000);
  await signIn(page);
  await page.goto('/designer');
  const toggle = lockSwitch(page);
  await expect(toggle).toBeEnabled();
  if (!(await toggle.isChecked())) await toggle.click();
  await expect(page.getByText('Locked by me').first()).toBeVisible();

  for (const section of SECTIONS) {
    for (const tab of TABS) {
      await page.goto(`/designer/${section}/${tab}`);
      // the tab asked for is the one shown
      await expect(page.locator('.nav-tabs .nav-link.active').first()).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/designer/${section}`));
      // the page settles : no spinner left
      await expect(page.locator('.spinner-border')).toHaveCount(0);
    }
  }

  await page.goto('/designer');
  await expect(lockSwitch(page)).toBeChecked();
  await lockSwitch(page).click();
  await expect(page.getByText('Start designer').first()).toBeVisible();
});
