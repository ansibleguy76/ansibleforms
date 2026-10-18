// fnParseHtmlWithRegex used a hand-written exec() loop : a zero-length match with the g
// flag never advanced lastIndex and hung the process. It now runs matchAll (which steps
// past empty matches), keeps only the first match without the g flag, caps the number of
// matches and checks the URL against REST_ALLOWED_HOSTS / REST_DENIED_HOSTS before fetching.
// A local HTTP server serves the page.
import { test, describe, beforeAll, afterAll, afterEach } from "vitest";
import assert from "node:assert/strict";
import http from "node:http";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { default: fn } = await import("../src/functions/default.js");

// the page the server returns ; each test sets it
let page = "";
let hits = 0;
let server;
let base;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits++;
    res.setHeader("Content-Type", "text/html");
    res.end(page);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  delete process.env.REST_DENIED_HOSTS;
  delete process.env.REST_ALLOWED_HOSTS;
});

describe("fnParseHtmlWithRegex", () => {
  test("returns every match with its groups under the g flag", async () => {
    page = "<a href='x'>one</a><a href='y'>two</a>";
    const r = await fn.fnParseHtmlWithRegex(base, "<a href='(?<href>[^']+)'>([^<]+)</a>", "g");
    assert.equal(r.length, 2);
    assert.deepEqual(r[0].groups, ["x", "one"]);
    assert.equal(r[1].namedGroups.href, "y");
  });

  test("a zero-length match with the g flag terminates", async () => {
    page = "abc";
    const r = await fn.fnParseHtmlWithRegex(base, "x*", "g");
    // one empty match per position, end included
    assert.equal(r.length, 4);
    assert.ok(r.every((m) => m.fullMatch === ""));
  });

  test("without the g flag only the first match is returned", async () => {
    page = "<b>1</b><b>2</b>";
    const r = await fn.fnParseHtmlWithRegex(base, "<b>(\\d)</b>", "i");
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].groups, ["1"]);
  });

  test("the number of matches is capped", async () => {
    page = "a".repeat(20000);
    const r = await fn.fnParseHtmlWithRegex(base, "a", "g");
    assert.equal(r.length, 10000);
  });

  test("a URL refused by REST_DENIED_HOSTS is never fetched", async () => {
    page = "x";
    hits = 0;
    process.env.REST_DENIED_HOSTS = "127.0.0.1";
    await assert.rejects(fn.fnParseHtmlWithRegex(base, "x", "g"), /REST_DENIED_HOSTS/);
    assert.equal(hits, 0);
  });
});
