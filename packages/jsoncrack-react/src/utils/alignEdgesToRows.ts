import type { GraphData } from "../types";
import { CORNER_RADIUS } from "./roundedOrthogonalPath";

export interface LayoutPoint {
  x: number;
  y: number;
}

/** The part of an ELK-laid-out edge this pass reads and writes. */
export interface LayoutEdge {
  properties?: { from?: string; to?: string; fromPort?: string };
  sections?: Array<{
    startPoint: LayoutPoint;
    endPoint: LayoutPoint;
    bendPoints?: LayoutPoint[];
  }>;
}

export interface LayoutNode {
  id: string;
  y?: number;
  height?: number;
}

export interface LayoutRoot {
  children?: LayoutNode[];
  edges?: LayoutEdge[];
}

/** Below this the stub is already on its row and moving it would only churn the object. */
const EPSILON = 0.01;

const sameY = (a: number, b: number) => Math.abs(a - b) < EPSILON;

/**
 * The shortest turn worth drawing.
 *
 * Each corner is cut back by up to CORNER_RADIUS, so a segment between two of them has a
 * straight part at all only above twice that. One more radius on top leaves something to
 * see; below it the two curves run into each other and the turn reads as a kink in the
 * line rather than a change of direction.
 */
const SHORTEST_TURN = CORNER_RADIUS * 3;

/**
 * How far inside a node an edge has to land for arriving there to look deliberate.
 *
 * Enough to clear the node's own 5px corner with the stroke's width to spare.
 */
const ENTRY_INSET = 8;

/** Map every port id to the offset, from its node's top edge, of the row that owns it. */
export const buildPortOffsetMap = (nodes: GraphData["nodes"]): Map<string, number> => {
  const offsets = new Map<string, number>();

  for (const node of nodes) {
    for (const port of node.ports ?? []) offsets.set(port.id, port.y);
  }

  return offsets;
};

