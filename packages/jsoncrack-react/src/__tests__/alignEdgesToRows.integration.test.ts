import { elkLayout } from "reaflow";
import { describe, expect, it } from "vitest";
import { layoutOptions } from "../layoutOptions";
import { NODE_DIMENSIONS } from "../nodeDimensions";
import { parseGraph } from "../parser";
import { alignEdgesToRows, buildPortOffsetMap } from "../utils/alignEdgesToRows";
import type { LayoutRoot } from "../utils/alignEdgesToRows";

/**
 * The alignment only works if four things agree: the row offsets the parser stamps on its
 * ports, the header and row heights the node renders at, the way reaflow maps our nodes
 * onto ELK, and the shape of the sections ELK returns. Unit tests cover the correction in
 * isolation; this drives the real chain, through reaflow's own `elkLayout`, so a change to
 * any one of those four shows up as a failure instead of as crooked edges on screen.
 */

/**
 * Shaped after a package.json, which is what showed the jogs colliding: several sibling
 * rows pointing at their own child, spread far enough apart vertically that ELK routes
 * some of them through the layer gap and sends others straight across it.
 */
const SAMPLE = JSON.stringify({
  name: "jsoncrack-monorepo",
  private: true,
  license: "Apache-2.0",
  author: { name: "Aykut Saraç", email: "aykutsarac0@gmail.com" },
  bugs: { url: "https://github.com/AykutSarac/jsoncrack.com/issues" },
  scripts: { dev: "nub run dev", build: "nub run -r build", test: "nub run -r test" },
  workspaces: ["apps/*", "packages/*"],
  packageManager: "nub@0.6.0",
  devEngines: { packageManager: { name: "nub" }, runtime: { name: "node" } },
  overrides: { postcss: "8.5.18", sharp: "0.35.0" },
});

/** `port-<nodeId>-<rowIndex>-<sequence>`, per `createPort` in the parser. */
const rowIndexOf = (portId: string) => Number(portId.split("-")[2]);

/** Recomputed from the dimensions rather than reused from the parser, so both are checked. */
const rowCentre = (rowIndex: number) =>
  NODE_DIMENSIONS.HEADER_HEIGHT +
  rowIndex * NODE_DIMENSIONS.ROW_HEIGHT +
  NODE_DIMENSIONS.ROW_HEIGHT / 2;

const layoutSample = async () => {
  const { nodes, edges } = parseGraph(SAMPLE);
  const layout = (await elkLayout(nodes, edges, {
    "elk.direction": "RIGHT",
    ...layoutOptions,
  })) as LayoutRoot;

  return { layout, offsets: buildPortOffsetMap(nodes) };
};

const pointsOf = (edge: NonNullable<LayoutRoot["edges"]>[number]) => {
  const section = edge.sections![0];
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
};

