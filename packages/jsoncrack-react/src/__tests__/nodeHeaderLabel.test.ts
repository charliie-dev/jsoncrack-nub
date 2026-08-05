import { describe, expect, it } from "vitest";
import { DEFAULT_ROOT_LABEL, nodeHeaderLabel } from "../utils/nodeHeaderLabel";

describe("nodeHeaderLabel", () => {
  it("uses the root label for the root node's empty path", () => {
    expect(nodeHeaderLabel([], "package.json")).toBe("package.json");
  });

  it("uses the root label when the path is missing", () => {
    expect(nodeHeaderLabel(undefined, "package.json")).toBe("package.json");
  });

  it("falls back to Untitled when no root label is given", () => {
    expect(nodeHeaderLabel([], "")).toBe(DEFAULT_ROOT_LABEL);
    expect(DEFAULT_ROOT_LABEL).toBe("Untitled");
  });

  it("uses the last segment for an object property", () => {
    expect(nodeHeaderLabel(["author"], "package.json")).toBe("author");
    expect(nodeHeaderLabel(["devEngines", "runtime"], "package.json")).toBe("runtime");
  });

  it("renders an array element as container plus index", () => {
    expect(nodeHeaderLabel(["workspaces", 0], "package.json")).toBe("workspaces[0]");
    expect(nodeHeaderLabel(["workspaces", 1], "package.json")).toBe("workspaces[1]");
  });

  it("renders a nested array element against its own container", () => {
    expect(nodeHeaderLabel(["a", "b", 2], "package.json")).toBe("b[2]");
  });

  it("renders an index at the root of an array document", () => {
    expect(nodeHeaderLabel([3], "data.json")).toBe("[3]");
  });
});
