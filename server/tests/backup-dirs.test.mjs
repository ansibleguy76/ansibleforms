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

const { copyDir, replaceDir } = await import("../src/models/backup.model.js");

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
