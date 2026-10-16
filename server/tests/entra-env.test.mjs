// The Entra ID variables were AZURE_AUTHORITY_URI and AZURE_GRAPH_URI before 7.3 : the new
// ENTRA_* names are read first, the old ones still work until 8.0, with a warning at start.
import { describe, test, expect } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { entraEnv, entraEnvWarnings, ENTRA_ENV_ALIASES } = await import("../config/auth.config.js");
const authConfig = (await import("../config/auth.config.js")).default;
const Env = (await import("../src/lib/envSettings.js")).default;

describe("the Entra ID environment variables", () => {
  test("the new name is read", () => {
    expect(entraEnv("ENTRA_AUTHORITY_URI", { ENTRA_AUTHORITY_URI: "https://login.microsoftonline.us" })).toBe("https://login.microsoftonline.us");
    expect(entraEnv("ENTRA_GRAPH_URI", { ENTRA_GRAPH_URI: "https://graph.microsoft.us" })).toBe("https://graph.microsoft.us");
    expect(entraEnvWarnings({ ENTRA_AUTHORITY_URI: "x", ENTRA_GRAPH_URI: "y" })).toEqual([]);
  });

  test("only the old name set: it is used, with a warning", () => {
    const env = { AZURE_AUTHORITY_URI: "https://login.chinacloudapi.cn", AZURE_GRAPH_URI: "https://microsoftgraph.chinacloudapi.cn" };
    expect(entraEnv("ENTRA_AUTHORITY_URI", env)).toBe("https://login.chinacloudapi.cn");
    expect(entraEnv("ENTRA_GRAPH_URI", env)).toBe("https://microsoftgraph.chinacloudapi.cn");
    expect(entraEnvWarnings(env)).toEqual([
      "AZURE_AUTHORITY_URI is deprecated, use ENTRA_AUTHORITY_URI (removed in 8.0)",
      "AZURE_GRAPH_URI is deprecated, use ENTRA_GRAPH_URI (removed in 8.0)",
    ]);
  });

  test("both set: the new one wins, the old one is warned about", () => {
    const env = { ENTRA_AUTHORITY_URI: "https://new", AZURE_AUTHORITY_URI: "https://old" };
    expect(entraEnv("ENTRA_AUTHORITY_URI", env)).toBe("https://new");
    const [warning] = entraEnvWarnings(env);
    expect(warning).toMatch(/^AZURE_AUTHORITY_URI is deprecated, use ENTRA_AUTHORITY_URI \(removed in 8\.0\)/);
    expect(warning).toMatch(/ENTRA_AUTHORITY_URI is set too and wins/);
  });

  test("neither set: Microsoft's public cloud", () => {
    expect(entraEnv("ENTRA_AUTHORITY_URI", {})).toBe("https://login.microsoftonline.com");
    expect(entraEnv("ENTRA_GRAPH_URI", {})).toBe("https://graph.microsoft.com");
    expect(entraEnvWarnings({})).toEqual([]);
    expect(ENTRA_ENV_ALIASES).toEqual({ ENTRA_AUTHORITY_URI: "AZURE_AUTHORITY_URI", ENTRA_GRAPH_URI: "AZURE_GRAPH_URI" });
  });

  test("saved from the settings page: either name applies at once, the new one winning", () => {
    const saved = authConfig.entraGraphUrl;
    try {
      expect(Env.applyLive("AZURE_GRAPH_URI", "https://old.example")).toBe(true);
      expect(authConfig.entraGraphUrl).toBe("https://old.example");
      expect(Env.applyLive("ENTRA_GRAPH_URI", "https://new.example")).toBe(true);
      expect(authConfig.entraGraphUrl).toBe("https://new.example");
      // the old one saved again does not take over from the new one
      expect(Env.applyLive("AZURE_GRAPH_URI", "https://old2.example")).toBe(true);
      expect(authConfig.entraGraphUrl).toBe("https://new.example");
      // the new one cleared : the old one again
      Env.applyLive("ENTRA_GRAPH_URI", "", "https://graph.microsoft.com");
      expect(authConfig.entraGraphUrl).toBe("https://old2.example");
    } finally {
      delete process.env.ENTRA_GRAPH_URI;
      delete process.env.AZURE_GRAPH_URI;
      authConfig.entraGraphUrl = saved;
    }
  });
});
