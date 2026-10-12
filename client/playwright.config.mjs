// The browser tests (e2e/*.e2e.mjs) : Playwright drives a real Chromium against a running
// AnsibleForms - the built client served by the server, on a real database. CI's Browser job
// (.github/workflows/ci.yml) starts a fresh install for them ; locally, point them at any
// instance with E2E_BASE_URL, E2E_USERNAME and E2E_PASSWORD (see CONTRIBUTING.md).
//
// The specs end in .e2e.mjs, not .spec or .test, so vitest (npm run test) never picks them up.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.mjs',
  // one instance, one admin, one designer lock : the specs run one after the other
  workers: 1,
  fullyParallel: false,
  // CI retries once, and keeps the trace of the retry : a flake shows up as flaky, not red
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8000',
    // the dev server's certificate is self-signed
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1400, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 800 } } }],
});
