// The file a designer file section opens on (config/fileExplorer.js) : the first the explorer
// lists, folders before files, so Playbooks, Vars files and Inventories never open on nothing.

import { describe, it, expect } from 'vitest';
import { firstExplorerFile } from '@/config/fileExplorer';

describe('firstExplorerFile', () => {
  it('opens the first file in the explorer order : folders first, then files, by name', () => {
    expect(firstExplorerFile(['z.yaml', 'b/x.yaml', 'a.yaml'])).toBe('b/x.yaml');
    expect(firstExplorerFile(['b.yaml', 'a.yaml'])).toBe('a.yaml');
    expect(firstExplorerFile(['b/c/d.yaml', 'b/a.yaml'])).toBe('b/c/d.yaml');
  });

  it('opens only what it accepts', () => {
    const inventory = (p) => /\/inventory\.yaml$/.test(p);
    expect(firstExplorerFile(['prod/group_vars/all.yaml', 'prod/inventory.yaml'], inventory)).toBe(
      'prod/inventory.yaml',
    );
  });

  it('has none to open in an empty section', () => {
    expect(firstExplorerFile([])).toBeNull();
    expect(firstExplorerFile(undefined)).toBeNull();
  });
});
