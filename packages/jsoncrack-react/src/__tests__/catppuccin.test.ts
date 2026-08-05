import { describe, expect, it } from "vitest";
import { ACCENT_POOL, latte, mocha } from "../catppuccin";

describe("catppuccin palettes", () => {
  it("exposes the same 26 colour names in both flavours", () => {
    const mochaKeys = Object.keys(mocha).sort();
    const latteKeys = Object.keys(latte).sort();

    expect(mochaKeys).toEqual(latteKeys);
    expect(mochaKeys).toHaveLength(26);
  });

  it("uses the exact upstream hex values", () => {
    expect(mocha.base).toBe("#1e1e2e");
    expect(mocha.mauve).toBe("#cba6f7");
    expect(mocha.crust).toBe("#11111b");
    expect(latte.base).toBe("#eff1f5");
    expect(latte.mauve).toBe("#8839ef");
    expect(latte.crust).toBe("#dce0e8");
  });

  it("stores every colour as a lowercase 6-digit hex", () => {
    for (const value of [...Object.values(mocha), ...Object.values(latte)]) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the accent pool resolvable in both flavours", () => {
    expect(ACCENT_POOL.length).toBeGreaterThan(0);

    for (const name of ACCENT_POOL) {
      expect(mocha[name]).toMatch(/^#[0-9a-f]{6}$/);
      expect(latte[name]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("excludes accents that are hard to tell apart from their neighbours", () => {
    expect(ACCENT_POOL).not.toContain("rosewater");
    expect(ACCENT_POOL).not.toContain("flamingo");
    expect(ACCENT_POOL).not.toContain("maroon");
    expect(ACCENT_POOL).not.toContain("sapphire");
    expect(ACCENT_POOL).not.toContain("yellow");
  });

  it("has no duplicate entries in the accent pool", () => {
    expect(new Set(ACCENT_POOL).size).toBe(ACCENT_POOL.length);
  });
});
