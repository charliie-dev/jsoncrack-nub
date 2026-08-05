import React from "react";
import { Flex, Menu, Popover, Text, Tooltip } from "@mantine/core";
import styled from "styled-components";
import { event as gaEvent } from "nextjs-google-analytics";
import { IoMdCheckmark } from "react-icons/io";
import { LuPanelLeftClose } from "react-icons/lu";
import { LuChevronDown } from "react-icons/lu";
import {
  VscCheck,
  VscError,
  VscJson,
  VscRunAll,
  VscSync,
  VscSyncIgnored,
  VscWarning,
} from "react-icons/vsc";
import { formats } from "../../enums/file.enum";
import useConfig from "../../store/useConfig";
import useFile from "../../store/useFile";
import { useModal } from "../../store/useModal";
import useGraph from "./views/GraphView/stores/useGraph";

const StyledPaneBar = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  border-bottom: 1px solid ${({ theme }) => theme.BACKGROUND_MODIFIER_ACCENT};
  background: ${({ theme }) => theme.TOOLBAR_BG};
  z-index: 2;
  flex-shrink: 0;

  @media screen and (max-width: 320px) {
    display: none;
  }
`;

const StyledLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0;

  @media screen and (max-width: 480px) {
    display: none;
  }
`;

const StyledRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0;
`;

const StyledPaneBarItem = styled.button<{ $bg?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: fit-content;
  margin: 0;
  height: 26px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.INTERACTIVE_NORMAL};
  background: ${({ $bg }) => $bg || "transparent"};
  border: none;
  border-radius: 6px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;

  &:hover:not(&:disabled) {
    background-color: ${({ theme }) =>
      theme.IS_DARK ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"};
    color: ${({ theme }) => theme.INTERACTIVE_HOVER};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

type LampState = {
  icon: React.ReactNode;
  label: string;
  /** Popover body. Null means the state needs no explanation, which is the passing case. */
  detail: string | null;
};

/**
 * What the validation lamp shows, in priority order.
 *
 * A parse failure outranks everything because nothing downstream had valid input. "Not
 * checked" outranks the pass case so a schema that could not compile never reads as a
 * tick. Monaco markers and ajv issues never coexist: JSON and YAML produce the former,
 * XML and CSV the latter.
 */
const useLampState = (): LampState => {
  const error = useFile(state => state.error);
  const markers = useFile(state => state.markers);
  const schemaValidation = useFile(state => state.schemaValidation);

  if (error) {
    return { icon: <VscError color="red" />, label: "Invalid", detail: error };
  }

  if (schemaValidation.status === "unavailable") {
    return {
      icon: <VscWarning />,
      label: "Not checked",
      detail: schemaValidation.reason ?? "The schema could not be compiled",
    };
  }

  const issues =
    markers.length > 0
      ? markers
      : schemaValidation.status === "invalid"
        ? schemaValidation.issues
        : [];

  if (issues.length > 0) {
    return {
      icon: <VscError color="red" />,
      label: `${issues.length} problem${issues.length === 1 ? "" : "s"}`,
      detail: issues.map(issue => `${issue.path}  ${issue.message}`).join("\n"),
    };
  }

  return { icon: <VscCheck />, label: "Valid", detail: null };
};

export const PaneBar = () => {
  const data = useFile(state => state.fileData);
  const toggleLiveTransform = useConfig(state => state.toggleLiveTransform);
  const liveTransformEnabled = useConfig(state => state.liveTransformEnabled);
  const error = useFile(state => state.error);
  const setContents = useFile(state => state.setContents);
  const toggleFullscreen = useGraph(state => state.toggleFullscreen);
  const fullscreen = useGraph(state => state.fullscreen);
  const setFormat = useFile(state => state.setFormat);
  const currentFormat = useFile(state => state.format);
  const setVisible = useModal(state => state.setVisible);
  const lamp = useLampState();

  const toggleEditor = () => {
    toggleFullscreen(!fullscreen);
    gaEvent("toggle_fullscreen");
  };

  React.useEffect(() => {
    if (data?.name) window.document.title = `${data.name} | JSON Crack`;
  }, [data]);

  return (
    <StyledPaneBar>
      <StyledLeft>
        <Tooltip label="Close editor" position="bottom" withArrow openDelay={750}>
          <StyledPaneBarItem onClick={toggleEditor} aria-label="close editor">
            <LuPanelLeftClose size={14} />
          </StyledPaneBarItem>
        </Tooltip>
        <StyledPaneBarItem>
          {lamp.detail ? (
            // Anchored below: this bar sits at the top of the pane, so a popover opening
            // upwards would leave the viewport.
            <Popover width="auto" shadow="md" position="bottom" withArrow>
              <Popover.Target>
                <Flex align="center" gap={2}>
                  {lamp.icon}
                  <Text fw={500} fz="xs">
                    {lamp.label}
                  </Text>
                </Flex>
              </Popover.Target>
              <Popover.Dropdown style={{ pointerEvents: "none", maxWidth: 480 }}>
                <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
                  {lamp.detail}
                </Text>
              </Popover.Dropdown>
            </Popover>
          ) : (
            <Flex align="center" gap={2}>
              {lamp.icon}
              <Text size="xs">{lamp.label}</Text>
            </Flex>
          )}
        </StyledPaneBarItem>
        <StyledPaneBarItem
          onClick={() => {
            toggleLiveTransform(!liveTransformEnabled);
            gaEvent("toggle_live_transform");
          }}
        >
          {liveTransformEnabled ? <VscSync /> : <VscSyncIgnored />}
          <Text fz="xs">Live Transform</Text>
        </StyledPaneBarItem>
        {!liveTransformEnabled && (
          <StyledPaneBarItem onClick={() => setContents({})} disabled={!!error}>
            <VscRunAll />
            Click to Transform
          </StyledPaneBarItem>
        )}
      </StyledLeft>

      <StyledRight>
        <Tooltip label="Validate against a JSON Schema" position="bottom" withArrow openDelay={750}>
          <StyledPaneBarItem
            onClick={() => {
              setVisible("SchemaModal", true);
              gaEvent("open_schema_modal");
            }}
          >
            <VscJson />
            <Text fz="xs">JSON Schema</Text>
          </StyledPaneBarItem>
        </Tooltip>
        <Menu offset={8}>
          <Menu.Target>
            <StyledPaneBarItem>
              <Flex align="center" gap={2}>
                <Text size="xs">{currentFormat?.toUpperCase()}</Text>
                <LuChevronDown size={12} />
              </Flex>
            </StyledPaneBarItem>
          </Menu.Target>
          <Menu.Dropdown>
            {formats.map(format => (
              <Menu.Item
                key={format.value}
                onClick={() => setFormat(format.value)}
                rightSection={currentFormat === format.value && <IoMdCheckmark />}
              >
                {format.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </StyledRight>
    </StyledPaneBar>
  );
};
