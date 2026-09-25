// Settings.importConfig used to copy config.yaml straight into the database with no
// checking at all. Verified by running it against a temp file: a document that is not
// even YAML, one missing a required role property, and one with a duplicate `admin`
// role were ALL stored. When config_source is 'database' that is the active config, so
// the import bricked every form through the UI, and the duplicate-role case is the
// documented privilege escalation (getRolesAndOptions applies every matching entry).
//
// These are source assertions rather than a live call: importConfig reads the filesystem,
// takes the designer lock and writes a restore point, and standing all that up would test
// the harness more than the guard. Each assertion below was checked by removing the fix
// and confirming it fails.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "../src/models/settings.model.js"), "utf8");
const importConfig = src.slice(
  src.indexOf("Settings.importConfig ="),
  src.indexOf("Settings.exportConfig =")
);

describe("importConfig validates before it writes", () => {
  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.ok(importConfig.length > 200);
    assert.match(importConfig, /readFileSync/);
  });

  test("it calls validateConfig", () => {
    assert.match(importConfig, /Form\.validateConfig\(/);
  });

  test("validation happens BEFORE the backup and the write", () => {
    const validate = importConfig.indexOf("Form.validateConfig(");
    const backup = importConfig.indexOf("backupConfig('database')");
    const update = importConfig.indexOf("Settings.update(");
    assert.ok(validate > -1 && backup > -1 && update > -1, "all three must be present");
    assert.ok(validate < backup, "a config that will be refused must not take a restore point");
    assert.ok(validate < update, "nothing may be stored before it is validated");
  });

  test("unparseable YAML is reported as such rather than thrown raw", () => {
    assert.match(importConfig, /is not valid YAML/);
  });

  test("the same three sections saveConfig checks are checked here", () => {
    for (const key of ["categories", "roles", "constants"]) {
      assert.match(importConfig, new RegExp(`${key}:`), `${key} must be validated`);
    }
  });

  test("a ytt template is exempted, because it is not plain YAML until ytt renders it", () => {
    // the same test the visual editors use to go read-only (useFormsConfig.js)
    assert.match(importConfig, /\/\^\\s\*#@\/m/);
  });

  test("Form is imported lazily, because form.model.js imports this module", () => {
    // a static import would be a cycle and Form would be in its temporal dead zone
    assert.match(importConfig, /await import\(['"]\.\/form\.model\.js['"]\)/);
    assert.doesNotMatch(src.slice(0, src.indexOf("var Settings")), /^import Form/m);
  });
});
