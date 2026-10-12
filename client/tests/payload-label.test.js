// What a form sends is "Extravars" on the job and form pages - Ansible's word - and "Payload" for a
// Rundeck job or form : the label follows the type. The pages are read as text (no component is
// mounted in these tests), the strings from every locale.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(here, '..', p), 'utf8');
const LANGS = ['en', 'de', 'fr', 'it', 'es', 'nl', 'ca', 'pt', 'ja', 'zh', 'pl'];

describe('the payload label', () => {
  it('a Rundeck job, and only a Rundeck job, says payload on the job page', () => {
    const jobs = read('src/pages/jobs.vue');
    expect(jobs).toMatch(/saysPayload = computed\(\(\) => job\.value\?\.runner_kind === 'rundeck'\)/);
    expect(jobs).toMatch(/saysPayload \? 'jobs\.payload' : 'jobs\.extravars'/);
  });

  it('a Rundeck form, and only a Rundeck form, says payload on the form page', () => {
    const form = read('src/pages/form.vue');
    expect(form).toMatch(/saysPayload = computed\(\(\) => currentForm\.value\?\.type === 'rundeck'\)/);
    expect(form).toMatch(/saysPayload\.value \? 'form\.payload' : 'form\.extraVars'/);
  });

  it('every locale has the payload strings next to the extravars ones', async () => {
    for (const lang of LANGS) {
      const m = (await import(`../src/locales/${lang}.js`)).default;
      for (const sec of ['jobs', 'form']) {
        for (const k of ['showPayload', 'hidePayload', 'payload'])
          expect(m[sec]?.[k], `${lang} ${sec}.${k}`).toBeTruthy();
        expect(m[sec]?.showExtravars, `${lang} ${sec}.showExtravars`).toBeTruthy();
      }
    }
  });
});
