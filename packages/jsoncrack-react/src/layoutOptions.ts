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
  "elk.layered.spacing.nodeNodeBetweenLayers": "50",
  "elk.layered.spacing.edgeNodeBetweenLayers": "16",
  "elk.spacing.nodeNode": "14",
  "elk.spacing.edgeEdge": "10",
};
