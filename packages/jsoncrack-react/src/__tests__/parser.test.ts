import { describe, expect, it } from "vitest";
import { NODE_DIMENSIONS } from "../nodeDimensions";
import { parseGraph } from "../parser";

describe("parseGraph", () => {
  it("returns empty graph for empty string", () => {
    const result = parseGraph("");
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("parses a primitive into a single node with no edges", () => {
    const result = parseGraph('"hello"');
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toEqual([]);
    expect(result.nodes[0].text).toEqual([{ key: null, value: "hello", type: "string" }]);
  });

  it("parses a flat object into one node with typed rows and no edges", () => {
    const result = parseGraph('{"name":"Apple","count":3,"active":true,"tag":null}');
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toEqual([]);

    const rows = result.nodes[0].text;
    expect(rows).toEqual([
      { key: "name", value: "Apple", type: "string" },
      { key: "count", value: 3, type: "number" },
      { key: "active", value: true, type: "boolean" },
      { key: "tag", value: null, type: "null" },
    ]);
  });

  it("creates a child node and edge for a nested object", () => {
    const result = parseGraph('{"user":{"name":"Ada"}}');
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);

    const byId = new Map(result.nodes.map(n => [n.id, n]));
    const edge = result.edges[0];
    expect(byId.has(edge.from)).toBe(true);
    expect(byId.has(edge.to)).toBe(true);
    // Edges carry no label: the key is already on the source row and the target header.
    // Empty rather than null, which ELK's importer rejects; see EdgeData.text.
    expect(edge.text).toBe("");
    expect(byId.get(edge.to)?.text).toEqual([{ key: "name", value: "Ada", type: "string" }]);
  });

  it("creates one child node per array element with one edge each", () => {
    const result = parseGraph('{"fruits":["apple","banana","cherry"]}');
    // 1 root node + 3 array children = 4 nodes
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    const byId = new Map(result.nodes.map(n => [n.id, n]));
    // The parser pushes nodes in post-order (children before parent), so we
    // identify the root as the one not referenced by any edge's `to`.
    const targetIds = new Set(result.edges.map(e => e.to));
    const root = result.nodes.find(n => !targetIds.has(n.id));
    expect(root).toBeDefined();
    const rootId = root!.id;

    result.edges.forEach(edge => {
      expect(edge.from).toBe(rootId);
      expect(edge.text).toBe("");
    });

    const childValues = result.edges.map(e => byId.get(e.to)?.text[0].value);
    expect(childValues).toEqual(["apple", "banana", "cherry"]);
  });

  it("renders a top-level array as a parent node with one child per element", () => {
    const result = parseGraph("[1,2,3]");
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    const targetIds = new Set(result.edges.map(e => e.to));
    const root = result.nodes.find(n => !targetIds.has(n.id));
    expect(root).toBeDefined();
    expect(root!.text[0]).toMatchObject({
      key: null,
      type: "array",
      childrenCount: 3,
      value: "[3 items]",
    });

    const byId = new Map(result.nodes.map(n => [n.id, n]));
    const childValues = result.edges.map(e => byId.get(e.to)?.text[0].value).sort();
    expect(childValues).toEqual([1, 2, 3]);
  });

  it("handles deeply nested structures", () => {
    const result = parseGraph('{"a":{"b":{"c":{"d":1}}}}');
    // 4 nested object nodes = 4 nodes, 3 edges
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
  });

  it("reports parse errors but still returns a partial graph", () => {
    const result = parseGraph('{"broken": }');
    expect(result.errors.length).toBeGreaterThan(0);
    // jsonc-parser is error-tolerant and still produces a tree
    expect(result.nodes.length).toBeGreaterThanOrEqual(0);
  });

  it("assigns unique ids to every node and edge", () => {
    const result = parseGraph('{"users":[{"id":1},{"id":2}]}');
    const nodeIds = new Set(result.nodes.map(n => n.id));
    const edgeIds = new Set(result.edges.map(e => e.id));
    expect(nodeIds.size).toBe(result.nodes.length);
    expect(edgeIds.size).toBe(result.edges.length);
  });

  it("emits edges with from/to pointing at existing node ids", () => {
    const result = parseGraph('{"a":{"b":1},"c":[2,3]}');
    const nodeIds = new Set(result.nodes.map(n => n.id));
    result.edges.forEach(edge => {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    });
  });
});

describe("parseGraph ports", () => {
  it("gives every container row a port in row order", () => {
    const { nodes } = parseGraph(
      JSON.stringify({ name: "x", author: { email: "a@b.c" }, bugs: { url: "u" } })
    );
    const root = nodes.find(node => node.path?.length === 0);

    expect(root?.ports).toHaveLength(2);
    expect(root?.ports?.every(port => port.side === "EAST")).toBe(true);
  });

  it("anchors each port to the middle of its row, below the header", () => {
    const { nodes } = parseGraph(JSON.stringify({ name: "x", author: { email: "a@b.c" } }));
    const root = nodes.find(node => node.path?.length === 0);
    const authorRowIndex = root!.text.findIndex(row => row.key === "author");

    expect(root!.ports![0].y).toBe(
      NODE_DIMENSIONS.HEADER_HEIGHT +
        authorRowIndex * NODE_DIMENSIONS.ROW_HEIGHT +
        NODE_DIMENSIONS.ROW_HEIGHT / 2
    );
  });

  it("points the edge at the port belonging to its row", () => {
    const { nodes, edges } = parseGraph(JSON.stringify({ author: { email: "a@b.c" } }));
    const root = nodes.find(node => node.path?.length === 0);
    // Identified structurally rather than by label: edges carry none, and a key name
    // would not be unique across a document anyway.
    const authorEdge = edges.find(edge => edge.from === root!.id);

    expect(authorEdge?.fromPort).toBe(root!.ports![0].id);
  });

  it("gives no ports to a node whose rows are all scalars", () => {
    const { nodes } = parseGraph(JSON.stringify({ name: "x", version: "1" }));
    const root = nodes.find(node => node.path?.length === 0);

    expect(root?.ports).toBeUndefined();
  });

  it("gives one port per array element and anchors them to the same row", () => {
    const { nodes, edges } = parseGraph(JSON.stringify({ workspaces: ["apps/*", "packages/*"] }));
    const root = nodes.find(node => node.path?.length === 0);

    expect(root?.ports).toHaveLength(2);
    expect(root!.ports![0].y).toBe(root!.ports![1].y);

    const portIds = root!.ports!.map(port => port.id);
    const arrayEdges = edges.filter(edge => edge.from === root!.id);
    expect(arrayEdges).toHaveLength(2);
    for (const edge of arrayEdges) {
      expect(portIds).toContain(edge.fromPort);
    }
  });

  it("keeps port ids unique across the whole graph", () => {
    const { nodes } = parseGraph(
      JSON.stringify({ a: { x: 1 }, b: { y: 2 }, c: [{ z: 3 }, { w: 4 }] })
    );
    const allIds = nodes.flatMap(node => node.ports?.map(port => port.id) ?? []);

    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("elk compatibility", () => {
  /**
   * reaflow spreads the whole NodeData and EdgeData into ELK's `properties`, and ELK's
   * JSON importer rejects a null value anywhere in there. It fails with "Severe
   * implementation error in the Json to ElkGraph importer", names no field, and leaves the
   * canvas spinning. Setting EdgeData.text to null once cost an afternoon.
   */
  it("emits no null values on nodes or edges", () => {
    const { nodes, edges } = parseGraph(
      JSON.stringify({
        name: "x",
        nested: { deep: { deeper: 1 } },
        list: ["a", "b"],
        nullValue: null,
        objects: [{ id: 1 }, { id: 2 }],
      })
    );

    const nullKeys = (record: Record<string, unknown>) =>
      Object.entries(record)
        .filter(([, value]) => value === null)
        .map(([key]) => key);

    for (const node of nodes) {
      expect(nullKeys(node as unknown as Record<string, unknown>)).toEqual([]);
    }
    for (const edge of edges) {
      expect(nullKeys(edge as unknown as Record<string, unknown>)).toEqual([]);
    }
  });
});
