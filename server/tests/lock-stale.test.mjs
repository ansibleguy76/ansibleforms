// The designer lock left behind : a holder whose designer is not open any more (the browser
// closed, the computer shut down) leaves a lock nobody else could take. Their open designer
// asks for the lock every few seconds, which marks it seen ; a lock not seen for
// LOCK_STALE_SECONDS is released when it is next read.
import { describe, test, expect, vi, beforeEach } from "vitest";
import moment from "moment";

const db = vi.fn();
vi.mock("../src/models/db.model.js", () => ({ default: { do: (...a) => db(...a) } }));
vi.mock("../src/models/repository.model.js", () => ({ default: {} }));
vi.mock("../config/app.config.js", () => ({ default: { showDesigner: true } }));

const { default: Lock, LOCK_STALE_SECONDS } = await import("../src/models/lock.model.js");

const at = (secondsAgo) => moment().subtract(secondsAgo, "seconds").format("YYYY-MM-DD HH:mm:ss");
const row = (lock) => [{ data: JSON.stringify(lock) }];
const holder = { username: "alice", type: "local", options: { showDesigner: true } };

describe("a lock left behind", () => {
  beforeEach(() => db.mockReset());

  test("is released once not seen for LOCK_STALE_SECONDS, and reads as free", async () => {
    const lock = { username: "bob", type: "local", created: at(LOCK_STALE_SECONDS + 600) };
    db.mockImplementation(async (sql) => (String(sql).startsWith("SELECT") ? row(lock) : { affectedRows: 1 }));
    expect(await Lock.read()).toBeNull();
    const del = db.mock.calls.find(([sql]) => String(sql).startsWith("DELETE"));
    // only that very row : a holder who came back meanwhile keeps the lock
    expect(del[1]).toEqual([1, JSON.stringify(lock)]);
  });

  test("changed while it was released : read once more, never in a loop", async () => {
    const stale = { username: "bob", type: "local", created: at(LOCK_STALE_SECONDS + 600) };
    // the release deletes nothing (its holder came back) : the row as it is now is answered
    db.mockImplementation(async (sql) => (String(sql).startsWith("SELECT") ? row(stale) : { affectedRows: 0 }));
    expect(await Lock.read()).toEqual(stale);
    expect(db.mock.calls.filter(([sql]) => String(sql).startsWith("SELECT")).length).toBe(2);
  });

  test("is kept while its holder's designer is seen", async () => {
    const lock = { username: "bob", type: "local", created: at(3600), seen: at(20) };
    db.mockImplementation(async () => row(lock));
    expect(await Lock.read()).toEqual(lock);
    expect(db.mock.calls.some(([sql]) => String(sql).startsWith("DELETE"))).toBe(false);
  });

  test("written by hand, with no time, is never taken as left behind", async () => {
    db.mockImplementation(async () => [{ data: "not json" }]);
    expect(await Lock.read()).toEqual({});
  });
});

describe("the holder asking for the lock", () => {
  beforeEach(() => db.mockReset());

  test("marks it seen, only while it is theirs", async () => {
    const lock = { username: "alice", type: "local", created: at(120) };
    db.mockImplementation(async (sql) => (String(sql).startsWith("SELECT") ? row(lock) : { affectedRows: 1 }));
    expect((await Lock.status(holder)).match).toBe(true);
    const update = db.mock.calls.find(([sql]) => String(sql).startsWith("UPDATE"));
    expect(update[0]).toMatch(/JSON_EXTRACT\(data, '\$\.username'\)/);
    expect(JSON.parse(update[1][0]).seen).toBeTruthy();
  });

  test("does not write at every poll", async () => {
    const lock = { username: "alice", type: "local", created: at(600), seen: at(5) };
    db.mockImplementation(async () => row(lock));
    await Lock.status(holder);
    expect(db.mock.calls.some(([sql]) => String(sql).startsWith("UPDATE"))).toBe(false);
  });

  test("somebody else asking does not keep it", async () => {
    const lock = { username: "bob", type: "local", created: at(120) };
    db.mockImplementation(async () => row(lock));
    expect((await Lock.status(holder)).match).toBe(false);
    expect(db.mock.calls.some(([sql]) => String(sql).startsWith("UPDATE"))).toBe(false);
  });
});
