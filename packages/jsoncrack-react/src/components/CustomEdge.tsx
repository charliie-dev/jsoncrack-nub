import React from "react";
import type { ViewPort } from "react-zoomable-ui";
import type { EdgeProps } from "reaflow";
import { Edge } from "reaflow";
import type { EdgeData } from "../types";
import { roundedOrthogonalPath } from "../utils/roundedOrthogonalPath";

type QueryRoot = {
  querySelector: (selector: string) => Element | null;
};

type CustomEdgeProps = EdgeProps & {
  viewPort: ViewPort | null;
  edgeTargetById: Map<string, string>;
  hostElement: QueryRoot | null;
};

const isQueryRoot = (value: unknown): value is QueryRoot => {
  return (
    typeof value === "object" &&
    value !== null &&
    "querySelector" in value &&
    typeof (value as QueryRoot).querySelector === "function"
  );
};

const CustomEdgeBase = ({ viewPort, edgeTargetById, hostElement, ...props }: CustomEdgeProps) => {
  const [hovered, setHovered] = React.useState(false);
  const edgeId = (props.properties as EdgeData | undefined)?.id;

  const handleClick = React.useCallback(() => {
    const targetNodeId = edgeId ? edgeTargetById.get(edgeId) : undefined;
    if (!targetNodeId) return;

    const queryRoot = isQueryRoot(hostElement)
      ? hostElement
      : typeof document !== "undefined"
        ? document
        : null;
    if (!queryRoot) return;

    const targetNodeDom = queryRoot.querySelector(
      `[data-id$="node-${targetNodeId}"]`
    ) as HTMLElement | null;

    if (targetNodeDom?.parentElement) {
      viewPort?.camera.centerFitElementIntoView(targetNodeDom.parentElement, {
        elementExtraMarginForZoom: 150,
      });
    }
  }, [hostElement, edgeId, edgeTargetById, viewPort]);

  return (
    <Edge
      containerClassName={`edge-${props.id}`}
      onClick={handleClick}
      onEnter={() => setHovered(true)}
      onLeave={() => setHovered(false)}
      style={{
        stroke: hovered ? "#3B82F6" : "var(--edge-stroke)",
        strokeWidth: 1.5,
      }}
      {...props}
      // After the spread so it cannot be overridden. reaflow's own options are both wrong
      // here: "curved" runs ELK's bend points through curveBundle and loses the orthogonal
      // routing, while "linear" keeps it but leaves the corners sharp. Passing a function
      // makes reaflow use it as the path generator, so the straight runs survive and only
      // the corners are softened.
      interpolation={roundedOrthogonalPath}
    />
  );
};

export const CustomEdge = React.memo(CustomEdgeBase);
