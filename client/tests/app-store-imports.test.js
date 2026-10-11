// The bundler keeps its own helpers (__commonJS, __toESM) in the chunk of the app store, which
// every page shares. The ace and vendor chunks call those helpers while they load. When the store
// imported axios, the store's chunk imported vendor, and app -> vendor -> ace -> app was a loop :
// ace ran before the helpers existed, "e is not a function", and the page stayed blank.
//
// So the store imports pinia and vue only - nothing that lands in the vendor or ace chunks.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '..', 'src/stores/app.js'), 'utf8');
const imports = [...src.matchAll(/^\s*import\b[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('the app store', () => {
  it('its imports were read, so the assertion below is not vacuous', () => {
    expect(imports).toContain('pinia');
  });

  it('imports pinia and vue only', () => {
    expect(imports.filter((m) => m !== 'pinia' && m !== 'vue')).toEqual([]);
  });
});
