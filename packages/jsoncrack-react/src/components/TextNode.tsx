import React from "react";
import type { CanvasThemeMode, NodeData } from "../types";
import { nodeHeaderLabel } from "../utils/nodeHeaderLabel";
import styles from "./Node.module.css";
import { NodeHeader } from "./NodeHeader";
import { TextRenderer } from "./TextRenderer";
import { getTextColor } from "./nodeStyles";

type TextNodeProps = {
  node: NodeData;
  x: number;
  y: number;
  theme: CanvasThemeMode;
  rootLabel: string;
};

const TextNodeBase = ({ node, x, y, theme, rootLabel }: TextNodeProps) => {
  const { text, width, height } = node;
  const firstRow = text[0];

  if (!firstRow) return null;

  const value = firstRow.value;
  const label = nodeHeaderLabel(node.path, rootLabel);
  const isRoot = !node.path || node.path.length === 0;

  return (
    <foreignObject
      className={styles.foreignObject}
      data-id={`node-${node.id}`}
      width={width}
      height={height}
      x={0}
      y={0}
    >
      <NodeHeader label={label} accentKey={isRoot ? null : label} theme={theme} width={width} />
      <span
        className={styles.textNodeWrapper}
        data-x={x}
        data-y={y}
        data-key={JSON.stringify(text)}
      >
        <span className={styles.key} style={{ color: getTextColor({ value, type: typeof value }) }}>
          <TextRenderer>{value}</TextRenderer>
        </span>
      </span>
    </foreignObject>
  );
};

const propsAreEqual = (prev: TextNodeProps, next: TextNodeProps) => {
  return (
    prev.theme === next.theme &&
    prev.rootLabel === next.rootLabel &&
    prev.node.text === next.node.text &&
    prev.node.width === next.node.width
  );
};

export const TextNode = React.memo(TextNodeBase, propsAreEqual);
