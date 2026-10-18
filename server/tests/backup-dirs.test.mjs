// The directory helpers of backup.model.js : copyDir follows symlinked folders
// (once, no loop) and skips broken links instead of failing the whole backup, and
// replaceDir REPLACES a forms folder on restore instead of merging into it, rolling
// back when the swap fails midway.
import { describe, test, expect, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.MANAGED_ENV_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "af-env-")), ".env");

const { copyDir, replaceDir, recordLinks } = await import("../src/models/backup.model.js");

// a fresh temp folder
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "af-dirs-"));

describe("copyDir", () => {
  test("copies a symlinked folder's content, skips a broken link, survives a loop", async () => {
    const src = tmp();
    const outside = tmp();
    fs.writeFileSync(path.join(src, "a.yaml"), "a");
    fs.writeFileSync(path.join(outside, "shared.yaml"), "shared");
    fs.symlinkSync(outside, path.join(src, "linked"));
    fs.symlinkSync(path.join(src, "nowhere"), path.join(src, "broken.yaml"));
    fs.symlinkSync(src, path.join(outside, "loop"));
    const dest = path.join(tmp(), "copy");
    await copyDir(src, dest);
    expect(fs.readFileSync(path.join(dest, "a.yaml"), "utf8")).toBe("a");
    expect(fs.readFileSync(path.join(dest, "linked", "shared.yaml"), "utf8")).toBe("shared");
    expect(fs.lstatSync(path.join(dest, "linked")).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(dest, "broken.yaml"))).toBe(false);
    // the loop back to src was not copied again
    expect(fs.existsSync(path.join(dest, "linked", "loop"))).toBe(false);
  });
});

describe("replaceDir", () => {
  test("forms created after the backup do not survive the restore", async () => {
    const backup = tmp();
    fs.writeFileSync(path.join(backup, "old.yaml"), "old");
    const target = path.join(tmp(), "forms");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "old.yaml"), "changed");
    fs.writeFileSync(path.join(target, "new.yaml"), "new");
    expect(await replaceDir(backup, target)).toBe(true);
    expect(fs.readdirSync(target)).toEqual(["old.yaml"]);
    expect(fs.readFileSync(path.join(target, "old.yaml"), "utf8")).toBe("old");
    // no staging or aside folder is left next to it
    expect(fs.readdirSync(path.dirname(target))).toEqual(["forms"]);
  });

  test("a missing backup folder leaves the target alone", async () => {
    const target = tmp();
    fs.writeFileSync(path.join(target, "keep.yaml"), "");
    expect(await replaceDir(path.join(tmp(), "none"), target)).toBe(false);
    expect(fs.readdirSync(target)).toEqual(["keep.yaml"]);
  });

  test("a symlinked target keeps its link, the folder behind it is replaced", async () => {
    const backup = tmp();
    fs.writeFileSync(path.join(backup, "b.yaml"), "b");
    const realDir = tmp();
    fs.writeFileSync(path.join(realDir, "x.yaml"), "x");
    const link = path.join(tmp(), "forms");
    fs.symlinkSync(realDir, link);
    await replaceDir(backup, link);
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readdirSync(realDir)).toEqual(["b.yaml"]);
  });

  test("a failed swap puts the previous folder back", async () => {
    const backup = tmp();
    fs.writeFileSync(path.join(backup, "b.yaml"), "b");
    const target = path.join(tmp(), "forms");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "current.yaml"), "c");
    const real = fs.promises.rename;
    let calls = 0;
    // the second rename (staging -> target) fails
    const spy = vi.spyOn(fs.promises, "rename").mockImplementation(async (a, b) => {
      calls++;
      if (calls === 2) throw Object.assign(new Error("boom"), { code: "EIO" });
      return real(a, b);
    });
    try {
      await expect(replaceDir(backup, target)).rejects.toThrow("boom");
    } finally {
      spy.mockRestore();
    }
    expect(fs.readdirSync(target)).toEqual(["current.yaml"]);
    expect(fs.readdirSync(path.dirname(target))).toEqual(["forms"]);
  });

  test("a folder that cannot be renamed (a mount point) has its content swapped", async () => {
    const backup = tmp();
    fs.writeFileSync(path.join(backup, "b.yaml"), "b");
    const target = path.join(tmp(), "forms");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "current.yaml"), "c");
    const real = fs.promises.rename;
    const spy = vi.spyOn(fs.promises, "rename").mockImplementation(async (a, b) => {
      if (a === target) throw Object.assign(new Error("busy"), { code: "EBUSY" });
      return real(a, b);
    });
    try {
      expect(await replaceDir(backup, target)).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(fs.readdirSync(target)).toEqual(["b.yaml"]);
    expect(fs.readdirSync(path.dirname(target))).toEqual(["forms"]);
  });
});

