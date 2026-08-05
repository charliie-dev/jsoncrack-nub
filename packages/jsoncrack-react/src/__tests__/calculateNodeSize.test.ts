import { describe, expect, it } from "vitest";
import { NODE_DIMENSIONS } from "../nodeDimensions";
import { calculateNodeSize } from "../utils/calculateNodeSize";

describe("NODE_DIMENSIONS", () => {
  it("keeps the parent height and uses the tightened row height", () => {
    expect(NODE_DIMENSIONS.ROW_HEIGHT).toBe(26);
    expect(NODE_DIMENSIONS.PARENT_HEIGHT).toBe(36);
  });

  it("declares a header height", () => {
    expect(NODE_DIMENSIONS.HEADER_HEIGHT).toBe(30);
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

describe("calculateNodeSize header width", () => {
  it("widens the node when the header label is longer than the body", () => {
    const withoutHeader = calculateNodeSize("apps/*");
    const withHeader = calculateNodeSize("apps/*", false, "workspaces[0]");

    expect(withHeader.width).toBeGreaterThan(withoutHeader.width);
  });

  it("leaves the width alone when the body is already wider", () => {
    const body = "a-considerably-longer-value-than-the-header";
    const withoutHeader = calculateNodeSize(body);
    const withHeader = calculateNodeSize(body, false, "id");

    expect(withHeader.width).toBe(withoutHeader.width);
  });

  it("does not let the header change the height", () => {
    const withoutHeader = calculateNodeSize("short-value-a");
    const withHeader = calculateNodeSize("short-value-b", false, "a-very-long-header-label");

    expect(withHeader.height).toBe(withoutHeader.height);
  });

  it("still caps the width at 700", () => {
    const { width } = calculateNodeSize("x", false, "y".repeat(400));

    expect(width).toBeLessThanOrEqual(700);
  });
});
