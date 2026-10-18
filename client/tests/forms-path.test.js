// lib/formsPath.js : the forms list's addresses, /forms/all and /forms/<category>, and the
// category an address names, read back against the forms config's categories.
import { describe, it, expect } from 'vitest';
import {
  slugOf,
  legacySlugOf,
  findBySlug,
  formsPath,
  categoryFromPath,
  formPath,
  formFromPath,
} from '../src/lib/formsPath.js';

const categories = [
  { name: 'Default' },
  { name: 'Expressions', items: [{ name: 'Test1' }] },
  { name: 'Network Ops', items: [{ name: 'Café Débâcle' }] },
];

describe('the forms list addresses', () => {
  it('name a category in lower case, its words joined by a dash', () => {
    expect(slugOf('Network Ops')).toBe('network-ops');
    expect(slugOf('Café Débâcle')).toBe('cafe-debacle');
    expect(slugOf('  A/B & C  ')).toBe('a-b-c');
  });

  it('keep letters and digits of every script, not only Latin ones', () => {
    // these all came out empty : every such form had the address /form/
    expect(slugOf('日本語 フォーム')).toBe('日本語-フォーム');
    expect(slugOf('Сервер 1')).toBe('сервер-1');
    expect(slugOf('部署 / 网络')).toBe('部署-网络');
    // a kana with a voicing mark stays one character
    expect(slugOf('ガ')).toBe('ガ');
  });

  it('give a name without any letter or digit a percent-encoded address', () => {
    expect(slugOf('???')).toBe('%3F%3F%3F');
    // read back from the address (decoded or not), it is the same form
    expect(slugOf('%3F%3F%3F')).toBe('%3F%3F%3F');
    expect(formFromPath('???', [{ name: '???' }, { name: 'Other' }])).toBe('???');
    expect(formFromPath('%3F%3F%3F', [{ name: '???' }])).toBe('???');
  });

  it('are idempotent : the slug of a slug is that slug', () => {
    for (const name of ['Network Ops', 'Café Débâcle', '日本語 フォーム', '???', '100%']) {
      expect(slugOf(slugOf(name))).toBe(slugOf(name));
    }
    expect(formFromPath(slugOf('日本語 フォーム'), [{ name: '日本語 フォーム' }])).toBe('日本語 フォーム');
  });

  it('are /forms/all for every form, and a sub category under its parent', () => {
    expect(formsPath('')).toBe('/forms/all');
    expect(formsPath('Expressions')).toBe('/forms/expressions');
    expect(formsPath('Expressions/Test1')).toBe('/forms/expressions/test1');
  });

  it('read back to the category, by the names of the config', () => {
    expect(categoryFromPath('expressions/test1', categories)).toBe('Expressions/Test1');
    expect(categoryFromPath(['network-ops', 'cafe-debacle'], categories)).toBe('Network Ops/Café Débâcle');
    expect(categoryFromPath('all', categories)).toBe('');
    expect(categoryFromPath('', categories)).toBe('');
  });

  it('name no category for an address none has', () => {
    expect(categoryFromPath('missing', categories)).toBeNull();
    expect(categoryFromPath('expressions/missing', categories)).toBeNull();
  });

  it('read a category typed by its name, whatever its case', () => {
    expect(categoryFromPath('Expressions', categories)).toBe('Expressions');
    expect(categoryFromPath('EXPRESSIONS/Test1', categories)).toBe('Expressions/Test1');
    expect(categoryFromPath('Network Ops/Café Débâcle', categories)).toBe('Network Ops/Café Débâcle');
    expect(categoryFromPath('All', categories)).toBe('');
  });

  it('go there and back for every category', () => {
    for (const path of ['Default', 'Expressions/Test1', 'Network Ops/Café Débâcle']) {
      expect(categoryFromPath(formsPath(path).slice('/forms/'.length), categories)).toBe(path);
    }
  });

  it('give a form one address, whatever its categories', () => {
    expect(formPath('Approval demo')).toBe('/form/approval-demo');
    const forms = [{ name: 'Approval demo' }, { name: 'Test 1' }, { name: 'test-1' }];
    expect(formFromPath('approval-demo', forms)).toBe('Approval demo');
    expect(formFromPath('missing', forms)).toBeNull();
    // typed by its name, whatever its case
    expect(formFromPath('Approval-Demo', forms)).toBe('Approval demo');
    expect(formFromPath('Approval demo', forms)).toBe('Approval demo');
    // two forms that read the same : the one named exactly so
    expect(formFromPath('test-1', forms)).toBe('test-1');
  });
});

// slugOf keeps every letter now and reads a percent-encoded name back first : some names have
// another address than in 7.2, and the addresses of then (bookmarks, links) still work
describe('the addresses of 7.2', () => {
  it('are the 7.2 slugs : Latin letters and digits only', () => {
    expect(legacySlugOf('Straße')).toBe('stra-e');
    expect(legacySlugOf('Łódź Øresund')).toBe('odz-resund');
    expect(legacySlugOf('Network Ops')).toBe('network-ops');
    expect(legacySlugOf('日本語')).toBe('');
    // the addresses of today differ for these names
    expect(slugOf('Straße')).toBe('straße');
    expect(slugOf('Łódź Øresund')).toBe('łodz-øresund');
  });

  it('still open their form', () => {
    const forms = [{ name: 'Straße' }, { name: 'Æsir đ ı' }, { name: 'Other' }];
    expect(formFromPath('stra-e', forms)).toBe('Straße');
    expect(formFromPath('sir', forms)).toBe('Æsir đ ı');
    // the address of today too
    expect(formFromPath('straße', forms)).toBe('Straße');
    expect(formFromPath(slugOf('Æsir đ ı'), forms)).toBe('Æsir đ ı');
  });

  it('still open their category, at every level', () => {
    const cats = [{ name: 'Straße', items: [{ name: 'Łódź' }] }];
    expect(categoryFromPath('stra-e', cats)).toBe('Straße');
    expect(categoryFromPath('stra-e/odz', cats)).toBe('Straße/Łódź');
    expect(categoryFromPath('straße/łodz', cats)).toBe('Straße/Łódź');
  });

  it('come after the addresses of today', () => {
    // 'stra-e' is a form's address today and another's 7.2 address : today's wins
    const forms = [{ name: 'Straße' }, { name: 'Stra e' }];
    expect(formFromPath('stra-e', forms)).toBe('Stra e');
    // the exact name before the first of the same slug
    expect(findBySlug('test-1', [{ name: 'Test 1' }, { name: 'test-1' }]).name).toBe('test-1');
  });

  it('never match a name that had no 7.2 address', () => {
    // every name without a Latin letter or digit had the empty address in 7.2
    expect(formFromPath('', [{ name: '日本語' }])).toBeNull();
    expect(findBySlug('%3F', [{ name: '日本語' }])).toBeUndefined();
  });
});
