import React from "react";
import type { NodeProps } from "reaflow";
import { Node } from "reaflow";
import type { CanvasThemeMode, NodeData } from "../types";
import { ObjectNode } from "./ObjectNode";
import { TextNode } from "./TextNode";

type CustomNodeProps = NodeProps<NodeData> & {
  onNodeClick?: (node: NodeData) => void;
  /** Flavour the header colours resolve against. */
  theme: CanvasThemeMode;
  /** Header text for the root node, which has no key of its own. */
  rootLabel: string;
};

const CustomNodeBase = ({ onNodeClick, theme, rootLabel, ...nodeProps }: CustomNodeProps) => {
  const handleNodeClick = React.useCallback(
    (_: React.MouseEvent<SVGGElement, MouseEvent>, data: NodeData) => {
      onNodeClick?.(data);
    },
    [onNodeClick]
  );

  return (
    <Node
      {...nodeProps}
      onClick={handleNodeClick as any}
      animated={false}
      label={null as any}
      // Ports exist to spread outgoing edges down the node's right edge in row order, not
      // to be interacted with. Passing null suppresses reaflow's default port circles.
      port={null as any}
      onEnter={event => {
        event.currentTarget.style.stroke = "#3B82F6";
      }}
      onLeave={event => {
        event.currentTarget.style.stroke = "var(--node-stroke)";
      }}
      style={{
        fill: "var(--node-fill)",
        stroke: "var(--node-stroke)",
        strokeWidth: 1,
      }}
    >
      {({ node, x, y }) => {
        if (nodeProps.properties.text[0]?.key == null) {
          return (
            <TextNode
              node={nodeProps.properties as NodeData}
              x={x}
              y={y}
              theme={theme}
              rootLabel={rootLabel}
            />
          );
        }

        return (
          <ObjectNode node={node as NodeData} x={x} y={y} theme={theme} rootLabel={rootLabel} />
        );
      }}
    </Node>
  );
};

export const CustomNode = React.memo(CustomNodeBase);
