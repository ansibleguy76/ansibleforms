// The yaml walk shared by the form loader and the designer's delete pass
// (models/form.model.js walkYamlFiles) : an unreadable subfolder is skipped on its
// own, a symlinked folder is followed once (no loop), a broken link is reported.
import { describe, test, expect, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { walkYamlFiles } = await import("../src/models/form.model.js");

// a fresh forms folder per test
function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "af-walk-"));
}

describe("walkYamlFiles", () => {
  test("lists nested yaml files and skips .git and other extensions", () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, "a/b"), { recursive: true });
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "top.yaml"), "");
    fs.writeFileSync(path.join(root, "a/b/deep.yml"), "");
    fs.writeFileSync(path.join(root, "a/readme.txt"), "");
    fs.writeFileSync(path.join(root, ".git/x.yaml"), "");
    expect(walkYamlFiles(root, () => {}).sort()).toEqual([path.join("a", "b", "deep.yml"), "top.yaml"]);
  });

  test("follows a symlinked folder, once, even when it loops", () => {
    const root = tmp();
    const outside = tmp();
    fs.writeFileSync(path.join(outside, "shared.yaml"), "");
    fs.symlinkSync(outside, path.join(root, "linked"));
    // a link back up to the root : must not recurse forever
    fs.symlinkSync(root, path.join(outside, "loop"));
    const warnings = [];
    const files = walkYamlFiles(root, (m) => warnings.push(m));
    expect(files).toEqual([path.join("linked", "shared.yaml")]);
    expect(warnings.some((w) => /already visited/.test(w))).toBe(true);
  });

  test("a broken link is reported and skipped", () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, "ok.yaml"), "");
    fs.symlinkSync(path.join(root, "missing"), path.join(root, "broken.yaml"));
    const warnings = [];
    expect(walkYamlFiles(root, (m) => warnings.push(m))).toEqual(["ok.yaml"]);
    expect(warnings).toHaveLength(1);
  });

  // root ignores directory permissions, so this case cannot be staged there
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  test.skipIf(isRoot || process.platform === "win32")("an unreadable subfolder keeps the other files", () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, "ok.yaml"), "");
    const locked = path.join(root, "locked");
    fs.mkdirSync(locked);
    fs.writeFileSync(path.join(locked, "hidden.yaml"), "");
    fs.chmodSync(locked, 0o000);
    try {
      const warnings = [];
      expect(walkYamlFiles(root, (m) => warnings.push(m))).toEqual(["ok.yaml"]);
      expect(warnings.some((w) => /cannot be read/.test(w))).toBe(true);
    } finally {
      fs.chmodSync(locked, 0o755);
    }
  });

  test("an unreadable root throws, so the caller skips the folder", () => {
    expect(() => walkYamlFiles(path.join(tmp(), "nope"), () => {})).toThrow();
  });
});
