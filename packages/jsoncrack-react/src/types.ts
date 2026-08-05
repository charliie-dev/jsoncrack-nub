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
 * `y` never reaches ELK — reaflow forwards a port's id and properties only, never lifting
 * coordinates onto the ELK port object, so FIXED_POS would have nothing to act on. It is
 * applied afterwards instead, by `alignEdgesToRows`, which slides each stub from the
 * position ELK guessed onto the row it actually belongs to.
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
  /**
   * Always empty, and deliberately not null.
   *
   * reaflow renders this as a label on the edge and, worse, ELK reserves layer space for
   * it, which pushed the columns apart; the key it used to carry is already on the row the
   * edge leaves from and on the target node's header. Empty string rather than null
   * because reaflow spreads the whole EdgeData into ELK's `properties`, and ELK's JSON
   * importer rejects a null value there with "Severe implementation error in the Json to
   * ElkGraph importer" and no indication of which field caused it. Nothing on this type
   * may be null for the same reason.
   */
  text: string;
  fromPort?: string;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

export type LayoutDirection = "LEFT" | "RIGHT" | "DOWN" | "UP";

export type CanvasThemeMode = "light" | "dark";
