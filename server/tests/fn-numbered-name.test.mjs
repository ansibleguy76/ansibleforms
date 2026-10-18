// fnGetNumberedName, on the server (functions/default.js) and in the runLocal sandbox
// (lib/formEngine/node/sandbox.js) : numbers are sorted numerically and deduplicated,
// and 0 counts, so fillgap never suggests a name that is already taken.
import { describe, test, expect } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { default: fn } = await import("../src/functions/default.js");
const { evalSandbox } = await import("../src/lib/formEngine/node/sandbox.js");

// the same cases through both implementations
const viaServer = (names, fillgap) => fn.fnGetNumberedName(names, "vol_###", "x", fillgap);
const viaSandbox = (names, fillgap) =>
  evalSandbox(`fnGetNumberedName(${JSON.stringify(names)}, 'vol_###', 'x', ${fillgap})`);

describe.each([
  ["server", viaServer],
  ["sandbox", viaSandbox],
])("fnGetNumberedName (%s)", (_name, run) => {
  test("unsorted names : the gap is a free number", () => {
    // unsorted, the neighbour walk saw 001->003 as a gap and suggested the taken 002
    expect(run(["vol_001", "vol_003", "vol_002"], true)).toBe("vol_004");
    expect(run(["vol_005", "vol_001", "vol_003"], true)).toBe("vol_002");
  });

  test("duplicates do not invent gaps", () => {
    expect(run(["vol_001", "vol_001", "vol_002"], true)).toBe("vol_003");
  });

  test("0 is a taken number", () => {
    expect(run(["vol_000"], false)).toBe("vol_001");
    expect(run(["vol_000", "vol_002"], true)).toBe("vol_001");
  });

  test("no match keeps the given value, the next number otherwise", () => {
    expect(run(["other"], false)).toBe("x");
    expect(run(["vol_009", "vol_010"], false)).toBe("vol_011");
  });
});
