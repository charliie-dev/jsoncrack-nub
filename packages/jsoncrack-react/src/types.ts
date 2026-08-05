import type { JSONPath, Node } from "jsonc-parser";

export interface NodeRow {
  key: string | null;
  value: string | number | null | boolean;
  type: Node["type"];
  childrenCount?: number;
  to?: string[];
}

/**
 * An anchor on a node's right edge that an outgoing edge leaves from.
 *
 * One per row that points at a child, declared in row order. reaflow hard-codes
 * `portConstraints: FIXED_ORDER` on every node, so ELK preserves that order but chooses
 * the spacing itself: edges fan out down the right-hand side in the same sequence as the
 * rows they belong to, rather than all emerging from one point.
 *
 * `y` is not read by ELK. reaflow only forwards a port's id and properties, never lifting
 * coordinates onto the ELK port object, so FIXED_POS has nothing to act on. It is kept
 * because it is the offset the row actually sits at and any future exact-alignment work
 * needs it.
 */
export interface PortData {
  id: string;
  width: number;
  height: number;
  side: "EAST";
  /** Offset from the node's top edge to the middle of the owning row. */
  y: number;
}

export interface NodeData {
  id: string;
  text: Array<NodeRow>;
  width: number;
  height: number;
  path?: JSONPath;
  parentKey?: string;
  parentType?: string;
  ports?: PortData[];
}

export interface EdgeData {
  id: string;
  from: string;
  to: string;
  text: string | null;
  fromPort?: string;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

export type LayoutDirection = "LEFT" | "RIGHT" | "DOWN" | "UP";

export type CanvasThemeMode = "light" | "dark";
