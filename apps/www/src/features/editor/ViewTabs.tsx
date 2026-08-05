import React from "react";
import styled from "styled-components";
import { event as gaEvent } from "nextjs-google-analytics";
import { LuListTree, LuNetwork } from "react-icons/lu";
import { ViewMode } from "../../enums/viewMode.enum";

const StyledTabs = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 6px 4px 0;
`;

const StyledTab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.TEXT_NORMAL : theme.INTERACTIVE_NORMAL)};
  background: ${({ theme, $active }) => ($active ? theme.BACKGROUND_MODIFIER_ACCENT : "transparent")};
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.INTERACTIVE_HOVER};
  }
`;

const TABS = [
  { mode: ViewMode.Graph, label: "Graph", icon: <LuNetwork size={13} /> },
  { mode: ViewMode.Tree, label: "Tree", icon: <LuListTree size={13} /> },
] as const;

type ViewTabsProps = {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
};

/**
 * View switcher below the canvas.
 *
 * The reference UI labels its two the same way it names its own concepts; these are named
 * for what this app actually renders, a node graph and a collapsible tree, rather than
 * borrowing labels that would describe neither.
 *
 * Shares the `viewMode` session key with the View menu, so the two stay in step.
 */
export const ViewTabs = ({ viewMode, onChange }: ViewTabsProps) => (
  <StyledTabs>
    {TABS.map(tab => (
      <StyledTab
        key={tab.mode}
        type="button"
        $active={viewMode === tab.mode}
        aria-pressed={viewMode === tab.mode}
        onClick={() => {
          onChange(tab.mode);
          gaEvent("change_view_mode", { label: tab.mode });
        }}
      >
        {tab.icon}
        {tab.label}
      </StyledTab>
    ))}
  </StyledTabs>
);
