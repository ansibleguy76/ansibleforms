// A failing field must settle, and a form must launch once per click.
//
// Like form-robustness.test.js these read the component source rather than mounting it :
// the guards live inside <script setup> closures that depend on the whole form state.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(here, '..', p), 'utf8');

describe('a failing query or expression settles instead of retrying every tick', () => {
  // Both catch blocks used to put the status back to undefined (resetField, or
  // setFieldToDefault for a field without a default), so the very next tick fired the
  // failing request again, forever. Each attempt counted as progress, so the stall
  // watchdog never tripped either.
  const src = read('src/components/AppForm.vue');

  // every catch that follows a field request, in source order
  const catchBlocks = () => {
    const out = [];
    const re = /\} catch \((err|error)\) \{/g;
    let m;
    while ((m = re.exec(src))) out.push(src.slice(m.index, m.index + 900));
    return out.filter((b) => b.includes('queryerrors.value[item.name] ='));
  };

  it('marks the field with the terminal error status', () => {
    const blocks = catchBlocks();
    expect(blocks.length).toBe(3);
    blocks.forEach((b) => {
      expect(b).toMatch(/setFieldToError\(item\.name\)/);
      expect(b).not.toMatch(/resetField\(item\.name\)/);
    });
    const fn = src.slice(src.indexOf('function setFieldToError'), src.indexOf('function setFieldStatus('));
    expect(fn).toMatch(/setFieldStatus\(fieldname, 'error'\)/);
  });

  it('counts the error status as a ready dependency', () => {
    const fn = src.slice(src.indexOf('function isReadyDependency'), src.indexOf('function depsReady'));
    expect(fn).toMatch(/status === 'error'/);
  });

  it('drops a stale failure, like a stale success', () => {
    // the two request catches (not the local evaluation one) check the generation first
    const blocks = catchBlocks().filter((b) => /isCurrentGeneration/.test(b));
    expect(blocks.length).toBe(2);
    blocks.forEach((b) => {
      expect(b.indexOf('isCurrentGeneration')).toBeLessThan(b.indexOf('queryerrors.value[item.name] ='));
    });
  });
});

describe('one submit gate, and no double launch', () => {
  const appForm = read('src/components/AppForm.vue');
  const formPage = read('src/pages/form.vue');
  const fnAt = (src, name, len = 400) => src.slice(src.indexOf(name), src.indexOf(name) + len);

  it('the loop no longer runs its own initializing/stabilizing machine', () => {
    expect(appForm).not.toMatch(/status\.value == 'stabilizing'/);
    expect(appForm).not.toMatch(/emit\('submit',/);
  });

  it('both submit handlers refuse re-entry', () => {
    expect(fnAt(appForm, 'function handleSubmitAction')).toMatch(/if \(status\.value\) return;/);
    expect(fnAt(formPage, 'async function handleSubmitAction')).toMatch(/if \(status\.value !== ''\) return;/);
  });
});

describe('switching forms shows the form of the address', () => {
  const formPage = read('src/pages/form.vue');
  const fnAt = (name, len) => formPage.slice(formPage.indexOf(name), formPage.indexOf(name) + len);

  it('a reload closes every subform being edited', () => {
    expect(fnAt('async function reloadForm(', 700)).toMatch(/editStack\.splice\(0\)/);
  });

  it('another address starts from empty values', () => {
    expect(fnAt('() => route.params.slug,', 700)).toMatch(/form\.value = \{\}/);
  });

  it('only the newest load writes the page', () => {
    expect(fnAt('async function loadFormSafely()', 600)).toMatch(/const seq = \+\+loadSeq;/);
    const load = formPage.slice(
      formPage.indexOf('async function loadForm(seq'),
      formPage.indexOf('onMounted(async () =>'),
    );
    // every awaited answer is checked before it is used
    const awaits = load.match(/await (formNameOf|Form\.load|axios\.get)\(/g) || [];
    const checks = load.match(/if \(stale\(\)\) return;/g) || [];
    expect(awaits.length).toBeGreaterThan(0);
    expect(checks.length).toBeGreaterThanOrEqual(awaits.length);
  });
});
