// #1036 : a request whose headers are too large is refused by Node with 431 before the app sees
// it. The pages showed empty lists and nothing said why : one toast says so now, once per burst
// (a page loads several lists at once and they all fail alike).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const toasts = vi.hoisted(() => []);
vi.mock('vue-sonner', () => ({ toast: { error: (m, o) => toasts.push({ m, o }) } }));

const { notifyRequestTooLarge, resetRequestTooLarge, QUIET_MS } = await import('@/lib/requestTooLarge');
const here = path.dirname(fileURLToPath(import.meta.url));

beforeEach(() => {
  toasts.length = 0;
  resetRequestTooLarge();
});

describe('a request refused as too large (431)', () => {
  it('says so, in words, once for a burst of failing calls', () => {
    expect(notifyRequestTooLarge(1000)).toBe(true);
    for (let i = 1; i < 10; i++) expect(notifyRequestTooLarge(1000 + i * 100)).toBe(false);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].m).toMatch(/HTTP 431/);
    expect(toasts[0].m).toMatch(/group filter/);
    expect(toasts[0].o.id).toBe('request-too-large');
  });

  it('and again when it happens later', () => {
    notifyRequestTooLarge(1000);
    expect(notifyRequestTooLarge(1000 + QUIET_MS)).toBe(true);
    expect(toasts).toHaveLength(2);
  });

  it('the api interceptor calls it on a 431 and still hands the caller the error', () => {
    const app = readFileSync(path.join(here, '../src/App.vue'), 'utf8');
    expect(app).toMatch(/status === 431\) \{\s*notifyRequestTooLarge\(\);\s*throw error;/);
  });
});
