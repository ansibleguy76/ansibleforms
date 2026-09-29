// The stateless, dependency-ordered form resolution behind the MCP resolve_field tool.
import { describe, test, expect, vi } from "vitest";
import { resolveForm } from "../src/lib/formEngine/resolve.js";

const form = {
  name: "Create volume",
  fields: [
    { name: "cluster", type: "enum", runLocal: true, expression: "['c1','c2']", default: "__auto__", required: true },
    { name: "svm", type: "enum", runLocal: true, expression: "({c1:['s1','s2'], c2:['s3']})['$(cluster)']", required: true },
    { name: "volume_name", type: "text", default: "$(svm)_vol", required: true },
    { name: "size", type: "number", default: 10 },
    { name: "double", type: "number", default: "2 * $(size)", evalDefault: true },
    { name: "advanced", type: "checkbox" },
    { name: "advanced_opt", type: "text", required: true, dependencies: [{ name: "advanced", values: [true] }] },
    { name: "summary", type: "local", expression: "'$(svm)' + ':' + '$(volume_name)'" },
    { name: "upper", type: "expression", expression: "fn.upper('$(svm)')" },
    { name: "aggr", type: "enum", query: "select name from aggr where svm='$(svm)'", dbConfig: "db", valueColumn: "name" },
  ],
};

function services() {
  return {
    serverExpression: vi.fn(async (expr) => `server:${expr}`),
    query: vi.fn(async () => [{ name: "aggr1" }, { name: "aggr2" }]),
  };
}

const byName = (res) => Object.fromEntries(res.fields.map((f) => [f.name, f]));

