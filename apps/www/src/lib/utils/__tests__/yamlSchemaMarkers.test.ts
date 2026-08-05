import { describe, expect, it } from "vitest";
import { yamlSchemaMarkers } from "../yamlSchemaMarkers";

const SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["mustExist"],
  properties: {
    mustExist: { type: "string" },
    count: { type: "number" },
    items: { type: "array", items: { type: "object", required: ["id"] } },
  },
};

/** The text the offsets are expected to point at, so a range failure names what it hit. */
const sliceAt = (text: string, marker: { startOffset: number; endOffset: number }) =>
  text.slice(marker.startOffset, marker.endOffset);

describe("yamlSchemaMarkers", () => {
  it("reports nothing without a schema", () => {
    expect(yamlSchemaMarkers("anything: 1", null)).toEqual({ kind: "ok", markers: [] });
  });

  it("reports nothing for an empty document", () => {
    expect(yamlSchemaMarkers("   \n", SCHEMA)).toEqual({ kind: "ok", markers: [] });
  });

  it("accepts a conforming document", () => {
    expect(yamlSchemaMarkers("mustExist: hello", SCHEMA)).toEqual({ kind: "ok", markers: [] });
  });

  it("points a wrong type at the offending value", () => {
    const text = "mustExist: hello\ncount: not-a-number\n";
    const result = yamlSchemaMarkers(text, SCHEMA);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.markers).toHaveLength(1);
    expect(sliceAt(text, result.markers[0])).toBe("not-a-number");
    expect(result.markers[0].message).toContain("/count");
  });

  it("falls back to the parent when the missing property has no node", () => {
    const text = "count: 1\n";
    const result = yamlSchemaMarkers(text, SCHEMA);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].message).toContain("mustExist");
    // Anchored on the document body rather than dropped.
    expect(result.markers[0].endOffset).toBeGreaterThan(result.markers[0].startOffset);
  });

  it("resolves array indices as numbers, not strings", () => {
    const text = "mustExist: a\nitems:\n  - id: 1\n  - name: no-id\n";
    const result = yamlSchemaMarkers(text, SCHEMA);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    expect(result.markers).toHaveLength(1);
    // The second element is the one missing `id`, so the range must land on it.
    expect(sliceAt(text, result.markers[0])).toContain("name: no-id");
  });

  it("reports every violation, not just the first", () => {
    const result = yamlSchemaMarkers("count: not-a-number\n", SCHEMA);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.markers.length).toBeGreaterThanOrEqual(2);
  });

  it("stays quiet while the document does not parse", () => {
    // Unclosed flow mapping: the editor's own syntax diagnostics own this case.
    expect(yamlSchemaMarkers("mustExist: {", SCHEMA)).toEqual({ kind: "ok", markers: [] });
  });

  it("reports an uncompilable schema as unavailable rather than passing", () => {
    const result = yamlSchemaMarkers("mustExist: a", {
      $schema: "http://json-schema.org/draft-04/schema#",
      type: "object",
    });

    expect(result.kind).toBe("unavailable");
    if (result.kind !== "unavailable") return;
    expect(result.reason).toContain("draft-04");
  });
});
