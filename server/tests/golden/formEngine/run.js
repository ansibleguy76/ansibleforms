// Golden fixtures for the shared form engine : a form, the values filled in, the answers the
// server would give to its expressions and queries - and what must come out.
//
// Plain ESM with no test-runner import, so the server (vitest 5, node) and the client
// (vitest 4, happy-dom) run the very same fixtures through their own thin wrapper, each with
// its own sandbox : node:vm on the server, the browser's eval-based one in the client.
import fs from 'fs';
import path from 'path';

export function loadFixtures(dir) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => ({ file, ...JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) }));
}

/**
 * Run one fixture.
 * @returns {{ actual: object, expected: object }} only the keys the fixture pins down :
 *   `visibility` and `values` per listed field, `warnings` by substring, the rest whole.
 */
export async function runFixture(fx, { resolveForm, buildFormOutput, evalSandbox }) {
  const unstubbed = [];
  const stubs = fx.stubs || {};
  const services = {
    evalSandbox,
    serverExpression: async (expression) => {
      if (!Object.prototype.hasOwnProperty.call(stubs.expressions || {}, expression)) {
        unstubbed.push(`expression ${expression}`);
        throw new Error('no stub');
      }
      return structuredClone(stubs.expressions[expression]);
    },
    query: async (field) => {
      if (!Object.prototype.hasOwnProperty.call(stubs.queries || {}, field.name)) {
        unstubbed.push(`query of ${field.name}`);
        throw new Error('no stub');
      }
      return structuredClone(stubs.queries[field.name]);
    },
  };
  const res = await resolveForm({
    form: structuredClone(fx.form),
    constants: fx.constants || {},
    vars: fx.vars || {},
    user: fx.user,
    parent: fx.parent || undefined,
    values: structuredClone(fx.values || {}),
    services,
  });
  // an engine error is swallowed into a field status ; a missing stub must fail the fixture
  if (unstubbed.length) throw new Error(`fixture '${fx.name}' has no stub for : ${unstubbed.join(', ')}`);

  const validation = {};
  for (const f of res.fields) if (f.validationErrors?.length) validation[f.name] = f.validationErrors;
  const all = {
    visibility: res._visibility,
    values: res._values,
    validation,
    invalid: res.invalid,
    rowErrors: res.rowErrors,
    missing: res.missing,
    waiting: res.waiting,
    extravars: buildFormOutput(res._fields, res._values, {
      isVisible: (f) => res._visibility[f.name],
      subforms: fx.form.subforms || [],
    }),
    warnings: res.warnings,
  };

  const expected = fx.expect || {};
  const actual = {};
  for (const key of Object.keys(expected)) {
    if (key === 'visibility' || key === 'values') {
      actual[key] = Object.fromEntries(Object.keys(expected[key]).map((n) => [n, all[key][n]]));
    } else if (key === 'warnings') {
      actual[key] = expected.warnings.filter((w) => all.warnings.some((a) => a.includes(w)));
    } else {
      actual[key] = all[key];
    }
  }
  // JSON round trip : `undefined` values compare as absent on both sides
  return { actual: JSON.parse(JSON.stringify(actual)), expected: JSON.parse(JSON.stringify(expected)) };
}
