import { describe, expect, it } from "vitest";
import { NODE_DIMENSIONS } from "../nodeDimensions";
import { calculateNodeSize } from "../utils/calculateNodeSize";

describe("NODE_DIMENSIONS", () => {
  it("keeps the existing row and parent heights", () => {
    expect(NODE_DIMENSIONS.ROW_HEIGHT).toBe(30);
    expect(NODE_DIMENSIONS.PARENT_HEIGHT).toBe(36);
  });

  it("declares a header height", () => {
    expect(NODE_DIMENSIONS.HEADER_HEIGHT).toBe(36);
  });
});

describe("calculateNodeSize", () => {
  it("adds the header height to a multi-row object node", () => {
    const rows: [string, string][] = [
      ["name", "jsoncrack-monorepo"],
      ["private", "true"],
      ["license", "Apache-2.0"],
    ];

    const { height } = calculateNodeSize(rows);

    expect(height).toBe(3 * NODE_DIMENSIONS.ROW_HEIGHT + NODE_DIMENSIONS.HEADER_HEIGHT);
  });

  it("adds the header height to a single-value text node", () => {
    const { height } = calculateNodeSize("apps/*");

    expect(height).toBe(NODE_DIMENSIONS.PARENT_HEIGHT + NODE_DIMENSIONS.HEADER_HEIGHT);
  });

  it("still returns the empty-text fallback without a header", () => {
    expect(calculateNodeSize("")).toEqual({ width: 45, height: 45 });
  });

  it("caches by text and parent flag, so a repeated call is identical", () => {
    const first = calculateNodeSize("cached-value");
    const second = calculateNodeSize("cached-value");

    expect(second).toEqual(first);
  });
});
