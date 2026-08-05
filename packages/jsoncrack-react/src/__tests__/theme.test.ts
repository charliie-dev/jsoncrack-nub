import { describe, expect, it } from "vitest";
import { buildCanvasStyle } from "../canvasHelpers";
import { latte, mocha } from "../catppuccin";
import { themes } from "../theme";

describe("themes", () => {
  it("builds the dark flavour from mocha", () => {
    expect(themes.dark.BASE).toBe(mocha.base);
    expect(themes.dark.NODE_COLORS.NODE_KEY).toBe(mocha.blue);
    expect(themes.dark.GRID_BG_COLOR).toBe(mocha.crust);
  });

  it("builds the light flavour from latte", () => {
    expect(themes.light.BASE).toBe(latte.base);
    expect(themes.light.NODE_COLORS.NODE_KEY).toBe(latte.blue);
    expect(themes.light.GRID_BG_COLOR).toBe(latte.crust);
  });

  it("defines every token in both flavours", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("no longer leaves canvas colours outside the palette", () => {
    const palettes = { dark: mocha, light: latte } as const;

    for (const flavour of ["dark", "light"] as const) {
      const values = Object.values(palettes[flavour]);
      const theme = themes[flavour];

      expect(values).toContain(theme.EDGE_STROKE);
      expect(values).toContain(theme.NODE_FILL);
      expect(values).toContain(theme.NODE_STROKE);
    }
  });
});

describe("buildCanvasStyle", () => {
  it("projects the dark tokens onto css variables", () => {
    const style = buildCanvasStyle("dark") as Record<string, string>;

    expect(style["--bg-color"]).toBe(mocha.crust);
    expect(style["--edge-stroke"]).toBe(themes.dark.EDGE_STROKE);
    expect(style["--node-fill"]).toBe(themes.dark.NODE_FILL);
    expect(style["--node-header-text"]).toBe(themes.dark.NODE_COLORS.HEADER_TEXT);
  });

  it("still lets a caller style override a token", () => {
    const style = buildCanvasStyle("dark", {
      "--bg-color": "#123456",
    } as never) as Record<string, string>;

    expect(style["--bg-color"]).toBe("#123456");
  });
});
