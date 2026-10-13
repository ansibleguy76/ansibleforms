// #1036 : Node refuses a request header larger than 16 KB with 431, before the request reaches
// the app, and the servers were created with that default. MAX_HTTP_HEADER_SIZE raises (or
// lowers) it for the web server, the RTE and the worker ; unset, Node's own limit applies, so a
// deployment that set NODE_OPTIONS=--max-http-header-size keeps it.
import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { maxHeaderSize, httpServerOptions } = await import("../src/lib/httpServerOptions.js");
const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let server = null;
afterEach(() => new Promise((resolve) => (server ? server.close(() => resolve()) : resolve())));

/**
 * Starts a server with the options for an environment and sends it one request with an
 * Authorization header of the given size.
 *
 * Args:
 *   env (object): the environment.
 *   bytes (number): the size of the Authorization header's value.
 *
 * Returns:
 *   Promise<number>: the status of the answer.
 */
async function statusFor(env, bytes) {
  server = http.createServer(httpServerOptions(env), (req, res) => res.end("ok"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/", headers: { authorization: `Bearer ${"a".repeat(bytes)}` } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
  });
}

describe("MAX_HTTP_HEADER_SIZE", () => {
  test("unset : Node's own limit, a 19 KB token is refused with 431", async () => {
    expect(httpServerOptions({})).toEqual({});
    expect(await statusFor({}, 14000)).toBe(200);
    expect(await statusFor({}, 19000)).toBe(431);
  });

  test("raised : the same request is accepted", async () => {
    expect(httpServerOptions({ MAX_HTTP_HEADER_SIZE: "65536" })).toEqual({ maxHeaderSize: 65536 });
    expect(await statusFor({ MAX_HTTP_HEADER_SIZE: "65536" }, 19000)).toBe(200);
  });

  test("a value that is no number in range is ignored : Node's own limit applies", () => {
    for (const v of ["", " ", "abc", "16k", "-1", "100", "99999999", "1.5"]) expect(maxHeaderSize(v)).toBeUndefined();
    expect(maxHeaderSize(" 32768 ")).toBe(32768);
  });

  test("every server of the app is created with it", () => {
    for (const file of ["src/app-start.js", "src/rte/server.js", "src/worker/server.js"]) {
      const src = readFileSync(path.join(serverRoot, file), "utf8");
      const creates = src.match(/https?\.createServer\([^)]*\)/g) || [];
      expect(creates.length, file).toBeGreaterThan(0);
      for (const c of creates) expect(c, `${file} : ${c}`).toMatch(/httpServerOptions\(\)|serverOptions/);
    }
  });

  test("documented, on the Server tab, applied at the next start, refused out of range", async () => {
    const help = yaml.parse(readFileSync(path.join(serverRoot, "help.yaml"), "utf8"));
    const doc = help.find((s) => s.name === "Environment Variables").items.find((e) => e.name === "MAX_HTTP_HEADER_SIZE");
    expect(doc).toBeTruthy();
    expect(doc.description).toMatch(/after a restart/);
    const settings = readFileSync(path.join(serverRoot, "../client/src/pages/admin/settings.vue"), "utf8");
    expect(settings).toMatch(/exact: \[[^\]]*'MAX_HTTP_HEADER_SIZE'/);
    const Env = (await import("../src/lib/envSettings.js")).default;
    expect(Env.classify("MAX_HTTP_HEADER_SIZE")).toBe("restart");
    expect(Env.validate("MAX_HTTP_HEADER_SIZE", "65536", doc)).toBeNull();
    expect(Env.validate("MAX_HTTP_HEADER_SIZE", "100", doc)).toMatch(/from 1024/);
    expect(Env.validate("MAX_HTTP_HEADER_SIZE", "abc", doc)).toMatch(/whole number/);
  });
});
