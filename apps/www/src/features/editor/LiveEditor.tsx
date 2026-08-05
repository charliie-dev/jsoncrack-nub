import React from "react";
import { useSessionStorage } from "@mantine/hooks";
import styled from "styled-components";
import { ViewMode } from "../../enums/viewMode.enum";
import { ViewTabs } from "./ViewTabs";
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
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 10px 0;
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

const StyledCanvasFrame = styled.div`
  position: relative;
  /* Takes the space the tab strip leaves rather than a fixed height, so the frame stays
     flush with the bottom of the pane whatever the strip measures. */
  flex: 1;
  min-height: 0;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
  border-radius: 12px;
  background: ${({ theme }) => theme.GRID_BG_COLOR};
  overflow: hidden;
`;

const LiveEditor = () => {
  const [viewMode, setViewMode] = useSessionStorage({
    key: "viewMode",
    defaultValue: ViewMode.Graph,
  });

  return (
    <StyledLiveEditor onContextMenuCapture={e => e.preventDefault()}>
      <StyledCanvasFrame>
        {viewMode === ViewMode.Graph && <GraphView />}
        {viewMode === ViewMode.Tree && <TreeView />}
      </StyledCanvasFrame>
      <ViewTabs viewMode={viewMode} onChange={setViewMode} />
    </StyledLiveEditor>
  );
};

export default LiveEditor;
