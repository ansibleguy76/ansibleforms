// The Default badge after the record the app picks (a type's default runner, the mail channel, the
// SSO provider, the main LDAP directory) : the shape of the other row badges (Required, Never signed
// in), dark grey with white text, so it does not read as a limit the way they do.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultNote } from '../src/config/settings.js';

const t = (key) => (key === 'settings.common.defaultNote' ? 'Default <b>' : key);

describe('defaultNote', () => {
  it('draws the Default badge in its own style, its label escaped', () => {
    expect(defaultNote(t, true)).toBe(' <span class="badge af-default-badge ms-2">Default &lt;b&gt;</span>');
  });

  it('draws nothing for a record that is not the default', () => {
    expect(defaultNote(t, false)).toBe('');
  });

  it('is dark grey with white text, in the shape of the Required badge', () => {
    const css = readFileSync(join(import.meta.dirname, '../src/styles/bootstrap-override.scss'), 'utf8');
    const rule = css.match(/\.af-default-badge \{([^}]*)\}/)?.[1] || '';
    expect(rule).toContain('background-color: var(--bs-secondary)');
    expect(rule).toContain('color: var(--bs-white)');
    expect(rule).toContain('font-weight: 600');
  });
});