describe("resolveForm", () => {
  test("with nothing filled in, the first choice is asked and what hangs off it waits", async () => {
    const res = await resolveForm({ form, services: services() });
    const f = byName(res);
    expect(f.cluster.options).toEqual(["c1", "c2"]);
    expect(f.cluster.value).toBe("__auto__");
    expect(f.cluster.needsInput).toBe(true);
    expect(f.svm.status).toBe("waiting");
    expect(f.svm.waitingFor).toEqual(["cluster"]);
    expect(f.volume_name.status).toBe("waiting");
    expect(f.double.value).toBe(20);
    expect(res.missing).toEqual(["cluster"]);
    expect(res.complete).toBe(false);
  });

  test("each answer unlocks the next level", async () => {
    const res = await resolveForm({ form, values: { cluster: "c1" }, services: services() });
    const f = byName(res);
    expect(f.svm.options).toEqual(["s1", "s2"]);
    expect(f.svm.needsInput).toBe(true);
    expect(f.volume_name.waitingFor).toEqual(["svm"]);
    expect(res.missing).toEqual(["svm"]);
  });

  test("a complete form : defaults, computed fields, queries and hidden fields", async () => {
    const svc = services();
    const res = await resolveForm({ form, values: { cluster: "c1", svm: "s1" }, services: svc });
    const f = byName(res);
    expect(f.volume_name.value).toBe("s1_vol");
    expect(f.volume_name.source).toBe("default");
    expect(f.advanced.value).toBe(false);
    expect(f.advanced_opt.visible).toBe(false);
    expect(f.advanced_opt.status).toBe("hidden");
    expect(f.summary.value).toBe("s1:s1_vol");
    expect(f.upper.value).toBe('server:fn.upper("s1")');
    expect(f.aggr.options).toEqual([{ name: "aggr1" }, { name: "aggr2" }]);
    // the query gets the raw placeholder map, never finished SQL
    expect(svc.query).toHaveBeenCalledWith(expect.objectContaining({ name: "aggr" }), { svm: "s1" });
    expect(res.complete).toBe(true);
    expect(res._values.summary).toBe("s1:s1_vol");
  });

  test("a field shown by its dependencies becomes required input", async () => {
    const res = await resolveForm({ form, values: { cluster: "c1", svm: "s1", advanced: true }, services: services() });
    const f = byName(res);
    expect(f.advanced_opt.visible).toBe(true);
    expect(f.advanced_opt.needsInput).toBe(true);
    expect(res.missing).toEqual(["advanced_opt"]);
  });

  test("a choice not among the options is flagged", async () => {
    const res = await resolveForm({ form, values: { cluster: "c1", svm: "s3" }, services: services() });
    expect(byName(res).svm.notInOptions).toBe(true);
    expect(res.warnings.some((w) => w.includes("'svm'"))).toBe(true);
  });

  test("a computed field ignores a value the caller sends for it", async () => {
    const res = await resolveForm({ form, values: { cluster: "c1", svm: "s1", summary: "forged" }, services: services() });
    expect(byName(res).summary.value).toBe("s1:s1_vol");
  });

  test("`only` resolves the field and what it depends on, nothing else", async () => {
    const svc = services();
    const res = await resolveForm({ form, values: { cluster: "c2" }, only: "svm", services: svc });
    expect(res.fields.map((f) => f.name)).toEqual(["cluster", "svm"]);
    expect(byName(res).svm.options).toEqual(["s3"]);
    expect(svc.query).not.toHaveBeenCalled();
    expect(svc.serverExpression).not.toHaveBeenCalled();
  });

  test("a failing server expression falls back to the default and says why", async () => {
    const svc = services();
    svc.serverExpression.mockRejectedValue(new Error("Abuse attempt"));
    const res = await resolveForm({
      form: { name: "f", fields: [{ name: "x", type: "expression", expression: "fn.a()", default: "dflt" }] },
      services: svc,
    });
    expect(res.fields[0]).toMatchObject({ status: "error", value: "dflt", error: "Abuse attempt" });
  });

  test("constants, varsFiles data and __user__ are readable, a same-named field wins", async () => {
    const res = await resolveForm({
      form: { name: "f", fields: [
        { name: "a", type: "local", expression: "'$(CONST)-$(varkey)-$(__user__.username)'" },
        { name: "CONST", type: "text", default: "field" },
      ] },
      constants: { CONST: "constant" },
      vars: { varkey: "v" },
      user: { username: "bob", roles: ["public"] },
      services: services(),
    });
    expect(byName(res).a.value).toBe("field-v-bob");
  });

  test("a circular reference does not hang the resolution", async () => {
    const res = await resolveForm({
      form: { name: "f", fields: [
        { name: "x", type: "expression", runLocal: true, expression: "'$(y)' + 'x'" },
        { name: "y", type: "expression", runLocal: true, expression: "'$(x)' + 'y'" },
      ] },
      services: services(),
    });
    expect(res.warnings.some((w) => w.includes("circular"))).toBe(true);
    expect(res.fields.every((f) => f.status !== "pending")).toBe(true);
  });

  test("an evalDefault value from the caller is a literal, not code", async () => {
    const res = await resolveForm({
      form: { name: "f", fields: [
        { name: "name", type: "text" },
        { name: "len", type: "number", default: "'$(name)'.length", evalDefault: true },
      ] },
      values: { name: "x'.length; this.constructor.constructor('return process')(); '" },
      services: services(),
    });
    expect(byName(res).len.value).toBe("x'.length; this.constructor.constructor('return process')(); '".length);
  });

  test("password values are never echoed back", async () => {
    const res = await resolveForm({
      form: { name: "f", fields: [{ name: "pw", type: "password", required: true }] },
      values: { pw: "s3cret" },
      services: services(),
    });
    expect(byName(res).pw.value).toBe("********");
    expect(res._values.pw).toBe("s3cret");
  });

  describe("choices are normalised to the option records (MCP beta feedback)", () => {
    const clusterForm = {
      name: "f",
      fields: [
        { name: "cluster", type: "enum", runLocal: true, required: true, valueColumn: "name",
          expression: "[{name:'bb8', management_ip:'172.16.56.1'},{name:'r2d2', management_ip:'172.16.56.2'}]" },
        { name: "svm", type: "enum", query: "select * from svm where ip='$(cluster.management_ip)'", dbConfig: "db" },
        { name: "volumes", type: "enum", multiple: true, required: true, valueColumn: "name",
          runLocal: true, expression: "[{name:'vol1', size:1},{name:'vol2', size:2}]" },
        { name: "plan", type: "local", expression: "$(volumes_json)" },
      ],
    };

    test("a valueColumn value becomes the whole record, so other columns resolve", async () => {
      const svc = services();
      const res = await resolveForm({ form: clusterForm, values: { cluster: "bb8", volumes: ["vol1"] }, services: svc });
      const f = byName(res);
      expect(f.cluster.value).toEqual({ name: "bb8", management_ip: "172.16.56.1" });
      expect(svc.query).toHaveBeenCalledWith(expect.objectContaining({ name: "svm" }), { "cluster.management_ip": "172.16.56.1" });
      expect(f.volumes.value).toEqual([{ name: "vol1", size: 1 }]);
      expect(res.invalid).toEqual([]);
    });

    test("a partial record becomes the whole record", async () => {
      const res = await resolveForm({ form: clusterForm, values: { cluster: { name: "r2d2" }, volumes: [{ name: "vol2" }] }, services: services() });
      expect(byName(res).cluster.value).toEqual({ name: "r2d2", management_ip: "172.16.56.2" });
      expect(byName(res).volumes.value).toEqual([{ name: "vol2", size: 2 }]);
    });

    test("a value that is no option makes the form incomplete", async () => {
      const res = await resolveForm({ form: clusterForm, values: { cluster: "bb8", volumes: ["vol1", "nope"] }, services: services() });
      expect(res.invalid).toEqual(["volumes"]);
      expect(res.complete).toBe(false);
    });

    test("without valueColumn a scalar matches the previewColumn, not the first key", async () => {
      const res = await resolveForm({
        form: { name: "f", fields: [{ name: "cluster", type: "enum", previewColumn: "name", columns: ["name", "management_ip"],
          values: [{ management_ip: "172.16.56.1", name: "bb8" }, { management_ip: "172.16.57.1", name: "r2d2" }] }] },
        values: { cluster: "bb8" },
        services: services(),
      });
      expect(byName(res).cluster.value).toEqual({ management_ip: "172.16.56.1", name: "bb8" });
      expect(res.invalid).toEqual([]);
    });

    test("a static enum is normalised the same way", async () => {
      const res = await resolveForm({
        form: { name: "f", fields: [{ name: "size", type: "enum", valueColumn: "id", values: [{ id: "s", gb: 10 }, { id: "m", gb: 50 }] }] },
        values: { size: "m" },
        services: services(),
      });
      expect(byName(res).size.value).toEqual({ id: "m", gb: 50 });
    });
  });
});

