import React from "react";
import { latte, mocha } from "../catppuccin";
import type { CanvasThemeMode } from "../types";
import { ROOT_ACCENT, accentForKey, mixHex } from "../utils/accentForKey";
import styles from "./Node.module.css";

/** How much of the accent is mixed into the flavour base for the header background. */
const HEADER_BG_RATIO = 0.15;

const palettes = { dark: mocha, light: latte } as const;

/**
 * Header text and background for a node.
 *
 * Exported separately from the component so the colour decision is unit-testable without
 * rendering a foreignObject.
 */
export const headerColors = (accentKey: string | null, theme: CanvasThemeMode) => {
  const palette = palettes[theme];
  const accent = palette[accentKey === null ? ROOT_ACCENT : accentForKey(accentKey)];

  return {
    text: accent,
    background: mixHex(accent, palette.base, HEADER_BG_RATIO),
  };
};

type NodeHeaderProps = {
  label: string;
  /** Key name to hash for the accent. Null for the root node, which uses a fixed accent. */
  accentKey: string | null;
  theme: CanvasThemeMode;
  width: number;
};

export const NodeHeader = ({ label, accentKey, theme, width }: NodeHeaderProps) => {
  const { text, background } = headerColors(accentKey, theme);

  return (
    <div
      className={styles.header}
      style={{
        width,
        color: text,
        background,
      }}
      data-header-label={label}
    >
      {label}
    </div>
  );
};
