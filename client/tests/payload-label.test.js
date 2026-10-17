// What a form sends is "Extravars" on the job and form pages - Ansible's word -, "Payload" for a
// Rundeck job or form and "Parameters" for a Jenkins one : the label follows the type. The pages are read as text (no component is
// mounted in these tests), the strings from every locale.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(here, '..', p), 'utf8');
const LANGS = ['en', 'de', 'fr', 'it', 'es', 'nl', 'ca', 'pt', 'ja', 'zh', 'pl'];

describe('the payload label', () => {
  it('a Rundeck job says payload, a Jenkins job parameters, any other extravars, on the job page', () => {
    const jobs = read('src/pages/jobs.vue');
    expect(jobs).toMatch(
      /runner_kind === 'rundeck' \? 'payload' : job\.value\?\.runner_kind === 'jenkins' \? 'parameters' : 'extravars'/,
    );
    expect(jobs).toMatch(/payload: \{ show: 'jobs\.showPayload', hide: 'jobs\.hidePayload', title: 'jobs\.payload' \}/);
    expect(jobs).toMatch(
      /parameters: \{ show: 'jobs\.showParameters', hide: 'jobs\.hideParameters', title: 'jobs\.parameters' \}/,
    );
    expect(jobs).toMatch(
      /extravars: \{ show: 'jobs\.showExtravars', hide: 'jobs\.hideExtravars', title: 'jobs\.extravars' \}/,
    );
  });

  it('a Rundeck form says payload, a Jenkins form parameters, any other extravars, on the form page', () => {
    const form = read('src/pages/form.vue');
    expect(form).toMatch(/saysPayload = computed\(\(\) => currentForm\.value\?\.type === 'rundeck'\)/);
    expect(form).toMatch(/saysParameters = computed\(\(\) => currentForm\.value\?\.type === 'jenkins'\)/);
    expect(form).toMatch(
      /saysPayload\.value \? 'form\.payload' : saysParameters\.value \? 'form\.parameters' : 'form\.extraVars'/,
    );
  });

  it('every locale has the payload and parameters strings next to the extravars ones', async () => {
    for (const lang of LANGS) {
      const m = (await import(`../src/locales/${lang}.js`)).default;
      for (const sec of ['jobs', 'form']) {
        for (const k of ['showPayload', 'hidePayload', 'payload', 'showParameters', 'hideParameters', 'parameters'])
          expect(m[sec]?.[k], `${lang} ${sec}.${k}`).toBeTruthy();
        expect(m[sec]?.showExtravars, `${lang} ${sec}.showExtravars`).toBeTruthy();
      }
    }
  });
});
