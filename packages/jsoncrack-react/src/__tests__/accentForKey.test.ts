import { describe, expect, it } from "vitest";
import { ACCENT_POOL } from "../catppuccin";
import { ROOT_ACCENT, accentForKey, mixHex } from "../utils/accentForKey";

describe("accentForKey", () => {
  it("returns the same accent for the same key every time", () => {
    expect(accentForKey("scripts")).toBe(accentForKey("scripts"));
    expect(accentForKey("devEngines")).toBe(accentForKey("devEngines"));
  });

  it("always returns a name that is in the pool", () => {
    const keys = [
      "a",
      "author",
      "bugs",
      "scripts",
      "workspaces",
      "packageManager",
      "",
      "x".repeat(200),
    ];

    for (const key of keys) {
      expect(ACCENT_POOL).toContain(accentForKey(key));
    }
  });

  it("spreads a realistic set of keys across most of the pool", () => {
    const keys = [
      "name",
      "private",
      "license",
      "homepage",
      "author",
      "bugs",
      "scripts",
      "workspaces",
      "packageManager",
      "devEngines",
      "overrides",
      "runtime",
      "dependencies",
      "devDependencies",
      "exports",
      "files",
      "keywords",
    ];
    const used = new Set(keys.map(accentForKey));

    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it("is case sensitive, so differently cased keys may differ", () => {
    expect(typeof accentForKey("Scripts")).toBe("string");
  });

  it("exposes a fixed accent for the root node", () => {
    expect(ACCENT_POOL).toContain(ROOT_ACCENT);
  });
});

describe("mixHex", () => {
  it("returns the background when the foreground ratio is 0", () => {
    expect(mixHex("#ffffff", "#1e1e2e", 0)).toBe("#1e1e2e");
  });

  it("returns the foreground when the foreground ratio is 1", () => {
    expect(mixHex("#ffffff", "#1e1e2e", 1)).toBe("#ffffff");
  });

  it("mixes channel by channel at the midpoint", () => {
    expect(mixHex("#ffffff", "#000000", 0.5)).toBe("#808080");
  });

  it("produces a lowercase 6-digit hex", () => {
    expect(mixHex("#cba6f7", "#1e1e2e", 0.15)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("clamps ratios outside 0 to 1", () => {
    expect(mixHex("#ffffff", "#000000", -1)).toBe("#000000");
    expect(mixHex("#ffffff", "#000000", 2)).toBe("#ffffff");
  });

  it("accepts hex input without regard to case", () => {
    expect(mixHex("#FFFFFF", "#000000", 1)).toBe("#ffffff");
  });
});
