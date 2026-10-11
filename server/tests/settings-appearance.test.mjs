// Settings > Appearance : what a settings save keeps of the name, the environment
// label, the announcement and the forms list's view (models/settings.model.js) - each to what the
// page offers, an empty value none - and the announcement shown only while it runs.
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
vi.mock("../src/models/repository.model.js", () => ({ default: {} }));
vi.mock("../src/models/lock.model.js", () => ({ default: {} }));
vi.mock("../src/lib/forms-git.js", () => ({ configRepoFromPath: () => null }));
const { default: Settings } = await import("../src/models/settings.model.js");

test("a save keeps the appearance fields to what the page offers", () => {
  const s = new Settings({
    app_name: "  Ops Portal  ",
    env_label: "PRODUCTION",
    env_label_color: "red",
    banner_message: "Maintenance Sunday 22:00",
    banner_level: "warning",
    banner_until: "2026-10-20T22:00:00Z",
    forms_view: "list",
  });
  expect(s).toMatchObject({
    app_name: "Ops Portal",
    env_label: "PRODUCTION",
    env_label_color: "red",
    banner_message: "Maintenance Sunday 22:00",
    banner_level: "warning",
    banner_until: "2026-10-20 22:00:00",
    forms_view: "list",
  });
});

test("an empty or unknown value is none, a long one cut", () => {
  const s = new Settings({
    app_name: "   ",
    env_label: "X".repeat(60),
    env_label_color: "purple",
    banner_level: "loud",
    banner_until: "not a date",
    forms_view: "grid",
  });
  expect(s.app_name).toBeNull();
  expect(s.env_label).toHaveLength(40);
  expect(s.env_label_color).toBeNull();
  expect(s.banner_level).toBeNull();
  expect(s.banner_until).toBeNull();
  expect(s.forms_view).toBeNull();
});

test("a save of other fields leaves the appearance fields alone", () => {
  const s = new Settings({ url: "https://forms.example.com" });
  expect(Object.keys(s)).toEqual(["url"]);
});
