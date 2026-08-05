/**
 * ELK options handed to reaflow's Canvas.
 *
 * Kept in its own module rather than beside the component so tests can read it without
 * pulling in reaflow and the CSS modules, neither of which resolve under the node test
 * environment.
 *
 * Values are tuned for the left-to-right key/value layout, not copied from a default.
 * Every spacing value must be a numeric string: elk parses these from strings and
 * silently ignores a number.
 */
export const layoutOptions: Record<string, string> = {
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  // Tuned against the reference UI over several passes. No edgeLabel spacing because edges
  // carry no labels: see EdgeData.text.
  //
  // These two set the corridor the edges are routed through, and they only read well
  // together. edgeNodeBetweenLayers is the clearance an edge keeps from the nodes on either
  // side, so it is the length of the straight run before an edge first turns; at 16 the
  // lines bent away the moment they left the node, which is the main thing that made this
  // look busier than the reference. nodeNodeBetweenLayers then has to leave room for that
  // clearance twice over plus the channels in between — at 60 the far side collapsed to 5px
  // and the edges arrived hard against their targets. Widening it costs nothing here: the
  // graph is as wide as its widest node either way.
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  "elk.layered.spacing.edgeNodeBetweenLayers": "40",
  "elk.spacing.nodeNode": "14",
  "elk.spacing.edgeEdge": "10",
};
