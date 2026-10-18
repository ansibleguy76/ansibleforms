// A backup name comes straight from the restore URL : one without the
// '.bak.<timestamp>' suffix must be refused as a bad request (400), not crash with a
// TypeError (500).
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { default: Form } = await import("../src/models/form.model.js");
const { default: Errors } = await import("../src/lib/errors.js");

describe("backup name validation", () => {
  test.each(["bogus", "config.yaml.bak.123", "", undefined])("'%s' is a BadRequestError", (name) => {
    expect(() => Form.backupRoles(name)).toThrow(Errors.BadRequestError);
  });

  test("a well formed name passes the check", () => {
    // no such backup on disk : null, but no throw
    expect(Form.backupRoles("config.yaml.bak.20261018120000000")).toBeNull();
  });
});
