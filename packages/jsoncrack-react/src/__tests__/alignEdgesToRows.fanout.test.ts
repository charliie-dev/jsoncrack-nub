import { elkLayout } from "reaflow";
import { describe, expect, it } from "vitest";
import { layoutOptions } from "../layoutOptions";
import { parseGraph } from "../parser";
import { alignEdgesToRows, buildPortOffsetMap } from "../utils/alignEdgesToRows";
import type { LayoutRoot } from "../utils/alignEdgesToRows";

/**
 * The shapes that make the pass invent geometry.
 *
 * Most documents never do. ELK routes nearly every edge with a bend of its own, which the
 * pass only has to slide, and the few it sends straight across the gap are usually
 * straightened rather than jogged. The jog path — the one place a channel is chosen rather
 * than inherited — is reached only when the row a child hangs off is far from where ELK
 * spread its ports, which takes a tall node whose children are all clustered in a few of
 * its rows. Every case here is built to force that, because the ordinary fixtures produce
 * no jogs at all and would pass whatever the channel logic did.
 */

const scalars = (count: number, from = 0) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`s${from + i}`, from + i]));

const CASES: Record<string, unknown> = {
  "one child on the first row": { a: { v: 1 }, ...scalars(12) },
  "children clustered at the top": { a: { v: 1 }, b: { v: 2 }, c: { v: 3 }, ...scalars(18) },
  "children clustered at the bottom": { ...scalars(18), a: { v: 1 }, b: { v: 2 }, c: { v: 3 } },
  "children at both ends": {
    a: { v: 1 },
    b: { v: 2 },
    ...scalars(16),
    y: { v: 3 },
    z: { v: 4 },
  },
  "children scattered between scalars": {
    a: { v: 1 },
    ...scalars(4, 0),
    b: { v: 2 },
    ...scalars(4, 4),
    c: { v: 3 },
    ...scalars(4, 8),
    d: { v: 4 },
  },
  // Four edges out of a single row, the case that exposed the channels collapsing.
  "an array high up a tall node": {
    list: [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }],
    ...scalars(16),
  },
  "two nodes each skewed": {
    p: { a: { v: 1 }, ...scalars(12) },
    q: { b: { v: 2 }, ...scalars(12, 50) },
  },
};

interface Run {
  id: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const runsOf = (layout: LayoutRoot) => {
  const vertical: Run[] = [];
  const horizontal: Run[] = [];
  let shortestLeg = Number.POSITIVE_INFINITY;

  layout.edges!.forEach((edge, id) => {
    const section = edge.sections![0];
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];

    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      shortestLeg = Math.min(shortestLeg, Math.abs(a.x - b.x) + Math.abs(a.y - b.y));

      const run = {
        id,
        x0: Math.min(a.x, b.x),
        x1: Math.max(a.x, b.x),
        y0: Math.min(a.y, b.y),
        y1: Math.max(a.y, b.y),
      };
      if (a.x === b.x) vertical.push(run);
      else if (a.y === b.y) horizontal.push(run);
    }
  });

  let crossings = 0;
  for (const v of vertical) {
    for (const h of horizontal) {
      if (v.id === h.id) continue;
      if (v.x0 > h.x0 && v.x0 < h.x1 && h.y0 > v.y0 && h.y0 < v.y1) crossings += 1;
    }
  }

  let closestParallel = Number.POSITIVE_INFINITY;
  for (const a of vertical) {
    for (const b of vertical) {
      if (a.id >= b.id) continue;
      if (Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) <= 0.5) continue;
      closestParallel = Math.min(closestParallel, Math.abs(a.x0 - b.x0));
    }
  }

  return { crossings, shortestLeg, closestParallel };
};

const layoutOf = async (data: unknown) => {
  const { nodes, edges } = parseGraph(JSON.stringify(data));
  const layout = (await elkLayout(nodes, edges, {
    "elk.direction": "RIGHT",
    ...layoutOptions,
  })) as LayoutRoot;

  const jogCandidates = layout.edges!.filter(edge => !edge.sections![0].bendPoints?.length).length;

  return { layout, offsets: buildPortOffsetMap(nodes), jogCandidates };
};

describe.each(Object.entries(CASES))("%s", (_name, data) => {
  it("chooses channels that stay clear of one another", async () => {
    const { layout, offsets, jogCandidates } = await layoutOf(data);
    const before = runsOf(layout);

    // Without this the case proves nothing: it would be measuring the slide path.
    expect(jogCandidates).toBeGreaterThan(0);

    alignEdgesToRows(layout, offsets);
    const after = runsOf(layout);

    expect(after.crossings, "crossings added").toBeLessThanOrEqual(before.crossings);
    // Both bars are the ones the ordinary fixture is held to. Sharing a corridor out one
    // edge at a time used to halve the space each time and drop these to 2px.
    expect(after.shortestLeg, "shortest leg").toBeGreaterThanOrEqual(20);
    if (after.closestParallel !== Number.POSITIVE_INFINITY) {
      expect(after.closestParallel, "closest parallel channels").toBeGreaterThan(4);
    }
  });
});
