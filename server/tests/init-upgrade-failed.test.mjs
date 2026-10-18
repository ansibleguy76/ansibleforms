// The worker's bootstrap (init/index.js) on a schema whose upgrade did not complete. When the
// backup before the upgrade failed, the patches were skipped, yet the config seed still ran
// against the old schema : it failed on the first missing column and the process died with that
// seed error, which hid the real cause (the backup) and the UPGRADE_BACKUP=0 escape. The seed is
// skipped now, and the log names the cause.
import { test, describe, beforeEach, vi, expect } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// what the log said, by level
const logged = { error: [], warning: [] };
vi.mock("./__mocks__/logger.js", () => ({
  default: {
    notice: () => {},
    info: () => {},
    debug: () => {},
    warning: (m) => logged.warning.push(String(m)),
    error: (m) => logged.error.push(String(m)),
  },
}));
// a seed is configured ; the schema is never created here
vi.mock("./__mocks__/app.config.js", () => ({
  default: { configSeedPath: "/seed/seed.yaml", allowSchemaCreation: false, adminUsername: "admin", adminPassword: "x" },
}));

// how the schema check ends, per test
let schemaOutcome;
vi.mock("../src/models/schema.model.js", () => ({
  default: {
    isEmpty: async () => false,
    hasSchema: async () => schemaOutcome(),
  },
  importSsoEnvOnce: async () => "none",
}));
// the seed : counted, and failing as it did on the old schema
let seeds = 0;
vi.mock("../src/lib/seed.js", () => ({
  applyConfigSeed: async () => {
    seeds++;
    throw new Error("Unknown column 'credential' in 'field list'");
  },
}));
// the process exit : recorded, never done
const died = [];
vi.mock("../src/lib/die.js", () => ({ die: async (m) => died.push(m) }));

// the rest of the bootstrap : quiet stand-ins
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [{ 1: 1 }] } }));
vi.mock("../src/models/settings.model.js", () => ({ default: { getLogo: async () => "logo" } }));
vi.mock("../src/models/ssh.model.js", () => ({ default: { generate: async () => {} } }));
vi.mock("../src/models/form.model.js", () => ({ default: { initBackupFolder: () => {} } }));
vi.mock("../src/models/job.model.js", () => ({ default: {} }));
vi.mock("../src/models/repository.model.js", () => ({ default: { releaseStaleClaims: async () => 0, clone: async () => {} } }));
vi.mock("../src/models/schedule.model.js", () => ({ default: { releaseStale: async () => 0, launch: async () => {} } }));
vi.mock("../src/models/backup.model.js", () => ({ default: {} }));
vi.mock("../src/models/user.model.js", () => ({ default: { findByUsername: async () => ({ id: 1 }) } }));
vi.mock("../src/models/group.model.js", () => ({ default: { findByName: async () => ({ id: 1 }) } }));
vi.mock("../src/models/token.model.js", () => ({ default: {} }));
vi.mock("../src/services/cron.service.js", () => ({ default: { initializeAll: async () => {}, initializeSystemTasks: async () => {}, resync: async () => {} } }));
vi.mock("../src/lib/keyRotation.js", () => ({ rotateEncryptionKey: async () => ({}) }));
vi.mock("../src/secrets/importVaultEnv.js", () => ({ importVaultFromEnvOnce: async () => {} }));
vi.mock("../src/lib/syslogServers.js", () => ({ importSyslogFromEnvOnce: async () => {} }));
vi.mock("../src/lib/jobResume.js", () => ({ abandonAndResumeOnce: async () => ({ abandoned: 0 }) }));
vi.mock("../src/lib/workerLock.js", () => ({ confirmWorkerLock: async () => false }));
vi.mock("../src/lib/role.js", () => ({ nodeId: "test-node" }));

const { default: init } = await import("../src/init/index.js");

/**
 * The error checkAll throws when the patching failed, with its result.
 *
 * Args:
 *   failed (string[]): the failures.
 *   backupFailed (boolean): whether the backup before the upgrade was what failed.
 *
 * Returns:
 *   Error
 */
function patchingFailed(failed, backupFailed) {
  const err = new Error("Patching failed");
  err.result = { message: failed, data: { success: [], failed, backupFailed } };
  return err;
}

beforeEach(() => {
  logged.error.length = 0;
  logged.warning.length = 0;
  died.length = 0;
  seeds = 0;
});

describe("the bootstrap on a schema whose upgrade did not complete", () => {
  test("the backup failed: no seed, no seed error, the log names the backup and UPGRADE_BACKUP=0", async () => {
    schemaOutcome = async () => {
      throw patchingFailed(["The database needs upgrading, and the backup before it failed"], true);
    };
    expect(await init({ boot: true })).toBe(false);
    expect(seeds).toBe(0);
    expect(died).toEqual([]);
    expect(logged.error.some((m) => /Config seed failed/.test(m))).toBe(false);
    expect(logged.error.find((m) => /The database upgrade did not complete/.test(m))).toMatch(/backup before the upgrade failed.*UPGRADE_BACKUP=0/);
    expect(logged.error.find((m) => /The config seed was not applied/.test(m))).toMatch(/backup before the upgrade failed/);
  });

  test("a patch failed: no seed either, the log names the patch", async () => {
    schemaOutcome = async () => {
      throw patchingFailed(["Unknown column 'r.flavour'"], false);
    };
    expect(await init({ boot: true })).toBe(false);
    expect(seeds).toBe(0);
    expect(logged.error.find((m) => /The database upgrade did not complete/.test(m))).toMatch(/a patch failed \(Unknown column 'r\.flavour'\)/);
  });

  test("the schema up to date: the seed runs, and its own failure is still fatal", async () => {
    schemaOutcome = async () => ({ message: [], data: { success: [], failed: [] } });
    await init({ boot: true });
    expect(seeds).toBe(1);
    expect(died[0]).toMatch(/Config seed failed, refusing to start/);
  });
});
