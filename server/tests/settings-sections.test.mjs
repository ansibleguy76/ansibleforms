// A part of the settings on its own (lib/settingsSections.js) : its api, and only its fields of the
// two endpoints every part writes through (the settings row, the environment variables).
import { describe, test, expect } from "vitest";
import {
  maySection, hasAllSettings, writableSettingsFields, readableSettingsFields, mayEnvVar, anySection,
} from "../src/lib/settingsSections.js";

const req = (options) => ({ user: { user: { username: "u", type: "local", options } } });

describe("settings sections", () => {
  test("showSettings: every part, every field, every variable", () => {
    const r = req({ showSettings: true });
    expect(hasAllSettings(r)).toBe(true);
    expect(maySection(r, "appearance")).toBe(true);
    expect(maySection(r, "connections")).toBe(true);
    expect(writableSettingsFields(r)).toBe(null);
    expect(readableSettingsFields(r)).toBe(null);
    expect(mayEnvVar(r, "ENTRA_AUTHORITY_URI")).toBe(true);
  });

  test("appearance on its own: its fields and variables, never the mail, the url or sign-in", () => {
    const r = req({ showAppearanceSettings: true });
    expect(maySection(r, "appearance")).toBe(true);
    expect(maySection(r, "connections")).toBe(false);
    const writable = writableSettingsFields(r);
    for (const f of ["app_name", "default_theme", "header_links"]) expect(writable.has(f)).toBe(true);
    // the environment label of before is the labels' first now (their own api)
    for (const f of ["url", "mail_server", "mail_password", "config_source", "env_label"]) expect(writable.has(f)).toBe(false);
    expect(mayEnvVar(r, "DEFAULT_LANGUAGE")).toBe(true);
    expect(mayEnvVar(r, "ENABLE_CHAT")).toBe(false);
  });

  test("connections on its own: reads the url, changes no row field, its variables only", () => {
    const r = req({ showConnectionsSettings: true });
    expect(maySection(r, "connections")).toBe(true);
    expect(maySection(r, "appearance")).toBe(false);
    expect(writableSettingsFields(r).size).toBe(0);
    expect(readableSettingsFields(r).has("url")).toBe(true);
    expect(readableSettingsFields(r).has("mail_password")).toBe(false);
    expect(mayEnvVar(r, "ENABLE_MCP")).toBe(true);
    expect(mayEnvVar(r, "SHOW_DESIGNER")).toBe(false);
  });

  test("no part: nothing", () => {
    const r = req({ showLogs: true });
    expect(anySection(r)).toBe(false);
    expect(maySection(r, "appearance")).toBe(false);
    expect(writableSettingsFields(r).size).toBe(0);
    expect(mayEnvVar(r, "DEFAULT_LANGUAGE")).toBe(false);
  });
});
