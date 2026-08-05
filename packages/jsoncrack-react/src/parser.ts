import { getNodePath, parseTree, type Node, type ParseError } from "jsonc-parser";
import { NODE_DIMENSIONS } from "./nodeDimensions";
import type { EdgeData, GraphData, NodeData, NodeRow, PortData } from "./types";
import { calculateNodeSize } from "./utils/calculateNodeSize";
import { DEFAULT_ROOT_LABEL, nodeHeaderLabel } from "./utils/nodeHeaderLabel";

/**
 * Vertical centre of a row, measured from the node's top edge.
 *
 * Shares HEADER_HEIGHT with calculateNodeSize and ObjectNode's row positioning; all three
 * start the body below the header, and a disagreement would put every edge one header out
 * of line with no error anywhere.
 */
const portOffsetForRow = (rowIndex: number) =>
  NODE_DIMENSIONS.HEADER_HEIGHT +
  rowIndex * NODE_DIMENSIONS.ROW_HEIGHT +
  NODE_DIMENSIONS.ROW_HEIGHT / 2;

const createPort = (nodeId: string, rowIndex: number, sequence: number): PortData => ({
  id: `port-${nodeId}-${rowIndex}-${sequence}`,
  width: 1,
  height: 1,
  side: "EAST",
  y: portOffsetForRow(rowIndex),
});

export interface ParseGraphResult extends GraphData {
  errors: ParseError[];
}

export const parseGraph = (
  json: string,
  /** Header text for the root node, needed here so its width accounts for the label. */
  rootLabel: string = DEFAULT_ROOT_LABEL
): ParseGraphResult => {
  const parseErrors: ParseError[] = [];
  const jsonTree = parseTree(json, parseErrors);

  if (!jsonTree) {
    return {
      nodes: [],
      edges: [],
      errors: parseErrors,
    };
  }

  const nodes: NodeData[] = [];
  const edges: EdgeData[] = [];
  let nodeId = 1;
  let edgeId = 1;

  function traverse(node: Node, parentId?: string): string | undefined {
    const id = String(nodeId++);
    const text: NodeRow[] = [];
    const ports: PortData[] = [];

    if (parentId !== undefined && node.parent?.type === "array") {
      edges.push({
        id: String(edgeId++),
        from: parentId,
        to: id,
        text: "",
      });
    }

    const isArray = node.type === "array";
    const isRootArray = !node.parent || node.parent.type === "array";

    if (isArray && isRootArray) {
      const { width, height } = calculateNodeSize(
        `[${node.children?.length ?? "0"} items]`,
        false,
        nodeHeaderLabel([], rootLabel)
      );

      nodes.push({
        id,
        text: [
          {
            key: null,
            value: `[${node.children?.length ?? 0} items]`,
            type: "array",
            childrenCount: node.children?.length,
          },
        ],
        width,
        height,
        path: [],
      });

      node.children?.forEach(child => {
        traverse(child, id);
      });

      return id;
    }

    node.children?.forEach(child => {
      if (!child.children || !child.children[1]) {
        traverse(child, id);
        return;
      }

      const key = child.children[0].value?.toString() ?? null;
      const valueNode = child.children[1];
      const type = valueNode.type;

      if (type === "array") {
        const targetIds: string[] = [];

        valueNode.children?.forEach(arrayChild => {
          const arrayChildId = traverse(arrayChild, undefined);
          if (arrayChildId) targetIds.push(arrayChildId);
        });

        text.push({
          key,
          value: valueNode.value as NodeRow["value"],
          type,
          to: targetIds.length > 0 ? targetIds : undefined,
          childrenCount: valueNode.children?.length,
        });

        const arrayRowIndex = text.length - 1;

        targetIds.forEach((targetId, sequence) => {
          const port = createPort(id, arrayRowIndex, sequence);
          ports.push(port);

          edges.push({
            id: String(edgeId++),
            from: id,
            to: targetId,
            text: "",
            fromPort: port.id,
          });
        });
      } else if (type === "object") {
        const objectNodeId = traverse(valueNode, id);

        text.push({
          key,
          value: valueNode.value as NodeRow["value"],
          type,
          childrenCount: Object.keys(valueNode.children ?? {}).length,
          ...(objectNodeId && { to: [objectNodeId] }),
        });

        if (objectNodeId) {
          const port = createPort(id, text.length - 1, 0);
          ports.push(port);

          edges.push({
            id: String(edgeId++),
            from: id,
            to: objectNodeId,
            text: "",
            fromPort: port.id,
          });
        }
      } else {
        text.push({
          key,
          value: valueNode.value as NodeRow["value"],
          type,
        });
      }
    });

    if (node.parent?.type === "array" && node.type === "object" && node.children?.length === 0) {
      text.push({
        key: null,
        value: "{0 keys}",
        type: "object",
        childrenCount: 0,
      });
    }

    const appendParentKey = () => {
      const getParentKey = (targetNode: Node) => {
        const path = getNodePath(targetNode);
        return path?.pop()?.toString();
      };

      if (!node.parent) {
        return { parentKey: getParentKey(node), parentType: node.type };
      }

      if (node.parent.type === "array") {
        return { parentKey: getParentKey(node.parent), parentType: "array" };
      }

      if (node.parent.type === "property") {
        return { parentKey: getParentKey(node), parentType: "object" };
      }

      return {
        parentKey: getParentKey(node),
        parentType: node.parent.type.replace("property", "object"),
      };
    };

    if (text.length === 0) {
      if (typeof node.value === "undefined") return undefined;

      const { width, height } = calculateNodeSize(
        node.value as string | number,
        false,
        nodeHeaderLabel(getNodePath(node), rootLabel)
      );

      nodes.push({
        id,
        text: [
          {
            key: null,
            value: node.value as NodeRow["value"],
            type: node.type,
          },
        ],
        width,
        height,
        path: getNodePath(node),
        ...appendParentKey(),
      });
    } else {
      let displayText: string | [string, string][];

      if (text.some(row => row.key !== null)) {
        displayText = text.map(row => {
          const keyStr = row.key === null ? "" : row.key;

          if (row.type === "object") return [keyStr, `{${row.childrenCount ?? 0} keys}`];
          if (row.type === "array") return [keyStr, `[${row.childrenCount ?? 0} items]`];
          if (row.value === null) return [keyStr, "null"];

          return [keyStr, `${row.value}`];
        });
      } else {
        displayText = `${text[0].value}`;
      }

      const { width, height } = calculateNodeSize(
        displayText,
        false,
        nodeHeaderLabel(getNodePath(node), rootLabel)
      );

      nodes.push({
        id,
        text,
        width,
        height,
        path: getNodePath(node),
        ...appendParentKey(),
        ...(ports.length > 0 && { ports }),
      });
    }

    return id;
  }

  traverse(jsonTree);

  return {
    nodes,
    edges,
    errors: parseErrors,
  };
};
