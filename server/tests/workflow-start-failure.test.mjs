// A workflow that cannot start (not found, invalid, nested too deep) is to end failed with its
// reason. It reached for its nodes' artifacts before it had read its nodes, the end itself threw
// ("Cannot access 'allArtifacts' before initialization"), and the job stayed running for ever,
// its output empty.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { runWorkflow } = await import("../src/models/workflowRun.js");

describe("a workflow that cannot start", () => {
  test("ends failed, with its reason and no artifacts", async () => {
    const Job = { lastOrder: vi.fn(async () => 3), endJobStatus: vi.fn(async () => {}), printJobOutput: vi.fn(async () => {}) };
    // nested too deep : refused before any file is read
    await expect(
      runWorkflow({ Job, form: "f", formObj: { workflow: "loop", __workflowDepth: 99 }, user: {}, extravars: {}, credentials: {}, jobid: 840 }),
    ).resolves.toBeUndefined();
    expect(Job.endJobStatus).toHaveBeenCalledTimes(1);
    const [jobid, order, stream, status, message, artifacts] = Job.endJobStatus.mock.calls[0];
    expect({ jobid, order, stream, status, artifacts }).toEqual({ jobid: 840, order: 4, stream: "stderr", status: "failed", artifacts: {} });
    expect(message).toMatch(/^\[ERROR\]: workflows nested \d+ deep/);
  });
});
