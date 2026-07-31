// DB_POOL_SIZE is applied without a restart : mysql2 fixes connectionLimit when the pool
// is created, so a new size means a new pool and the old one is drained.
//
// The size used to be written into the shared poolConfig BEFORE createPool was called, so
// a createPool that threw left the config claiming a size the live pool did not have. The
// early "already this size" return then read that config, so the very next attempt at the
// same size answered `true` without creating anything - and the settings page reported
// DB_POOL_SIZE as applied while every query still went through the old pool.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.DB_POOL_SIZE = "20";

let created = [];
let failNext = false;
vi.mock("mysql2/promise", () => {
  const makePool = () => ({
    on() { return this; },
    end: async () => {},
    getConnection: async () => ({ query: async () => [[]], release() {}, destroy() {} }),
    query: async () => [[]],
  });
  return {
    default: {
      createPool: (cfg) => {
        if (failNext) { failNext = false; throw new Error("too many connections"); }
        created.push(cfg.connectionLimit);
        return makePool();
      },
    },
  };
});

const mysql = (await import("../src/models/db.model.js")).default;

beforeEach(() => { created = []; failNext = false; });

describe("resizing the pool", () => {
  test("a new size creates a new pool and reports success", () => {
    assert.equal(mysql.resizePool(30), true);
    assert.deepEqual(created, [30]);
  });

  test("the size already in force is a no-op that still reports success", () => {
    mysql.resizePool(31);
    created = [];
    assert.equal(mysql.resizePool(31), true);
    assert.deepEqual(created, [], "nothing to do, so nothing is created");
  });

  test("a rejected size is refused without touching the pool", () => {
    assert.equal(mysql.resizePool(0), false);
    assert.equal(mysql.resizePool(-1), false);
    assert.equal(mysql.resizePool("nonsense"), false);
    assert.deepEqual(created, []);
  });

  test("a FAILED resize does not make the next attempt claim success", () => {
    mysql.resizePool(40);              // establish a known size
    created = [];
    failNext = true;
    assert.equal(mysql.resizePool(50), false, "createPool threw, so the resize did not happen");
    assert.deepEqual(created, [], "and no pool was created");
    // the retry is the point: the config must still say 40, so 50 is still a CHANGE
    assert.equal(mysql.resizePool(50), true, "retrying the same size must actually resize");
    assert.deepEqual(created, [50], "a pool is created this time, rather than a bare 'already done'");
  });
});