/** An axis-aligned run of some edge's path. `owner` is the index of the edge that drew it. */
interface Run {
  owner: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const isVertical = (run: Run) => run.x0 === run.x1;

const runsOf = (edge: LayoutEdge, owner: number): Run[] => {
  const section = edge.sections?.[0];
  if (!section) return [];

  const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
  const runs: Run[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    runs.push({
      owner,
      x0: Math.min(from.x, to.x),
      x1: Math.max(from.x, to.x),
      y0: Math.min(from.y, to.y),
      y1: Math.max(from.y, to.y),
    });
  }

  return runs;
};

/** The three runs a jog through `x` would draw, in the order start → target. */
const jogRuns = (
  owner: number,
  low: number,
  x: number,
  high: number,
  rowY: number,
  stubY: number
) => ({
  out: { owner, x0: low, x1: x, y0: rowY, y1: rowY },
  down: { owner, x0: x, x1: x, y0: Math.min(rowY, stubY), y1: Math.max(rowY, stubY) },
  in: { owner, x0: x, x1: high, y0: stubY, y1: stubY },
});

/** Whether a vertical and a horizontal run actually cut through one another. */
const crosses = (vertical: Run, horizontal: Run) =>
  vertical.x0 > horizontal.x0 &&
  vertical.x0 < horizontal.x1 &&
  horizontal.y0 > vertical.y0 &&
  horizontal.y0 < vertical.y1;

/**
 * Where to run a jog so it disturbs the rest of the drawing as little as possible.
 *
 * The midpoint of the layer gap is the obvious choice and the wrong one twice over. ELK has
 * already filled that gap with the channels for the other edges, so the midpoint is not
 * free space: land 1px off one of them and the two verticals draw as a single thick line,
 * and land to the left of them and the jog cuts straight through the stubs they leave their
 * shared node by. ELK itself produced no crossings at all, so every one we add is ours.
 *
 * Rather than encode those as rules, score the candidates. Each region between two
 * neighbouring obstacles is represented by its midpoint, and the winner is whichever adds
 * the fewest crossings — counting all three runs the jog draws, not just the vertical.
 * Ties go to the candidate furthest from any parallel vertical.
 *
 * `slots` leads the candidate list, its first entry being the share of the gap the caller
 * has set aside for this edge. Left to the obstacle midpoints alone the group collapses
 * leftwards: each edge that lands crosses out everything right of it, so the next has to
 * squeeze into the space remaining, and four edges out of one row ended up 2px apart. The
 * shares are already in the order that avoids those crossings, so offering them first
 * spreads the group without giving up the scoring below.
 */
const pickChannelX = (
  owner: number,
  low: number,
  high: number,
  rowY: number,
  stubY: number,
  runs: Run[],
  slots: number[],
  /** Jogs sharing this corridor, whose spacing the shares already settle. */
  group: ReadonlySet<number>
): number => {
  const top = Math.min(rowY, stubY);
  const bottom = Math.max(rowY, stubY);

  // Only what shares the rectangle the jog is drawn in can be crossed or crowded by it.
  const nearby = runs.filter(
    run =>
      run.owner !== owner && run.x1 >= low && run.x0 <= high && run.y1 >= top && run.y0 <= bottom
  );

  const verticals = nearby.filter(isVertical);
  const horizontals = nearby.filter(run => !isVertical(run));

  const stops = new Set<number>([low, high]);
  for (const run of nearby) {
    if (run.x0 > low && run.x0 < high) stops.add(run.x0);
    if (run.x1 > low && run.x1 < high) stops.add(run.x1);
  }

  const ordered = [...stops].sort((a, b) => a - b);
  const candidates = [...slots];
  for (let i = 1; i < ordered.length; i += 1) candidates.push((ordered[i - 1] + ordered[i]) / 2);

  let best = candidates[0];
  let fewest = Number.POSITIVE_INFINITY;
  let clearest = Number.NEGATIVE_INFINITY;

  for (const x of candidates) {
    const jog = jogRuns(owner, low, x, high, rowY, stubY);

    let crossings = 0;
    for (const run of horizontals) if (crosses(jog.down, run)) crossings += 1;
    for (const run of verticals) {
      if (crosses(run, jog.out)) crossings += 1;
      if (crosses(run, jog.in)) crossings += 1;
    }

    // Only against channels nobody planned. Measuring it against the rest of the group too
    // would beat the shares: with no crossings to separate them, the candidate furthest
    // from a sibling always wins, and the group ends up bunched at one end of the gap
    // instead of spread across it.
    let clearance = Number.POSITIVE_INFINITY;
    for (const run of verticals) {
      if (group.has(run.owner)) continue;
      if (run.y1 > top && run.y0 < bottom) clearance = Math.min(clearance, Math.abs(run.x0 - x));
    }

    if (crossings < fewest || (crossings === fewest && clearance > clearest)) {
      best = x;
      fewest = crossings;
      clearest = clearance;
    }
  }

  return best;
};

/**
 * Slide each edge's outgoing stub onto the row it belongs to, in place.
 *
 * ELK is never told where the ports sit. reaflow's node mapper builds its ELK ports out of
 * an id and a properties bag and drops any coordinates on the way, so FIXED_POS has nothing
 * to act on and reaflow hard-codes FIXED_ORDER instead: ELK keeps the ports in the order we
 * declared them but spreads them evenly down the node's east side. Rows are a fixed 26px
 * tall and nodes have a header, so even spread only lines up by coincidence.
 *
 * Rather than fight the mapper, this corrects the result. Order is most of what ELK was
 * needed for — it also picked the vertical channel each edge runs down and kept those clear
 * of one another, and an edge whose stub ends in a bend can be slid without touching any of
 * that. An edge ELK sent straight across the layer gap has no channel to slide along, so
 * one is chosen for it; `pickChannelX` covers what that has to avoid.
 *
 * Mutating is deliberate. reaflow calls `onLayoutChange(result)` with the same object it
 * has just handed to `setLayout`, synchronously, before React renders, so editing it here
 * lands in the first paint. Rewriting it into a copy would need a second render pass and
 * would show the uncorrected edges in between.
 */
export const alignEdgesToRows = (
  layout: LayoutRoot,
  portOffsetById: ReadonlyMap<string, number>
): void => {
  if (!layout.edges?.length || !layout.children?.length || portOffsetById.size === 0) return;

  const edges = layout.edges;

  const nodeTopById = new Map<string, number>();
  /** The stretch of a node's left side an edge may arrive at without hugging a corner. */
  const entryBandById = new Map<string, { top: number; bottom: number }>();

  for (const node of layout.children) {
    if (typeof node.y !== "number") continue;
    nodeTopById.set(node.id, node.y);

    const height = node.height ?? 0;
    if (height > ENTRY_INSET * 2) {
      entryBandById.set(node.id, {
        top: node.y + ENTRY_INSET,
        bottom: node.y + height - ENTRY_INSET,
      });
    }
  }

  const rowYOf = (edge: LayoutEdge): number | null => {
    const from = edge.properties?.from;
    const fromPort = edge.properties?.fromPort;
    if (!edge.sections?.[0] || !from || !fromPort) return null;

    const offset = portOffsetById.get(fromPort);
    const nodeTop = nodeTopById.get(from);
    if (offset === undefined || nodeTop === undefined) return null;

    return nodeTop + offset;
  };

  // Pass one: every edge whose stub ends in a bend can be slid without inventing geometry.
  const needJog: number[] = [];

  edges.forEach((edge, index) => {
    const rowY = rowYOf(edge);
    if (rowY === null) return;

    const section = edge.sections![0];

    // A turn this short is not routing around anything — it is the last few pixels of a
    // detour to the target's centre, and it draws as a kink rather than a corner. When the
    // row points far enough into the target's side to be entered there instead, the edge
    // can simply be straight. Dropping the bend points sends reaflow down its bezier
    // fallback, which draws a horizontal run as a straight line.
    const band = entryBandById.get(edge.properties!.to ?? "");
    const turn = Math.abs(rowY - section.endPoint.y);
    if (turn < SHORTEST_TURN && band && rowY >= band.top && rowY <= band.bottom) {
      section.startPoint.y = rowY;
      section.endPoint.y = rowY;
      section.bendPoints = undefined;
      return;
    }

    // Also what makes a second pass over an already-corrected layout a no-op.
    if (sameY(section.startPoint.y, rowY)) return;

    const bends = section.bendPoints;
    if (bends?.length && sameY(bends[0].y, section.startPoint.y)) {
      // The stub runs horizontally into this bend, so moving both ends of it leaves every
      // segment after the bend exactly where ELK put it.
      bends[0].y = rowY;
      section.startPoint.y = rowY;
      return;
    }

    needJog.push(index);
  });

  if (needJog.length === 0) return;

  // Collected after pass one so the runs reflect where the slid edges ended up, and grown
  // as each jog is placed so later ones can see and avoid it.
  const runs = edges.flatMap(runsOf);

  const gapOf = (index: number) => {
    const section = edges[index].sections![0];
    return { low: section.startPoint.x, high: (section.bendPoints?.[0] ?? section.endPoint).x };
  };

  // Everything leaving one node competes for the same corridor, so the jogs are placed a
  // node at a time and the corridor is shared out among them.
  const byCorridor = new Map<number, number[]>();
  for (const index of needJog) {
    const { low } = gapOf(index);
    byCorridor.set(low, [...(byCorridor.get(low) ?? []), index]);
  }

  const travelOf = (index: number) => {
    const section = edges[index].sections![0];
    return Math.abs(rowYOf(edges[index])! - section.startPoint.y);
  };

  for (const indices of byCorridor.values()) {
    // Furthest first. Where two of these jogs can collide at all, the one running further
    // has to take the channel nearer the node: the other's arrival into its target is a
    // horizontal line across the gap, and a vertical to the right of it would cut through.
    // Ordering by travel and then handing out the shares left to right builds that nesting
    // instead of discovering it one crossing at a time.
    const ordered = [...indices].sort((a, b) => travelOf(b) - travelOf(a));
    const group = new Set(ordered);
    const low = gapOf(ordered[0]).low;
    const high = Math.max(...ordered.map(index => gapOf(index).high));
    const share = (high - low) / (ordered.length + 1);

    ordered.forEach((index, position) => {
      const edge = edges[index];
      const rowY = rowYOf(edge)!;
      const section = edge.sections![0];
      const stubY = section.startPoint.y;
      const reach = gapOf(index).high;

      // This edge's own share first, then the others by how near they are to it. Targets in
      // one layer are staggered by ELK's compaction, so a share past this edge's own target
      // is no use to it.
      const own = low + share * (position + 1);
      const shares = ordered
        .map((_, i) => low + share * (i + 1))
        .filter(x => x < reach)
        .sort((a, b) => Math.abs(a - own) - Math.abs(b - own));

      const channelX = pickChannelX(index, low, reach, rowY, stubY, runs, shares, group);

      const jog = [
        { x: channelX, y: rowY },
        { x: channelX, y: stubY },
      ];
      section.bendPoints = section.bendPoints ? [...jog, ...section.bendPoints] : jog;
      section.startPoint.y = rowY;

      // Re-derived from the edge rather than assumed, so the runs after the jog — which an
      // edge that already had bends keeps — stay in the list.
      for (let i = runs.length - 1; i >= 0; i -= 1) if (runs[i].owner === index) runs.splice(i, 1);
      runs.push(...runsOf(edge, index));
    });
  }
};