describe("alignEdgesToRows against a real ELK layout", () => {
  it("leaves each stub at the vertical centre of the row that owns it", async () => {
    const { layout, offsets } = await layoutSample();
    const nodeTopById = new Map(layout.children!.map(node => [node.id, node.y!]));

    alignEdgesToRows(layout, offsets);

    const ported = layout.edges!.filter(edge => edge.properties?.fromPort);
    expect(ported.length).toBeGreaterThan(0);

    for (const edge of ported) {
      const { from, fromPort } = edge.properties!;
      expect(edge.sections![0].startPoint.y).toBe(
        nodeTopById.get(from!)! + rowCentre(rowIndexOf(fromPort!))
      );
    }
  });

  it("keeps every segment axis-aligned", async () => {
    const { layout, offsets } = await layoutSample();

    alignEdgesToRows(layout, offsets);

    for (const edge of layout.edges!) {
      const points = pointsOf(edge);
      for (let i = 1; i < points.length; i += 1) {
        const axisAligned = points[i].x === points[i - 1].x || points[i].y === points[i - 1].y;
        expect(axisAligned).toBe(true);
      }
    }
  });

  it("gives every turning edge bend points, so reaflow uses our interpolation not its bezier", async () => {
    const { layout, offsets } = await layoutSample();

    alignEdgesToRows(layout, offsets);

    for (const edge of layout.edges!.filter(e => e.properties?.fromPort)) {
      const section = edge.sections![0];
      // An edge with no bend points falls through to reaflow's bezier, which draws a
      // horizontal run as a straight line. That is only correct if the run is horizontal.
      if (!section.bendPoints?.length) {
        expect(section.endPoint.y).toBe(section.startPoint.y);
      }
    }
  });

  it("draws no turn shorter than the corner radius can absorb", async () => {
    const { layout, offsets } = await layoutSample();

    alignEdgesToRows(layout, offsets);

    // Two 8px corners meeting on one segment already consume 16px; anything near that
    // reads as a kink rather than a turn, which is why the short ones are straightened
    // away instead of being drawn.
    const SHORTEST_READABLE_TURN = 20;

    for (const edge of layout.edges!) {
      const points = pointsOf(edge);
      for (let i = 1; i < points.length; i += 1) {
        const length =
          Math.abs(points[i].y - points[i - 1].y) + Math.abs(points[i].x - points[i - 1].x);
        expect(length, `${JSON.stringify(points)}`).toBeGreaterThanOrEqual(SHORTEST_READABLE_TURN);
      }
    }
  });

  it("never lays a jog on top of a channel another edge already uses", async () => {
    const { layout, offsets } = await layoutSample();

    alignEdgesToRows(layout, offsets);

    // Vertical runs closer together than this read as one thickened line rather than two.
    const TOLERANCE = 4;
    const verticals: Array<{ id: number; x: number; top: number; bottom: number }> = [];

    layout.edges!.forEach((edge, id) => {
      const points = pointsOf(edge);
      for (let i = 1; i < points.length; i += 1) {
        if (points[i].x !== points[i - 1].x) continue;
        verticals.push({
          id,
          x: points[i].x,
          top: Math.min(points[i].y, points[i - 1].y),
          bottom: Math.max(points[i].y, points[i - 1].y),
        });
      }
    });

    for (const a of verticals) {
      for (const b of verticals) {
        if (a.id >= b.id) continue;
        const shared = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (shared <= 0.5) continue;
        expect(
          Math.abs(a.x - b.x),
          `edges ${a.id} and ${b.id} run parallel for ${shared}px`
        ).toBeGreaterThan(TOLERANCE);
      }
    }
  });

  it("adds no crossing that ELK's own routing did not already have", async () => {
    const { layout, offsets } = await layoutSample();

    const countCrossings = () => {
      const verticals: Array<{ id: number; x: number; top: number; bottom: number }> = [];
      const horizontals: Array<{ id: number; y: number; left: number; right: number }> = [];

      layout.edges!.forEach((edge, id) => {
        const points = pointsOf(edge);
        for (let i = 1; i < points.length; i += 1) {
          const a = points[i - 1];
          const b = points[i];
          if (a.x === b.x) {
            verticals.push({ id, x: a.x, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) });
          } else if (a.y === b.y) {
            horizontals.push({ id, y: a.y, left: Math.min(a.x, b.x), right: Math.max(a.x, b.x) });
          }
        }
      });

      const hits: string[] = [];
      for (const v of verticals) {
        for (const h of horizontals) {
          if (v.id === h.id) continue;
          const cuts = v.x > h.left && v.x < h.right && h.y > v.top && h.y < v.bottom;
          if (cuts) hits.push(`edge ${v.id} crosses edge ${h.id} at (${v.x},${h.y})`);
        }
      }
      return hits;
    };

    const before = countCrossings();
    alignEdgesToRows(layout, offsets);
    const after = countCrossings();

    expect(after.length, after.join("; ")).toBeLessThanOrEqual(before.length);
  });

  it("anchors both items of an array row to the same point", async () => {
    const { layout, offsets } = await layoutSample();

    alignEdgesToRows(layout, offsets);

    const byRow = new Map<string, number[]>();
    for (const edge of layout.edges!) {
      const port = edge.properties?.fromPort;
      if (!port) continue;
      const row = port.split("-").slice(0, 3).join("-");
      byRow.set(row, [...(byRow.get(row) ?? []), edge.sections![0].startPoint.y]);
    }

    const shared = [...byRow.values()].filter(ys => ys.length > 1);
    expect(shared.length).toBeGreaterThan(0);
    for (const ys of shared) expect(new Set(ys).size).toBe(1);
  });
});
