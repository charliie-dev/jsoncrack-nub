import React from "react";
import { useSessionStorage } from "@mantine/hooks";
import styled from "styled-components";
import { ViewMode } from "../../enums/viewMode.enum";
import { GraphView } from "./views/GraphView";
import { TreeView } from "./views/TreeView";

/**
 * Frames the canvas rather than letting it run to the window edge.
 *
 * The padding and the inner rounded border are what separate the diagram from the editor
 * pane and the app chrome; without them the dotted background reads as the page itself.
 */
const StyledLiveEditor = styled.div`
  position: relative;
  height: 100%;
  padding: 10px;
  background: ${({ theme }) => theme.BACKGROUND_TERTIARY};
  overflow: hidden;

  & > ul {
    margin-top: 0 !important;
    padding: 12px !important;
    font-family: monospace;
    font-size: 14px;
    font-weight: 500;
  }

  .tab-group {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 2;
  }
`;

const View = () => {
  const [viewMode] = useSessionStorage({
    key: "viewMode",
    defaultValue: ViewMode.Graph,
  });

  if (viewMode === ViewMode.Graph) return <GraphView />;
  if (viewMode === ViewMode.Tree) return <TreeView />;
  return null;
};

const StyledCanvasFrame = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
  border-radius: 12px;
  background: ${({ theme }) => theme.GRID_BG_COLOR};
  overflow: hidden;
`;

const LiveEditor = () => {
  return (
    <StyledLiveEditor onContextMenuCapture={e => e.preventDefault()}>
      <StyledCanvasFrame>
        <View />
      </StyledCanvasFrame>
    </StyledLiveEditor>
  );
};

export default LiveEditor;
