// The golden fixtures of the shared form engine (server/tests/golden/formEngine), run here
// with the BROWSER's eval-based sandbox instead of node:vm - so a runLocal expression that
// the two sandboxes would evaluate differently fails a fixture - and with the extravars
// cross-checked against the browser's own Helpers.buildFormOutput.
import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import Helpers from '@/lib/Helpers.js';
import { resolveForm } from '@engine/resolve.js'; // eslint-disable-line no-restricted-imports
import { buildFormOutput } from '@engine/output.js';
import { loadFixtures, runFixture } from '../../server/tests/golden/formEngine/run.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = loadFixtures(path.join(here, '../../server/tests/golden/formEngine/fixtures'));

describe('form engine golden fixtures (browser sandbox)', () => {
  it.each(fixtures.map((fx) => [fx.file, fx]))('%s', async (_file, fx) => {
    const { actual, expected } = await runFixture(fx, {
      resolveForm,
      evalSandbox: Helpers.evalSandbox,
      buildFormOutput: (fields, raw, opts) => {
        const engine = buildFormOutput(fields, raw, opts);
        expect(engine).toEqual(Helpers.buildFormOutput(fields, raw, opts));
        return engine;
      },
    });
    expect(actual).toEqual(expected);
  });
});
