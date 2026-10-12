// fnRestAdvanced (and fnRestBasic, fnRestJwt, fnRestJwtSecure on top of it) with action
// "delete" used to call axios.post(url, config) : the config landed in the body slot, so
// the request went out as a POST and the custom headers (Authorization) were never sent.
// A local HTTP server records what actually arrives on the wire.
import { test, describe, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import http from "node:http";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { default: fn } = await import("../src/functions/default.js");

// the last request the server received : method, headers and raw body
let last = null;
let server;
let base;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      last = { method: req.method, headers: req.headers, body: raw };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ deleted: true }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("REST delete", () => {
  test("sends a DELETE with the custom headers", async () => {
    last = null;
    const result = await fn.fnRestAdvanced("delete", `${base}/items/1`, null, { Authorization: "Bearer abc", "X-Custom": "yes" });
    assert.equal(last.method, "DELETE");
    assert.equal(last.headers.authorization, "Bearer abc");
    assert.equal(last.headers["x-custom"], "yes");
    assert.equal(last.body, "");
    assert.deepEqual(result, { deleted: true });
  });

  test("sends the body along with the DELETE when one is given", async () => {
    last = null;
    await fn.fnRestAdvanced("delete", `${base}/items`, { ids: [1, 2] }, { Authorization: "Bearer abc" });
    assert.equal(last.method, "DELETE");
    assert.equal(last.headers.authorization, "Bearer abc");
    assert.deepEqual(JSON.parse(last.body), { ids: [1, 2] });
  });

  test("fnRestJwt delete carries the token", async () => {
    last = null;
    await fn.fnRestJwt("delete", `${base}/items/2`, null, "tok");
    assert.equal(last.method, "DELETE");
    assert.equal(last.headers.authorization, "Bearer tok");
  });
});