describe("the forms folder's symbolic links survive a backup and a restore", () => {
  // the backup copies what a link points to (copyDir follows it), and a restore used to put
  // that copy in its place : a shared folder linked into the forms became a stale copy of it

  /**
   * A forms folder beside a shared one : a relative link to that folder, an absolute link to a
   * file, a broken link, and a link inside a plain sub folder.
   *
   * Returns:
   *   object: { root, forms, shared }
   */
  function formsWithLinks() {
    const root = tmp();
    const forms = path.join(root, "forms");
    const shared = path.join(root, "shared");
    fs.mkdirSync(path.join(forms, "sub"), { recursive: true });
    fs.mkdirSync(shared);
    fs.writeFileSync(path.join(shared, "s.yaml"), "shared");
    fs.writeFileSync(path.join(forms, "own.yaml"), "own");
    fs.symlinkSync("../shared", path.join(forms, "linked"));
    fs.symlinkSync(path.join(shared, "s.yaml"), path.join(forms, "file.yaml"));
    fs.symlinkSync("nowhere.yaml", path.join(forms, "broken.yaml"));
    fs.symlinkSync("../../shared", path.join(forms, "sub", "deep"));
    return { root, forms, shared };
  }

  test("recorded as they are written, relative or absolute, broken ones too, nested ones by their path", async () => {
    const { forms, shared } = formsWithLinks();
    const links = (await recordLinks(forms)).sort((a, b) => a.path.localeCompare(b.path));
    expect(links).toEqual([
      { path: "broken.yaml", target: "nowhere.yaml" },
      { path: "file.yaml", target: path.join(shared, "s.yaml") },
      { path: "linked", target: "../shared" },
      { path: path.join("sub", "deep"), target: "../../shared" },
    ]);
    expect(await recordLinks(path.join(tmp(), "none"))).toEqual([]);
  });

  test("a restore makes them links again, and the folder keeps its mode", async () => {
    const { forms } = formsWithLinks();
    fs.chmodSync(forms, 0o2775);
    const links = await recordLinks(forms);
    const backup = path.join(tmp(), "forms");
    await copyDir(forms, backup);
    // something changed after the backup
    fs.writeFileSync(path.join(forms, "new.yaml"), "new");
    expect(await replaceDir(backup, forms, { links })).toBe(true);
    expect(fs.readlinkSync(path.join(forms, "linked"))).toBe("../shared");
    expect(fs.lstatSync(path.join(forms, "file.yaml")).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(path.join(forms, "broken.yaml"))).toBe("nowhere.yaml");
    expect(fs.readlinkSync(path.join(forms, "sub", "deep"))).toBe("../../shared");
    expect(fs.readFileSync(path.join(forms, "linked", "s.yaml"), "utf8")).toBe("shared");
    expect(fs.existsSync(path.join(forms, "new.yaml"))).toBe(false);
    expect(fs.statSync(forms).mode & 0o7777).toBe(0o2775);
  });

  test("a link whose target is gone keeps the backup's copy", async () => {
    const { forms, shared } = formsWithLinks();
    const links = await recordLinks(forms);
    const backup = path.join(tmp(), "forms");
    await copyDir(forms, backup);
    fs.rmSync(shared, { recursive: true, force: true });
    await replaceDir(backup, forms, { links });
    expect(fs.lstatSync(path.join(forms, "linked")).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(forms, "linked", "s.yaml"), "utf8")).toBe("shared");
  });

  test("a folder that cannot be renamed (a mount point) gets its links back too", async () => {
    const { forms } = formsWithLinks();
    const links = await recordLinks(forms);
    const backup = path.join(tmp(), "forms");
    await copyDir(forms, backup);
    const real = fs.promises.rename;
    const spy = vi.spyOn(fs.promises, "rename").mockImplementation(async (a, b) => {
      if (a === forms) throw Object.assign(new Error("busy"), { code: "EBUSY" });
      return real(a, b);
    });
    try {
      expect(await replaceDir(backup, forms, { links })).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(fs.readlinkSync(path.join(forms, "linked"))).toBe("../shared");
  });

  test("a path outside the folder in the list is ignored", async () => {
    const { forms } = formsWithLinks();
    const backup = path.join(tmp(), "forms");
    await copyDir(forms, backup);
    await replaceDir(backup, forms, { links: [{ path: "../escape", target: "/etc" }] });
    expect(fs.existsSync(path.join(path.dirname(forms), "escape"))).toBe(false);
  });
});
