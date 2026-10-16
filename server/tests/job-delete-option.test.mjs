// Deleting jobs is a role option (allowJobDeletion) : a role that turns it off deletes no job, its
// own included, and is refused before anything is looked up.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

vi.mock("../src/models/db.model.js", () => ({ default: { do: vi.fn(async () => { throw new Error("no database in this test"); }) } }));

const { default: Job } = await import("../src/models/job.model.js");

describe("allowJobDeletion", () => {
  test("off: refused, the database never asked", async () => {
    const user = { username: "u", type: "local", roles: ["admin"], options: { allowJobDeletion: false } };
    await expect(Job.delete(user, 1)).rejects.toMatchObject({ name: "AccessDeniedError" });
  });

  test("on (or unset): it goes on to the job itself", async () => {
    const user = { username: "u", type: "local", roles: [], options: { allowJobDeletion: true } };
    await expect(Job.delete(user, 1)).rejects.not.toMatchObject({ name: "AccessDeniedError" });
  });
});

const { managesAllJobs, seesAllJobs } = await import("../src/models/job.model.js");

describe("manageAllJobs", () => {
  test("an admin, or the option, acts on every user's jobs", () => {
    expect(managesAllJobs({ roles: ["admin"], options: {} })).toBe(true);
    expect(managesAllJobs({ roles: [], options: { manageAllJobs: true } })).toBe(true);
    expect(managesAllJobs({ roles: [], options: { showAllJobLogs: true } })).toBe(false);
    expect(managesAllJobs({ roles: [], options: {} })).toBe(false);
  });

  test("acting on every job means seeing every job", () => {
    expect(seesAllJobs({ roles: [], options: { manageAllJobs: true } })).toBe(true);
    expect(seesAllJobs({ roles: [], options: { showAllJobLogs: true } })).toBe(true);
    expect(seesAllJobs({ roles: [], options: {} })).toBe(false);
  });
});
