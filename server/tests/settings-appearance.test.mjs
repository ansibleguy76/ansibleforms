// Settings > Appearance : what a settings save keeps of the name, the environment
// label, the announcement and the forms list's view (models/settings.model.js) - each to what the
// page offers, an empty value none - and the announcement shown only while it runs.
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
vi.mock("../src/models/repository.model.js", () => ({ default: {} }));
vi.mock("../src/models/lock.model.js", () => ({ default: {} }));
vi.mock("../src/lib/forms-git.js", () => ({ configRepoFromPath: () => null }));
const { default: Settings, isLinkUrl, validHeaderLinks, MAX_HEADER_LINKS } = await import("../src/models/settings.model.js");

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

test("a header link goes to an http or https site or a page of the app, nothing else", () => {
  for (const url of ["/forms/all", "/settings/general?x=1", "https://wiki.example.com/runbook", "http://intranet:8080/"]) {
    expect(isLinkUrl(url), url).toBe(true);
  }
  // another site through a path, a script, a data page, a space, no host
  for (const url of ["//evil.example.com", "/\\evil.example.com", "javascript:alert(1)", "JavaScript:alert(1)",
    "data:text/html,x", "https://a b", "http://", "ftp://files.example.com", "", "wiki"]) {
    expect(isLinkUrl(url), url).toBe(false);
  }
});

test("the header's links : a valid one kept, an invalid one left out, at most a few", () => {
  const links = validHeaderLinks([
    { label: "  Wiki ", url: "https://wiki.example.com", icon: "book", newTab: 1 },
    { label: "Evil", url: "javascript:alert(1)", icon: "bug" },
    { label: "", url: "/forms/all" },
    { label: "Jobs", url: "/jobs/all", icon: "<svg>" },
  ]);
  expect(links).toEqual([
    { label: "Wiki", url: "https://wiki.example.com", icon: "book", newTab: true },
    // an icon that is no icon's name : the link's own
    { label: "Jobs", url: "/jobs/all", icon: "link", newTab: false },
  ]);
  const many = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, url: `/p${i}` }));
  expect(validHeaderLinks(many)).toHaveLength(MAX_HEADER_LINKS);
  expect(validHeaderLinks("not json")).toEqual([]);
  // kept as JSON, none as null
  expect(new Settings({ header_links: [{ label: "Wiki", url: "/w" }] }).header_links).toBe(
    JSON.stringify([{ label: "Wiki", url: "/w", icon: "link", newTab: false }]),
  );
  expect(new Settings({ header_links: [] }).header_links).toBe(null);
});

test("a date format is one of those offered, anything else none", () => {
  expect(new Settings({ default_date_format: "DD/MM/YYYY" }).default_date_format).toBe("DD/MM/YYYY");
  expect(new Settings({ default_date_format: "<b>YYYY</b>" }).default_date_format).toBe(null);
  expect(new Settings({ default_date_format: "" }).default_date_format).toBe(null);
});
