// The Basic header of a sign-in, read as RFC 7617 says (src/lib/basicCredentials.js).
//
// passport-http split the decoded credentials on every colon and kept the first two parts :
// a password with a colon in it reached the check cut short and never matched. The login page
// encoded Latin-1 (btoa), which a name or password outside it could not be sent in ; it now
// sends UTF-8, and the server reads UTF-8.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { parseBasicCredentials, Utf8BasicStrategy } from "../src/lib/basicCredentials.js";

// the header a client sends for these credentials, UTF-8 encoded as the login page does
const basic = (user, pass) => "Basic " + Buffer.from(`${user}:${pass}`, "utf8").toString("base64");

describe("parseBasicCredentials", () => {
  test("the password keeps every colon after the first", () => {
    assert.deepEqual(parseBasicCredentials(basic("admin", "a:b:c")), { scheme: "Basic", username: "admin", password: "a:b:c" });
  });

  test("UTF-8 names and passwords come back whole", () => {
    const parsed = parseBasicCredentials(basic("Łukasz", "pässwörd€日本"));
    assert.equal(parsed.username, "Łukasz");
    assert.equal(parsed.password, "pässwörd€日本");
  });

  test("the scheme is matched without regard to case, and extra spaces are allowed", () => {
    assert.equal(parseBasicCredentials("basic   " + Buffer.from("u:p").toString("base64")).username, "u");
  });

  test("another scheme has no credentials", () => {
    assert.deepEqual(parseBasicCredentials("Bearer abc"), { scheme: "Bearer" });
  });

  test("no header, no space or no colon reads as nothing", () => {
    assert.equal(parseBasicCredentials(""), null);
    assert.equal(parseBasicCredentials(undefined), null);
    assert.equal(parseBasicCredentials("Basic"), null);
    assert.equal(parseBasicCredentials("Basic " + Buffer.from("nocolon").toString("base64")), null);
  });
});

describe("Utf8BasicStrategy", () => {
  /**
   * Runs the strategy on a request as passport does, with its outcome methods attached.
   *
   * Args:
   *   header (string|undefined): the Authorization header.
   *   verify (Function): the verify function (username, password, done).
   *
   * Returns:
   *   Promise<object>: { outcome, value } : success, fail or error, and what it carried.
   */
  function run(header, verify) {
    return new Promise((resolve) => {
      const strategy = Object.create(new Utf8BasicStrategy(verify));
      strategy.success = (value) => resolve({ outcome: "success", value });
      strategy.fail = (value) => resolve({ outcome: "fail", value });
      strategy.error = (value) => resolve({ outcome: "error", value });
      strategy.authenticate({ headers: header === undefined ? {} : { authorization: header } });
    });
  }

  test("the verify function gets the whole password and the UTF-8 name", async () => {
    let seen;
    const result = await run(basic("José", "x:y:z"), (u, p, done) => {
      seen = [u, p];
      done(null, { username: u });
    });
    assert.deepEqual(seen, ["José", "x:y:z"]);
    assert.equal(result.outcome, "success");
  });

  test("no header is a challenge, a header without a colon is a 400", async () => {
    const never = () => assert.fail("verify must not run");
    assert.deepEqual(await run(undefined, never), { outcome: "fail", value: 'Basic realm="Users"' });
    assert.deepEqual(await run("Basic " + Buffer.from("x").toString("base64"), never), { outcome: "fail", value: 400 });
    assert.equal((await run("Bearer abc", never)).outcome, "fail");
    assert.equal((await run(basic("", "p"), never)).outcome, "fail");
  });

  test("a refusal or an error of the verify function is passport's", async () => {
    assert.equal((await run(basic("u", "p"), (u, p, done) => done(null, false))).outcome, "fail");
    assert.equal((await run(basic("u", "p"), (u, p, done) => done(new Error("Wrong password")))).outcome, "error");
  });
});
