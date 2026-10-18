// The RTE socket's pieces that need no socket : the addresses (rte/socket/protocol.js), a job's
// items kept on disk until acked (rte/socket/spool.js), the structured events read as the
// playbook writes them (rte/events.js), and the job files packed by the app and unpacked by the
// RTE (lib/jobFiles.js, rte/socket/files.js).
import { test, describe, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

const { socketUrl, inboundUrl, encode, decode } = await import("../src/rte/socket/protocol.js");
const { JobSpool } = await import("../src/rte/socket/spool.js");
const { createEventTail } = await import("../src/rte/events.js");
const { bundleOf, bundleByHash, readChunks } = await import("../src/lib/jobFiles.js");
const { FileCache } = await import("../src/rte/socket/files.js");

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "af-socket-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("the socket's addresses", () => {
  test("APP_URL as people know it becomes the app's socket", () => {
    assert.equal(socketUrl("https://forms.example.com"), "wss://forms.example.com/api/v2/rte/socket");
    assert.equal(socketUrl("https://forms.example.com/af/"), "wss://forms.example.com/af/api/v2/rte/socket");
    assert.equal(socketUrl("http://app:8000"), "ws://app:8000/api/v2/rte/socket");
    // the socket's path given already : kept as it is
    assert.equal(socketUrl("wss://x/api/v2/rte/socket"), "wss://x/api/v2/rte/socket");
    assert.throws(() => socketUrl("ftp://x"), /http or https/);
  });

  test("an inbound runner's address becomes the RTE's socket", () => {
    assert.equal(inboundUrl("http://rte:8000"), "ws://rte:8000/rte/v1/socket");
    assert.equal(inboundUrl("https://rte.dmz.local:8443/"), "wss://rte.dmz.local:8443/rte/v1/socket");
  });

  test("a frame without a type is not a message", () => {
    assert.deepEqual(decode(encode({ t: "ack", jobId: 1, seq: 2 })), { t: "ack", jobId: 1, seq: 2 });
    assert.equal(decode("{\"jobId\":1}"), null);
    assert.equal(decode("not json"), null);
  });
});

describe("a job's spool", () => {
  test("items are numbered, acked, and the file goes once the end is stored", () => {
    const sp = new JobSpool(dir, 7);
    sp.append({ kind: "output", record: { output: "a" } });
    sp.append({ kind: "output", record: { output: "b" } });
    sp.append({ kind: "end", status: "success" });
    assert.equal(sp.seq, 3);
    assert.equal(sp.get(2).record.output, "b");
    assert.equal(sp.ack(2), false, "the end is not acked yet");
    assert.equal(sp.ack(3), true, "everything acked and ended");
    sp.remove();
    assert.equal(fs.existsSync(path.join(dir, "job-7.jsonl")), false);
  });

  test("a restart resends what was not acked, from the file", () => {
    const sp = new JobSpool(dir, 9);
    for (let i = 1; i <= 5; i++) sp.append({ kind: "output", record: { output: `line ${i}` } });
    sp.ack(3);
    // a new process : the spool read back from its file
    const again = JobSpool.loadAll(dir);
    assert.equal(again.length, 1);
    assert.equal(again[0].jobId, 9);
    assert.equal(again[0].acked, 3);
    assert.equal(again[0].next, 4, "the next item to send is the first not acked");
    assert.equal(again[0].ended, false);
    assert.equal(again[0].get(5).record.output, "line 5");
  });

  test("a rewind after a reconnect sends again from the first item not acked", () => {
    const sp = new JobSpool(dir, 3);
    sp.append({ kind: "log", content: "x" });
    sp.append({ kind: "log", content: "y" });
    sp.next = 3;
    sp.ack(1);
    sp.rewind();
    assert.equal(sp.next, 2);
  });
});

describe("the structured events", () => {
  test("lines are read as the plugin writes them, in order, a cut line kept for later", async () => {
    const file = path.join(dir, "events.jsonl");
    const got = [];
    const tail = createEventTail({ file, write: async (batch) => got.push(...batch) });
    fs.writeFileSync(file, JSON.stringify({ type: "play", play: "p" }) + "\n" + JSON.stringify({ type: "task", task: "t" }) + "\n{\"type\":\"ok\"");
    await new Promise((r) => setTimeout(r, 700));
    fs.appendFileSync(file, ",\"host\":\"h1\"}\n" + JSON.stringify({ type: "stats", data: { h1: { ok: 1 } } }) + "\n");
    await tail.stop();
    assert.deepEqual(got.map((e) => [e.order, e.type]), [[1, "play"], [2, "task"], [3, "ok"], [4, "stats"]]);
    assert.equal(got[2].host, "h1");
    assert.equal(fs.existsSync(file), false, "the file goes once read");
  });
});

describe("the job files", () => {
  const tree = (root) => {
    fs.mkdirSync(path.join(root, "roles/web/tasks"), { recursive: true });
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    fs.writeFileSync(path.join(root, "site.yml"), "- hosts: all\n");
    fs.writeFileSync(path.join(root, "roles/web/tasks/main.yml"), "- debug: msg=hi\n");
    fs.writeFileSync(path.join(root, ".git/HEAD"), "ref: x\n");
    fs.writeFileSync(path.join(root, "extravars_12.json"), "{\"secret\":1}");
  };

  test("an unchanged folder keeps its hash, a changed one gets another", async () => {
    const root = path.join(dir, "playbooks");
    tree(root);
    const a = await bundleOf(root);
    const b = await bundleOf(root);
    assert.equal(a.hash, b.hash);
    fs.writeFileSync(path.join(root, "site.yml"), "- hosts: web\n");
    const c = await bundleOf(root);
    assert.notEqual(c.hash, a.hash);
    assert.equal(bundleByHash(c.hash).sha256, c.sha256);
    assert.equal(await bundleOf(path.join(dir, "none")), null);
  });

  test("the RTE receives a bundle in chunks, checks it and unpacks it - git and extravars left out", async () => {
    const root = path.join(dir, "src");
    tree(root);
    const b = await bundleOf(root);
    const cache = new FileCache(path.join(dir, "cache"));
    let asked = null;
    const ready = cache.ensure(b.hash, (h) => {
      asked = h;
      return true;
    });
    assert.equal(asked, b.hash);
    await readChunks(b.file, 64, async (buf, last) => cache.deliver({ hash: b.hash, data: buf.toString("base64"), last, sha256: last ? b.sha256 : undefined }));
    const folder = await ready;
    assert.equal(fs.readFileSync(path.join(folder, "site.yml"), "utf8"), "- hosts: all\n");
    assert.ok(fs.existsSync(path.join(folder, "roles/web/tasks/main.yml")));
    assert.equal(fs.existsSync(path.join(folder, ".git")), false);
    assert.equal(fs.existsSync(path.join(folder, "extravars_12.json")), false);
    // cached : not asked again
    assert.equal(cache.has(b.hash), true);
    assert.equal(await cache.ensure(b.hash, () => assert.fail("asked again")), folder);
  });

  test("a damaged bundle is refused", async () => {
    const root = path.join(dir, "src2");
    tree(root);
    const b = await bundleOf(root);
    const cache = new FileCache(path.join(dir, "cache2"));
    const ready = cache.ensure(b.hash, () => true);
    cache.deliver({ hash: b.hash, data: Buffer.from("not a tarball").toString("base64"), last: true, sha256: b.sha256 });
    await assert.rejects(ready, /damaged/);
    assert.equal(cache.has(b.hash), false);
  });
});
