// lib/jobCounts.js : the stored jobs and planned jobs counted for the users list - a stored job
// by its username, a schedule by the user it runs as (none for an admin's schedule).
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

// the rows are given : the database is never read
vi.mock("../src/models/crud.model.js", () => ({ default: { findAll: async () => [] } }));
const { withUserJobCounts } = await import("../src/lib/jobCounts.js");

test("a user counts its own stored jobs and the schedules that run as it, local ones only", async () => {
  const stored = [
    { username: "local/jane" },
    { username: "local/jane" },
    { username: "ldap/jane" },
    { username: "local/admin" },
  ];
  const schedules = [
    { owner: JSON.stringify({ type: "local", username: "jane" }) },
    { owner: JSON.stringify({ type: "azuread", username: "jane" }) },
    // an admin's schedule runs as no one, and one whose owner cannot be read neither
    { owner: null },
    { owner: "{not json" },
  ];
  const [jane, admin, bob] = await withUserJobCounts(
    [{ username: "jane" }, { username: "admin" }, { username: "bob" }],
    stored,
    schedules,
  );
  expect([jane.stored_job_count, jane.schedule_count]).toEqual([2, 1]);
  expect([admin.stored_job_count, admin.schedule_count]).toEqual([1, 0]);
  expect([bob.stored_job_count, bob.schedule_count]).toEqual([0, 0]);
});
