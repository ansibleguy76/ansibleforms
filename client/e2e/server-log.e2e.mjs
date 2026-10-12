// The server log follows its new lines ; scrolled up, it offers to jump back to the latest
// (AppFollowButton, shared with a running job's output).
import { test, expect, signIn } from './fixtures.mjs';

test('scrolled up, Jump to latest takes the log back down', async ({ page }) => {
  // a short window : the log scrolls even on a fresh install's few lines
  await page.setViewportSize({ width: 1400, height: 500 });
  await signIn(page);
  await page.goto('/settings/server-log');
  const log = page.locator('#scroller');
  await expect(log.locator('.af-line-no').first()).toBeVisible();
  const follow = page.locator('.af-follow');
  // followed down to its end first (the box that scrolls is the card body around the log) :
  // a scroll before that would race the page's own
  await expect.poll(() => log.evaluate((el) => el.closest('.card-body')?.scrollTop || 0)).toBeGreaterThan(0);
  // at its end : following, no button
  await expect(follow).toHaveCount(0);
  await log.hover();
  await page.mouse.wheel(0, -5000);
  await expect(follow.getByRole('button')).toHaveText(/Jump to latest|New lines/);
  await follow.getByRole('button').click();
  await expect(follow).toHaveCount(0);
});
