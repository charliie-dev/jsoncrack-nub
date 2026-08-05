import { describe, expect, it } from "vitest";
import { roundedOrthogonalPath } from "../utils/roundedOrthogonalPath";

describe("roundedOrthogonalPath", () => {
  it("returns nothing for no points", () => {
    expect(roundedOrthogonalPath([])).toBe("");
  });

  it("draws a straight line between two points, with no curve", () => {
    const path = roundedOrthogonalPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);

    expect(path).toBe("M0,0L100,0");
    expect(path).not.toContain("Q");
  });

  it("rounds a single corner, keeping the corner as the control point", () => {
    const path = roundedOrthogonalPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      8
    );

    // Cut back 8px along each side of (100,0) and bridged through it.
    expect(path).toBe("M0,0L92,0Q100,0 100,8L100,100");
  });

  it("caps the radius at half the shorter neighbouring segment", () => {
    // The middle segment is only 10px, so the corners may take 5px each and no more.
    const path = roundedOrthogonalPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 10 },
        { x: 200, y: 10 },
      ],
      20
    );

    expect(path).toContain("L95,0");
    expect(path).toContain("Q100,0 100,5");
    expect(path).toContain("Q100,10 105,10");
  });

  it("handles a zero-length segment without dividing by zero", () => {
    const path = roundedOrthogonalPath([
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
    ]);

    expect(path).not.toContain("NaN");
  });

  it("rounds every corner in a longer path", () => {
    const path = roundedOrthogonalPath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ]);

    expect(path.match(/Q/g)).toHaveLength(2);
  });

  it("starts and ends exactly on the given endpoints", () => {
    const path = roundedOrthogonalPath([
      { x: 3, y: 7 },
      { x: 40, y: 7 },
      { x: 40, y: 90 },
    ]);

    expect(path.startsWith("M3,7")).toBe(true);
    expect(path.endsWith("L40,90")).toBe(true);
  });
});
