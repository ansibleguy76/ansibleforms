// fillCredentialTypes runs on every boot (the patches re-run at each start). Up to 7.3 its
// WHERE clause wrote out the credential types of 7.0 (NOT IN ('userpass', ... 'oidc')), so a
// credential of any type added later - rte, awx, aap, ascender, semaphore, rundeck, jenkins,
// vault - was turned back into a userpass one at every start.
//
// Read as TEXT, like schema-manifest.test.mjs : the check is on the statement itself, against
// the type list the API validates with (Credential.TYPES), so a type added to the model later
// is covered without touching this test.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const model = readFileSync(path.join(here, "../src/models/schema.model.js"), "utf8");
const credentialModel = readFileSync(path.join(here, "../src/models/credential.model.v2.js"), "utf8");

// ── the type list the API accepts ───────────────────────────────────────────────────────
const typesBlock = /static TYPES = \[([\s\S]*?)\];/.exec(credentialModel)?.[1] || "";
const TYPES = [...typesBlock.matchAll(/'(\w+)'/g)].map((m) => m[1]);

// ── the WHERE clause of fillCredentialTypes' UPDATE ─────────────────────────────────────
const fn = /function fillCredentialTypes\(\) \{([\s\S]*?)\n\}/.exec(model)?.[1] || "";
const update = /"(UPDATE AnsibleForms\.`credentials` SET credential_type=[^"]*)"/.exec(fn)?.[1] || "";
const where = /WHERE (.*)$/.exec(update)?.[1] || "";

/**
 * Whether the WHERE clause selects a credential of the given type : a tiny evaluator for the
 * three forms this clause has ever taken (IS NULL, = '', NOT IN (...)), joined by OR. Any
 * other condition fails the test, so a new form has to be taught here first.
 *
 * Args:
 *   type (string|null): the credential's credential_type.
 *
 * Returns:
 *   boolean: true when the UPDATE would rewrite it.
 */
function selects(type) {
  return where.split(/\s+OR\s+/i).some((cond) => {
    const c = cond.trim();
    if (/^credential_type IS NULL$/i.test(c)) return type === null;
    if (/^credential_type = ''$/i.test(c)) return type === "";
    const notIn = /^credential_type NOT IN \((.*)\)$/i.exec(c);
    if (notIn) {
      const list = [...notIn[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
      return type !== null && !list.includes(type);
    }
    throw new Error(`fillCredentialTypes has a condition this test does not know: ${c}`);
  });
}

describe("fillCredentialTypes keeps every credential type", () => {
  test("the statement and the type list were found", () => {
    assert.ok(TYPES.length >= 18, `only found ${TYPES.length} credential types`);
    assert.ok(TYPES.includes("rte") && TYPES.includes("vault"), "the 7.3 types are in the model's list");
    assert.ok(where, "the WHERE clause of fillCredentialTypes was not found");
  });

  test("a credential of any type the API accepts survives it", () => {
    const reset = TYPES.filter((t) => selects(t));
    assert.deepEqual(reset, [], "credential types fillCredentialTypes turns back into userpass or database");
  });

  test("a credential without a type still gets one", () => {
    assert.equal(selects(null), true);
    assert.equal(selects(""), true);
  });
});
