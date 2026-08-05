import React from "react";
import { Flex, Menu, Popover, Text, Tooltip } from "@mantine/core";
import styled from "styled-components";
import { mocha } from "jsoncrack-react/palette";
import { event as gaEvent } from "nextjs-google-analytics";
import { IoMdCheckmark, IoMdClose } from "react-icons/io";
import { LuPanelLeftClose } from "react-icons/lu";
import { LuChevronDown } from "react-icons/lu";
import {
  VscJson,
  VscListTree,
  VscRunAll,
  VscSymbolNamespace,
  VscSync,
  VscSyncIgnored,
  VscTable,
} from "react-icons/vsc";
import { FileFormat, formats } from "../../enums/file.enum";
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

/** One icon per format, coloured by the accent the format owns. */
const FORMAT_ICONS: Record<FileFormat, React.ReactNode> = {
  [FileFormat.JSON]: <VscJson />,
  [FileFormat.YAML]: <VscListTree />,
  [FileFormat.XML]: <VscSymbolNamespace />,
  [FileFormat.CSV]: <VscTable />,
};

/**
 * Filled circle with a symbol punched out of it, matching the reference UI.
 *
 * A bare outline icon reads as one more toolbar glyph; the solid disc is what makes the
 * validation state legible at a glance without a text label beside it.
 */
const StyledStatusBadge = styled.span<{ $tone: LampTone }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  background: ${({ theme, $tone }) =>
    $tone === "positive" ? theme.LIGHTGREEN : $tone === "negative" ? theme.CRIMSON : theme.ORANGE};
  /* Punched out in the page background rather than plain white so the disc keeps working
     in both flavours. */
  color: ${({ theme }) => theme.BACKGROUND_PRIMARY};
`;

type LampTone = "positive" | "negative" | "caution";

type LampState = {
  tone: LampTone;
  glyph: React.ReactNode;
  label: string;
  /** Popover body. Null means the state needs no explanation, which is the passing case. */
  detail: string | null;
  /** Shown beside the badge when there is a number worth surfacing without a hover. */
  count: number | null;
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
  const format = useFile(state => state.format);
  const yamlValidatorError = useFile(state => state.yamlValidatorError);

  if (error) {
    return { tone: "negative", glyph: <IoMdClose />, label: "Invalid", detail: error, count: null };
  }

  // A YAML document whose validator never loaded has not been checked, whatever the
  // absence of markers might otherwise suggest.
  if (format === FileFormat.YAML && yamlValidatorError) {
    return {
      tone: "caution",
      glyph: "!",
      label: "Not checked",
      detail: yamlValidatorError,
      count: null,
    };
  }

  if (schemaValidation.status === "unavailable") {
    return {
      tone: "caution",
      glyph: "!",
      label: "Not checked",
      detail: schemaValidation.reason ?? "The schema could not be compiled",
      count: null,
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
      tone: "negative",
      glyph: <IoMdClose />,
      label: `${issues.length} problem${issues.length === 1 ? "" : "s"}`,
      detail: issues.map(issue => `${issue.path}  ${issue.message}`).join("\n"),
      count: issues.length,
    };
  }

  return { tone: "positive", glyph: <IoMdCheckmark />, label: "Valid", detail: null, count: null };
};

export const PaneBar = () => {
  const documentName = useFile(state => state.documentName);
  const toggleLiveTransform = useConfig(state => state.toggleLiveTransform);
  const liveTransformEnabled = useConfig(state => state.liveTransformEnabled);
  const error = useFile(state => state.error);
  const setContents = useFile(state => state.setContents);
  const toggleFullscreen = useGraph(state => state.toggleFullscreen);
  const fullscreen = useGraph(state => state.fullscreen);
  const setFormat = useFile(state => state.setFormat);
  const currentFormat = useFile(state => state.format);
  const currentFormatAccent =
    formats.find(format => format.value === currentFormat)?.accent ?? "blue";
  const setVisible = useModal(state => state.setVisible);
  const lamp = useLampState();

  const toggleEditor = () => {
    toggleFullscreen(!fullscreen);
    gaEvent("toggle_fullscreen");
  };

  React.useEffect(() => {
    window.document.title = documentName ? `${documentName} | JSON Crack` : "JSON Crack";
  }, [documentName]);

  return (
    <StyledPaneBar>
      <StyledLeft>
        <Tooltip label="Close editor" position="bottom" withArrow openDelay={750}>
          <StyledPaneBarItem onClick={toggleEditor} aria-label="close editor">
            <LuPanelLeftClose size={14} />
          </StyledPaneBarItem>
        </Tooltip>
        {/* Icon only. The label is carried by the tooltip and the popover, which keeps the
            passing state quiet: a document that validates does not need a word for it. */}
        <StyledPaneBarItem aria-label={lamp.label}>
          {lamp.detail ? (
            // Anchored below: this bar sits at the top of the pane, so a popover opening
            // upwards would leave the viewport.
            <Popover width="auto" shadow="md" position="bottom" withArrow>
              <Popover.Target>
                <Flex align="center" gap={4}>
                  <StyledStatusBadge $tone={lamp.tone}>{lamp.glyph}</StyledStatusBadge>
                  {lamp.count !== null && (
                    <Text fw={600} fz="xs">
                      {lamp.count}
                    </Text>
                  )}
                </Flex>
              </Popover.Target>
              <Popover.Dropdown style={{ pointerEvents: "none", maxWidth: 480 }}>
                <Text fw={600} fz="xs" mb={4}>
                  {lamp.label}
                </Text>
                <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
                  {lamp.detail}
                </Text>
              </Popover.Dropdown>
            </Popover>
          ) : (
            <Tooltip label={lamp.label} position="bottom" withArrow openDelay={400}>
              <Flex align="center">
                <StyledStatusBadge $tone={lamp.tone}>{lamp.glyph}</StyledStatusBadge>
              </Flex>
            </Tooltip>
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
              <Flex align="center" gap={4} c={mocha[currentFormatAccent]}>
                {FORMAT_ICONS[currentFormat]}
                <Text size="xs" fw={600}>
                  {currentFormat?.toUpperCase()}
                </Text>
                <LuChevronDown size={12} />
              </Flex>
            </StyledPaneBarItem>
          </Menu.Target>
          <Menu.Dropdown>
            {formats.map(format => (
              <Menu.Item
                key={format.value}
                onClick={() => setFormat(format.value)}
                leftSection={FORMAT_ICONS[format.value]}
                rightSection={currentFormat === format.value && <IoMdCheckmark />}
                c={mocha[format.accent]}
                fw={600}
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
