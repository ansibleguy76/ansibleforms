// DELETE /api/v2/lock : only the lock's holder turns the designer off.
//
// The designer had a "force unlock" that deleted somebody else's lock and took it, dropping
// their unsaved work. The lock is now theirs until they release it : another user's release
// is answered 423 and the lock stays.
import { describe, test, expect, vi, beforeEach } from "vitest";

const status = vi.fn();
const del = vi.fn();
const force = vi.fn();
vi.mock("../src/models/lock.model.js", () => ({
  default: { status: (...a) => status(...a), delete: (...a) => del(...a), forceRelease: (...a) => force(...a) },
}));

const { default: lockController } = await import("../src/controllers/v2/lock.controller.js");

/** Runs the release endpoint as alice (an admin when roles say so) and returns the status code. */
async function release({ force = false, roles = [] } = {}) {
  let code = 200;
  const res = { json: () => res, status: (c) => ((code = c), res) };
  const req = { user: { user: { username: "alice", type: "local", roles } }, headers: {}, query: force ? { force: "true" } : {} };
  await lockController.delete(req, res);
  return code;
}

describe("releasing the designer lock", () => {
  beforeEach(() => {
    status.mockReset();
    del.mockReset();
    force.mockReset();
  });

  test("refuses somebody else's lock, and leaves it", async () => {
    status.mockResolvedValue({ lock: { username: "bsmith", type: "ldap" }, match: false, free: false });
    expect(await release()).toBe(423);
    expect(del).not.toHaveBeenCalled();
  });

  test("releases the holder's own lock, only while it is theirs", async () => {
    status.mockResolvedValue({ lock: { username: "alice", type: "local" }, match: true, free: false });
    expect(await release()).toBe(200);
    expect(del).toHaveBeenCalledWith({ username: "alice", type: "local", roles: [] }, { onlyMine: true });
  });

  test("an admin releases somebody else's lock, marked as released by them", async () => {
    status.mockResolvedValue({ lock: { username: "bsmith", type: "ldap" }, match: false, free: false });
    expect(await release({ force: true, roles: ["admin"] })).toBe(200);
    // not deleted : the holder's designer must learn it was released, not take it back
    expect(del).not.toHaveBeenCalled();
    expect(force).toHaveBeenCalledWith({ username: "alice", type: "local", roles: ["admin"] }, { username: "bsmith", type: "ldap" });
  });

  test("only an admin forces it", async () => {
    status.mockResolvedValue({ lock: { username: "bsmith", type: "ldap" }, match: false, free: false });
    expect(await release({ force: true, roles: ["designers"] })).toBe(403);
    expect(del).not.toHaveBeenCalled();
    expect(force).not.toHaveBeenCalled();
  });

  test("answers a free lock as released", async () => {
    status.mockResolvedValue({ free: true });
    expect(await release()).toBe(200);
  });
});
