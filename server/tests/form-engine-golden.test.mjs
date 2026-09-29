// The golden fixtures (tests/golden/formEngine) through the engine with the node sandbox.
// client/tests/form-engine-golden.test.js runs the same fixtures with the browser's sandbox.
import { describe, test, expect } from "vitest";
import { fileURLToPath } from "url";
import { loadFixtures, runFixture } from "./golden/formEngine/run.js";
import { resolveForm } from "../src/lib/formEngine/resolve.js";
import { buildFormOutput } from "../src/lib/formEngine/output.js";
import { evalSandbox } from "../src/lib/formEngine/node/sandbox.js";

const fixtures = loadFixtures(fileURLToPath(new URL("./golden/formEngine/fixtures", import.meta.url)));

describe("form engine golden fixtures (node)", () => {
  test.each(fixtures.map((fx) => [fx.file, fx]))("%s", async (_file, fx) => {
    const { actual, expected } = await runFixture(fx, { resolveForm, buildFormOutput, evalSandbox });
    expect(actual).toEqual(expected);
  });
});
