import { describe, expect, it } from "vitest";
import { layoutOptions } from "../layoutOptions";

describe("layoutOptions", () => {
  it("routes edges orthogonally", () => {
    expect(layoutOptions["elk.edgeRouting"]).toBe("ORTHOGONAL");
  });

  it("sets every spacing option as a numeric string, which is what elk expects", () => {
    const spacingKeys = Object.keys(layoutOptions).filter(key => key.includes("spacing"));

    expect(spacingKeys.length).toBeGreaterThanOrEqual(4);

    for (const key of spacingKeys) {
      expect(layoutOptions[key]).toMatch(/^\d+$/);
    }
  });

  it("keeps node placement on network simplex", () => {
    expect(layoutOptions["elk.layered.nodePlacement.strategy"]).toBe("NETWORK_SIMPLEX");
  });

  it("leaves edge merging off so sibling edges stay separate", () => {
    expect(layoutOptions["elk.layered.mergeEdges"]).toBeUndefined();
  });
});
