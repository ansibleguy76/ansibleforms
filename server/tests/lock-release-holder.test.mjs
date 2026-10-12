// DELETE /api/v2/lock : only the lock's holder turns the designer off.
//
// The designer had a "force unlock" that deleted somebody else's lock and took it, dropping
// their unsaved work. The lock is now theirs until they release it : another user's release
// is answered 423 and the lock stays.
import { describe, test, expect, vi, beforeEach } from "vitest";

const status = vi.fn();
const del = vi.fn();
vi.mock("../src/models/lock.model.js", () => ({
  default: { status: (...a) => status(...a), delete: (...a) => del(...a) },
}));

const { default: lockController } = await import("../src/controllers/v2/lock.controller.js");

/** Runs the release endpoint as alice and returns the status code it answered. */
async function release() {
  let code = 200;
  const res = { json: () => res, status: (c) => ((code = c), res) };
  await lockController.delete({ user: { user: { username: "alice", type: "local" } }, headers: {} }, res);
  return code;
}

describe("releasing the designer lock", () => {
  beforeEach(() => {
    status.mockReset();
    del.mockReset();
  });

  test("refuses somebody else's lock, and leaves it", async () => {
    status.mockResolvedValue({ lock: { username: "bsmith", type: "ldap" }, match: false, free: false });
    expect(await release()).toBe(423);
    expect(del).not.toHaveBeenCalled();
  });

  test("releases the holder's own lock, only while it is theirs", async () => {
    status.mockResolvedValue({ lock: { username: "alice", type: "local" }, match: true, free: false });
    expect(await release()).toBe(200);
    expect(del).toHaveBeenCalledWith({ username: "alice", type: "local" }, { onlyMine: true });
  });

  test("answers a free lock as released", async () => {
    status.mockResolvedValue({ free: true });
    expect(await release()).toBe(200);
  });
});
