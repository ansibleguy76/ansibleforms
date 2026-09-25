// 0 means KEEP EVERYTHING, in every retention setting this product has.
//
// They are four separate code paths and the value is easiest to get wrong when you can
// only see one at a time, which is why they are asserted together here. Three of them
// already agreed; OLD_BACKUP_DAYS did not - `old > days` with days=0 removed every config
// restore point more than a day old, so the one value an operator would reach for to mean
// "never prune" was the most destructive one available. It applies to the snapshots taken
// before each config-replacing write, which are the only way back from a bad import.
//
// The Status page had already committed to the rule in as many words - it prints
// 'restore points never' for 0, with the note "0 deletes nothing, for every one of these" -
// so the code was what was wrong, not the note. That claim is asserted here too: a page
// whose premise is never claiming an unearned fact must not be the thing that is lying.
import { test, describe, expect, vi, beforeEach, afterEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// The fixtures below are dated relative to a fixed day, but removeOld measures them
// against the real clock - so they aged with the calendar and the file went red on
// 2026-08-01, when the 60-day-old snapshot became 61 real days old and started being
// pruned. The clock is frozen instead, and the timezone pinned with it : removeOld
// parses the date part as LOCAL midnight, so under UTC+13 or further the same stamp
// is a day older than it reads. Both have to be set before the model is imported.
process.env.TZ = "UTC";
const NOW = Date.UTC(2026, 6, 31, 12);

// a backup folder holding snapshots of various ages
const removed = [];
let entries = [];
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: { ...actual.default, readdirSync: (p) => (String(p).includes("backup") ? entries : actual.default.readdirSync(p)) },
    readdirSync: (p) => (String(p).includes("backup") ? entries : actual.readdirSync(p)),
  };
});
vi.mock("fs-extra", () => ({
  default: {
    removeSync: (p) => removed.push(String(p).split("/").pop()),
    ensureDirSync: () => {}, copySync: () => {}, existsSync: () => false,
  },
}));

const Form = (await import("../src/models/form.model.js")).default;

// 'YYYYMMDDHHmmssSSS' - 17 digits, which is what removeOld filters on
function stamp(daysAgo) {
  const d = new Date(NOW - daysAgo * 86400000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}120000000`;
}

beforeEach(() => {
  // only Date is faked - the model uses no timers, and faking those would hang vitest
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  removed.length = 0;
  entries = [90, 61, 60, 30, 1, 0].map((n) => `config.yaml.bak.${stamp(n)}`);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OLD_BACKUP_DAYS", () => {
  test("0 keeps every restore point", () => {
    Form.removeOld(0);
    expect(removed, "0 must not be the most destructive value available").toEqual([]);
  });

  test("so does a nonsense or negative value", () => {
    for (const v of [null, "", "abc", -1, "0"]) {
      removed.length = 0;
      Form.removeOld(v);
      expect(removed, `${JSON.stringify(v)} should keep everything`).toEqual([]);
    }
  });

  test("but no argument at all still means the documented default of 60 days", () => {
    // `undefined` is the only value that triggers the default parameter, and that is the
    // right reading: it means the caller did not express an opinion, not "keep for ever".
    // The real caller always passes appConfig.oldBackupDays, which is 60 unless set.
    Form.removeOld();
    expect(removed.length).toBe(2);
  });

  test("a real retention still prunes what is older", () => {
    Form.removeOld(60);
    // strictly older than 60 days ; the 60-day-old one is kept
    expect(removed.length).toBe(2);
    expect(removed.every((f) => f.includes(stamp(90)) || f.includes(stamp(61)))).toBe(true);
  });

  test("and a short one prunes more, so the check is not simply switched off", () => {
    Form.removeOld(1);
    expect(removed.length).toBe(4);
  });
});

describe("the four retention settings agree with each other", () => {
  test("all of them treat 0 as keep for ever", async () => {
    // Job and Audit guard explicitly; the nightly backup sweep skips when it is not >= 1
    const jobSrc = (await import("fs")).readFileSync("src/models/job.model.js", "utf8");
    const auditSrc = (await import("fs")).readFileSync("src/models/audit.model.js", "utf8");
    const cronSrc = (await import("fs")).readFileSync("src/services/cron.service.js", "utf8");
    const formSrc = (await import("fs")).readFileSync("src/models/form.model.js", "utf8");
    expect(jobSrc).toMatch(/if \(!keep \|\| keep < 1\) return 0;/);
    expect(auditSrc).toMatch(/if \(!keep \|\| keep < 1\) return 0;/);
    expect(cronSrc).toMatch(/if \(!\(keepBackups >= 1\)\)/);
    expect(formSrc).toMatch(/if\(!\(keep >= 1\)\)/);
  });

  test("and the status page's note is true rather than aspirational", async () => {
    const health = (await import("fs")).readFileSync("src/models/health.model.js", "utf8");
    // it renders 'never' for 0 and says so in the detail - the code above has to match
    expect(health).toMatch(/Number\(n\) > 0 \? `\$\{n\} days` : 'never'/);
    expect(health).toMatch(/0 deletes nothing, for every one of these/);
    expect(health).toMatch(/configRestorePointDays: appConfig\.oldBackupDays/);
  });
});
