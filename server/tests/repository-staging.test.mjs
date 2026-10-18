// New forms staged by the designer can sit in subfolders (a save keeps the form's
// relative path) : hasStagedForms must flag them and flushStagingInto must move
// them into the repository under the same relative path.
import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the repository working tree, per test
let repoDir;
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
vi.mock("../src/models/repo.model.js", () => ({
  default: { folderOf: () => repoDir, isValidName: () => true },
  repoFolder: () => repoDir,
}));

const appConfig = (await import("./__mocks__/app.config.js")).default;
const { default: Repository } = await import("../src/models/repository.model.js");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "af-staging-"));

beforeEach(() => {
  appConfig.formsStagingPath = tmp();
  repoDir = tmp();
});

describe("nested staged forms", () => {
  test("a form in a subfolder is flagged as staged", () => {
    expect(Repository.hasStagedForms()).toBe(false);
    fs.mkdirSync(path.join(appConfig.formsStagingPath, "team"));
    fs.writeFileSync(path.join(appConfig.formsStagingPath, "team", "deploy.yaml"), "name: x\n");
    expect(Repository.hasStagedForms()).toBe(true);
  });

  test("flushStagingInto keeps the relative path and empties the staging tree", () => {
    const staging = appConfig.formsStagingPath;
    fs.mkdirSync(path.join(staging, "team", "sub"), { recursive: true });
    fs.writeFileSync(path.join(staging, "top.yaml"), "a");
    fs.writeFileSync(path.join(staging, "team", "sub", "deep.yml"), "b");
    const moved = Repository.flushStagingInto("demo");
    expect(moved.sort()).toEqual([path.join("team", "sub", "deep.yml"), "top.yaml"]);
    expect(fs.readFileSync(path.join(repoDir, "team", "sub", "deep.yml"), "utf8")).toBe("b");
    expect(fs.readFileSync(path.join(repoDir, "top.yaml"), "utf8")).toBe("a");
    expect(fs.readdirSync(staging)).toEqual([]);
    expect(Repository.hasStagedForms()).toBe(false);
  });

  test("a collision leaves the nested form staged", () => {
    const staging = appConfig.formsStagingPath;
    fs.mkdirSync(path.join(staging, "team"));
    fs.writeFileSync(path.join(staging, "team", "x.yaml"), "new");
    fs.mkdirSync(path.join(repoDir, "team"));
    fs.writeFileSync(path.join(repoDir, "team", "x.yaml"), "existing");
    expect(Repository.flushStagingInto("demo")).toEqual([]);
    expect(fs.readFileSync(path.join(repoDir, "team", "x.yaml"), "utf8")).toBe("existing");
    expect(fs.existsSync(path.join(staging, "team", "x.yaml"))).toBe(true);
  });
});
