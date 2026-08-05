/**
 * Single source for node geometry.
 *
 * These numbers used to exist in three places: this package's calculateNodeSize, its
 * ObjectNode, and apps/www's constants/graph. Edge ports are anchored to individual rows,
 * and that y offset has to agree with the height the layout was given, so a second copy is
 * no longer merely untidy.
 */
export const NODE_DIMENSIONS = {
  /** Height of one key/value row inside a node. */
  ROW_HEIGHT: 26,
  /** Height of a node whose body is a single scalar value. */
  PARENT_HEIGHT: 36,
  /** Height of the coloured header strip above every node's body. */
  HEADER_HEIGHT: 30,
} as const;
