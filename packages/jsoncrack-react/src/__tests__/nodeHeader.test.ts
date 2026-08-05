import { describe, expect, it } from "vitest";
import { mocha } from "../catppuccin";
import { headerColors } from "../components/NodeHeader";
import { ROOT_ACCENT, accentForKey } from "../utils/accentForKey";

describe("headerColors", () => {
  it("uses the hashed accent for a keyed node", () => {
    const colors = headerColors("scripts", "dark");

    expect(colors.text).toBe(mocha[accentForKey("scripts")]);
  });

  it("uses the fixed root accent when there is no key", () => {
    const colors = headerColors(null, "dark");

    expect(colors.text).toBe(mocha[ROOT_ACCENT]);
  });

  it("mixes the background towards the flavour base", () => {
    const colors = headerColors("scripts", "dark");

    expect(colors.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(colors.background).not.toBe(colors.text);
    expect(colors.background).not.toBe(mocha.base);
  });

  it("returns the same colours for the same input", () => {
    expect(headerColors("author", "dark")).toEqual(headerColors("author", "dark"));
  });

  it("returns different values per flavour", () => {
    expect(headerColors("author", "dark").text).not.toBe(headerColors("author", "light").text);
  });
});
