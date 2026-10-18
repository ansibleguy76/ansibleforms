// The designer's lock, address and save guards.
//
// Read from the page source, like the other designer tests : the guards live inside
// <script setup> closures that depend on the whole designer state.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'src/pages/designer.vue'), 'utf8');
const fnAt = (name, len) => src.slice(src.indexOf(name), src.indexOf(name) + len);

describe('the designer lock', () => {
  it('keeps every YAML editor read-only without the lock', () => {
    // they were read-only only for a templated config : losing the lock race left them editable
    const editors = src.match(/type="editor"\s*\n\s*:readonly="[^"]*"/g) || [];
    const yaml = editors.filter((e) => e.includes('canDesignForms'));
    expect(yaml.length).toBe(3);
    yaml.forEach((e) => expect(e).toMatch(/!lock\?\.match/));
  });

  it('reads the lock back when taking or releasing it fails', () => {
    expect(src).not.toMatch(/lock\.value = undefined;/);
    const set = src.slice(src.indexOf('async function setLock'), src.indexOf('async function restoreBackup'));
    expect(set).toMatch(/catch \(err\) \{[\s\S]*await loadLock\(\);/);
  });

  it('does not take back a lock an admin released', () => {
    const load = fnAt('async function loadLock', 1400);
    expect(load).toMatch(/lock\.value\?\.released/);
    expect(load).toMatch(/t\('designer\.lockReleasedBy'/);
  });
});

describe('the designer address', () => {
  it('Back and Forward open the form the address names', () => {
    const watcher = fnAt('() => route.path,', 1400);
    expect(watcher).toMatch(/address\.form/);
    expect(watcher).toMatch(/currentForm\.value = f\.id/);
  });
});

describe('saving the forms', () => {
  it('has an in-flight flag that keeps a second save out', () => {
    expect(src).toMatch(/const saving = ref\(false\);/);
    expect(src).toMatch(/const busy = computed\(\(\) => [^)]*saving\.value\)/);
    const save = fnAt('async function saveForms', 4000);
    expect(save).toMatch(/if \(busy\.value\) return;/);
    expect(save).toMatch(/saving\.value = true;/);
    expect(save).toMatch(/finally \{\s*saving\.value = false;/);
  });

  it('the Restore button leaves the confirm flow to restoreBackup', () => {
    expect(src).not.toMatch(/restoreBackup\(\);\s*resetAction\(\);/);
  });
});
