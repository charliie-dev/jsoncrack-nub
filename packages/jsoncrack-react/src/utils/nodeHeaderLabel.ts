import type { JSONPath } from "jsonc-parser";

/** Header text for a document whose own name is unknown. Matches what the editor shows in its tab. */
export const DEFAULT_ROOT_LABEL = "Untitled";

/**
 * Header text for a node, derived from its JSON path.
 *
 * NodeData.parentKey is not usable here: for an array element it holds the container's
 * name, so both workspaces[0] and workspaces[1] would read "workspaces". The path keeps
 * the index, so it is the only input that can tell them apart.
 */
export const nodeHeaderLabel = (path: JSONPath | undefined, rootLabel: string): string => {
  if (!path || path.length === 0) return rootLabel || DEFAULT_ROOT_LABEL;

  const last = path[path.length - 1];

  if (typeof last === "number") {
    const container = path.length > 1 ? path[path.length - 2] : "";
    return `${container}[${last}]`;
  }

  return String(last);
};
