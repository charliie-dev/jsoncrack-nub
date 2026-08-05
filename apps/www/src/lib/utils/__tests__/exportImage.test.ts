import { latte, mocha } from "jsoncrack-react/palette";
import { describe, expect, it } from "vitest";
import {
  defaultExportBackground,
  EXPORT_SWATCHES,
  exportFileName,
  IMAGE_FORMATS,
} from "../exportImage";

describe("exportFileName", () => {
  it("drops the data extension the document was imported under", () => {
    expect(exportFileName("package.json", "png")).toBe("package.png");
    expect(exportFileName("compose.yaml", "svg")).toBe("compose.svg");
    expect(exportFileName("feed.XML", "jpeg")).toBe("feed.jpeg");
  });

  it("keeps a dot that is part of the name", () => {
    expect(exportFileName("schema.v1.2", "png")).toBe("schema.v1.2.png");
  });

  it("falls back when there is no document name", () => {
    expect(exportFileName(null, "png")).toBe("diagram.png");
    expect(exportFileName("", "png")).toBe("diagram.png");
    expect(exportFileName("   ", "png")).toBe("diagram.png");
  });

  it("falls back when stripping the extension would leave nothing", () => {
    expect(exportFileName(".json", "png")).toBe(".json.png");
    expect(exportFileName("json", "png")).toBe("json.png");
  });

  it("strips characters a filesystem may reject, but not spaces or dashes", () => {
    expect(exportFileName("my report: v2.json", "png")).toBe("my report v2.png");
    expect(exportFileName("a/b\\c.json", "png")).toBe("abc.png");
    expect(exportFileName("well-named report.json", "png")).toBe("well-named report.png");
  });

  it("names the file after the chosen format", () => {
    for (const format of IMAGE_FORMATS) {
      expect(exportFileName("data.json", format)).toBe(`data.${format}`);
    }
  });
});

describe("export background", () => {
  it("starts on the colour the canvas is drawn on, so the image matches the screen", () => {
    expect(defaultExportBackground(true)).toBe(mocha.crust);
    expect(defaultExportBackground(false)).toBe(latte.crust);
  });

  it("offers both defaults as swatches, plus a way out of choosing", () => {
    expect(EXPORT_SWATCHES).toContain(defaultExportBackground(true));
    expect(EXPORT_SWATCHES).toContain(defaultExportBackground(false));
    expect(EXPORT_SWATCHES[0]).toBe("transparent");
  });

  it("lists every swatch once", () => {
    expect(new Set(EXPORT_SWATCHES).size).toBe(EXPORT_SWATCHES.length);
  });
});
