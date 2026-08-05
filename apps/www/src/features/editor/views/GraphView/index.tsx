import React from "react";
import { Box } from "@mantine/core";
import styled from "styled-components";
import { JSONCrack } from "jsoncrack-react";
import type { JSONCrackRef, NodeData } from "jsoncrack-react";
import { SUPPORTED_LIMIT } from "../../../../constants/graph";
import useConfig from "../../../../store/useConfig";
import useFile from "../../../../store/useFile";
import useJson from "../../../../store/useJson";
import { useModal } from "../../../../store/useModal";
import { EmptyState } from "./EmptyState";
import { NotSupported } from "./NotSupported";
import { SecureInfo } from "./SecureInfo";
import { Toolbar } from "./Toolbar";
import useGraph from "./stores/useGraph";

const StyledEditorWrapper = styled.div<{ $widget: boolean }>`
  width: 100%;
  height: 100%;

  .jsoncrack-space {
    cursor: url("/assets/cursor.svg"), auto;
  }

  .jsoncrack-space:active {
    cursor: grabbing;
  }

  .jsoncrack-space rect {
    rx: 5;
    ry: 5;
    stroke-width: 1;
    filter: drop-shadow(
      2px 2px 0 ${({ theme }) => (theme.IS_DARK ? "rgba(0, 0, 0, 0.6)" : "rgba(15, 23, 42, 0.25)")}
    );
  }

  .jsoncrack-space path {
    stroke-linecap: round;
    stroke-linejoin: round;
  }
`;

interface GraphProps {
  isWidget?: boolean;
}

export const GraphView = ({ isWidget = false }: GraphProps) => {
  const setViewPort = useGraph(state => state.setViewPort);
  const setJsonCrackRef = useGraph(state => state.setJsonCrackRef);
  const direction = useGraph(state => state.direction);
  const setSelectedNode = useGraph(state => state.setSelectedNode);
  const setCollapsedCount = useGraph(state => state.setCollapsedCount);
  const gesturesEnabled = useConfig(state => state.gesturesEnabled);
  const rulersEnabled = useConfig(state => state.rulersEnabled);
  const darkmodeEnabled = useConfig(state => state.darkmodeEnabled);
  const json = useJson(state => state.json);
  const contents = useFile(state => state.contents);
  const setVisible = useModal(state => state.setVisible);
  /**
   * Show the picker only when the canvas has nothing on it *and* the editor is empty.
   *
   * Checking the editor alone was wrong: with Live Transform off the graph deliberately
   * keeps the last transformed document, so clearing the text laid the picker on top of a
   * still-rendered graph. Checking the canvas alone would be wrong too, since a user who
   * types `{}` gets an empty-looking graph they did not ask to have covered.
   *
   * Widgets are excluded outright: they are embedded with no editor to type into.
   */
  const showEmptyState = !isWidget && (!json || json === "{}") && contents.trim().length === 0;
  const jsonCrackRef = React.useRef<JSONCrackRef>(null);

  React.useEffect(() => {
    setJsonCrackRef(jsonCrackRef);
  }, [setJsonCrackRef]);

  const handleCollapseChange = React.useCallback(
    (paths: string[]) => setCollapsedCount(paths.length),
    [setCollapsedCount]
  );

  const blurOnClick = React.useCallback(() => {
    if ("activeElement" in document) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }, []);

  const handleNodeClick = React.useCallback(
    (node: NodeData) => {
      setSelectedNode(node);
      setVisible("NodeModal", true);
    },
    [setSelectedNode, setVisible]
  );

  const maxVisibleNodes = Number.isFinite(SUPPORTED_LIMIT) ? SUPPORTED_LIMIT : 1500;

  return (
    <Box pos="relative" h="100%" w="100%">
      {showEmptyState && <EmptyState />}
      {!isWidget && <SecureInfo />}
      {!isWidget && <Toolbar />}
      <StyledEditorWrapper
        $widget={isWidget}
        onContextMenu={event => event.preventDefault()}
        onClick={blurOnClick}
      >
        <JSONCrack
          ref={jsonCrackRef}
          key={[direction, gesturesEnabled, rulersEnabled].join("-")}
          json={json}
          theme={darkmodeEnabled ? "dark" : "light"}
          layoutDirection={direction}
          showControls={false}
          showGrid={rulersEnabled}
          trackpadZoom={gesturesEnabled}
          maxRenderableNodes={maxVisibleNodes}
          centerOnLayout
          onViewportCreate={setViewPort}
          onNodeClick={handleNodeClick}
          onCollapseChange={handleCollapseChange}
          renderNodeLimitExceeded={() => <NotSupported />}
        />
      </StyledEditorWrapper>
    </Box>
  );
};
