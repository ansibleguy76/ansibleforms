// Settings > Appearance > Announcements (models/announcement.model.js) : what a save keeps of an
// announcement, and which show now - started (or no start) and not ended (or no end).
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
const { announcementFields, isRunning, toDbMoment, MAX_MESSAGE } = await import("../src/models/announcement.model.js");

test("a new announcement: its message trimmed, info by default, its moments in UTC", () => {
  expect(announcementFields({ message: "  Maintenance Sunday 22:00 ", start_at: "2026-10-20T20:00:00.000Z", end_at: "2099-10-20T23:00:00+02:00" })).toEqual({
    message: "Maintenance Sunday 22:00",
    level: "info",
    enabled: 1,
    start_at: "2026-10-20 20:00:00",
    end_at: "2099-10-20 21:00:00",
  });
  expect(announcementFields({ message: "x", level: "danger" })).toMatchObject({ level: "danger", start_at: null, end_at: null });
  expect(announcementFields({ message: "y".repeat(600) }).message).toHaveLength(MAX_MESSAGE);
});

test("refused: no message, an unknown type, a date that is none, an end before its start or past", () => {
  expect(() => announcementFields({ message: "   " })).toThrow(/message/);
  expect(() => announcementFields({ message: "x", level: "loud" })).toThrow(/type/);
  expect(() => announcementFields({ message: "x", end_at: "not a date" })).toThrow(/date/);
  expect(() => announcementFields({ message: "x", start_at: "2099-10-21T00:00:00Z", end_at: "2099-10-20T00:00:00Z" })).toThrow(/after/);
  expect(() => announcementFields({ message: "x", end_at: "2020-01-01T00:00:00Z" })).toThrow(/future/);
});

test("an update writes only the fields given", () => {
  expect(announcementFields({ level: "warning" }, true)).toEqual({ level: "warning" });
  expect(announcementFields({ end_at: "" }, true)).toEqual({ end_at: null });
  expect(announcementFields({ enabled: false }, true)).toEqual({ enabled: 0 });
  expect(announcementFields({ enabled: true }, true)).toEqual({ enabled: 1 });
});

test("shown from its start until its end, each optional", () => {
  const now = Date.parse("2026-10-20T12:00:00Z");
  expect(isRunning({}, now)).toBe(true);
  expect(isRunning({ start_at: "2026-10-20 11:00:00", end_at: "2026-10-20 13:00:00" }, now)).toBe(true);
  expect(isRunning({ start_at: "2026-10-20 13:00:00" }, now)).toBe(false);
  expect(isRunning({ end_at: new Date("2026-10-20T12:00:00Z") }, now)).toBe(false);
  expect(isRunning({ start_at: new Date("2026-10-20T11:59:00Z") }, now)).toBe(true);
});

test("a moment as the database keeps it", () => {
  expect(toDbMoment(null)).toBeNull();
  expect(toDbMoment("")).toBeNull();
  expect(toDbMoment("2026-10-20T22:00:00+02:00")).toBe("2026-10-20 20:00:00");
});
