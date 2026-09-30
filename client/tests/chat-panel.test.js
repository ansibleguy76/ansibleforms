// The chat panel (AppChat.vue). It reads the component source, like form-robustness :
// these are guards on what the panel may do, not on how it looks.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '../src/components/AppChat.vue'), 'utf8');
const app = readFileSync(path.join(here, '../src/App.vue'), 'utf8');

describe('the chat panel', () => {
  it('shows only for a logged-in user, with the chat enabled on the server, and allowChat not off', () => {
    expect(src).toMatch(/const visible = computed\(\(\) => store\.authenticated && store\.chatEnabled && store\.profile\?\.options\?\.allowChat !== false\)/);
    expect(src).toMatch(/<template v-if="visible">/);
    expect(app).toMatch(/<AppChat \/>/);
  });

  it('approves with the plan id only - never a payload the page could have changed', () => {
    expect(src).toContain("axios.post('/api/v2/chat/approve', { sessionId, planId: proposal.planId }, TokenStorage.getAuthentication())");
    expect(src).not.toMatch(/approve[^\n]*extravars/);
  });

  it('renders the model text only through the app html sanitizer', () => {
    expect(src).toMatch(/import \{ sanitize \} from '@\/lib\/HtmlSanitizer'/);
    expect(src).toMatch(/const render = \(text\) => sanitize\(converter\.makeHtml\(/);
    const vhtml = [...src.matchAll(/v-html="([^"]+)"/g)].map((m) => m[1]);
    expect(vhtml).toEqual(['render(e.text)']);
  });

  it('talks to the server only - no provider, no key in the browser', () => {
    expect(src).not.toMatch(/anthropic|openai|api[_-]?key/i);
    for (const url of src.matchAll(/axios\.post\('([^']+)'/g)) expect(url[1]).toMatch(/^\/api\/v2\/chat\//);
  });
});
