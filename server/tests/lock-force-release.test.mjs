// An admin's force release of the designer lock must stick.
//
// The release used to delete the row. The holder's open designer then read "free" right after
// holding it, took that for its own lock left behind (asleep past LOCK_STALE_SECONDS) and took
// it straight back - undoing the release within seconds. The row is now overwritten with a
// record of who released it : free for everyone, and its former holder is told by whom.
import { describe, test, expect, vi, beforeEach } from "vitest";
import moment from "moment";

const db = vi.fn();
vi.mock("../src/models/db.model.js", () => ({ default: { do: (...a) => db(...a) } }));
vi.mock("../src/models/repository.model.js", () => ({ default: { pullFormsRepositories: async () => {} } }));
vi.mock("../config/app.config.js", () => ({ default: { showDesigner: true } }));
vi.mock("../src/lib/liveEvents.js", () => ({ publish: () => {} }));

const { default: Lock } = await import("../src/models/lock.model.js");

const now = () => moment().format("YYYY-MM-DD HH:mm:ss");
const row = (lock) => [{ data: JSON.stringify(lock) }];
const admin = { username: "root", type: "local", displayName: "Root Admin", options: { showDesigner: true } };
const holder = { username: "alice", type: "local", options: { showDesigner: true } };
const other = { username: "bob", type: "local", options: { showDesigner: true } };
const record = () => ({
  released: true,
  holder: { username: "alice", type: "local" },
  releasedBy: { username: "root", type: "local", displayName: "Root Admin" },
  created: now(),
});

describe("an admin's force release", () => {
  beforeEach(() => db.mockReset());

  test("writes a release record instead of deleting the row", async () => {
    db.mockResolvedValue({ affectedRows: 1 });
    await Lock.forceRelease(admin, { username: "alice", type: "local" });
    const [sql, params] = db.mock.calls[0];
    expect(sql).toMatch(/^UPDATE/);
    const written = JSON.parse(params[0]);
    expect(written.released).toBe(true);
    expect(written.holder).toEqual({ username: "alice", type: "local" });
    expect(written.releasedBy.displayName).toBe("Root Admin");
  });

  test("reads as free for the background jobs and the Status page", async () => {
    db.mockImplementation(async () => row(record()));
    expect(await Lock.read()).toBeNull();
    expect(await Lock.isHeld()).toBe(false);
  });

  test("tells the former holder who released it", async () => {
    db.mockImplementation(async () => row(record()));
    expect(await Lock.status(holder)).toEqual({ free: true, released: { by: "Root Admin" } });
  });

  test("is plainly free for anybody else", async () => {
    db.mockImplementation(async () => row(record()));
    expect(await Lock.status(other)).toEqual({ free: true });
  });

  test("can be taken by anybody, over the record", async () => {
    // the INSERT finds the row there ; the UPDATE accepts a release record as free
    db.mockImplementation(async (sql) => (String(sql).startsWith("INSERT") ? { affectedRows: 0 } : { affectedRows: 1 }));
    await Lock.set({ ...other, options: { showDesigner: true } });
    const update = db.mock.calls.find(([sql]) => String(sql).startsWith("UPDATE"));
    expect(update[0]).toMatch(/\$\.released/);
  });
});
