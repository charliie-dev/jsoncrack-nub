import type { CatppuccinPalette } from "./catppuccin";
import { latte, mocha } from "./catppuccin";
import type { CanvasThemeMode } from "./types";
import { mixHex } from "./utils/accentForKey";

export interface JSONCrackTheme {
  NODE_COLORS: {
    TEXT: string;
    NODE_KEY: string;
    NODE_VALUE: string;
    INTEGER: string;
    NULL: string;
    BOOL: {
      FALSE: string;
      TRUE: string;
    };
    CHILD_COUNT: string;
    DIVIDER: string;
    /** Header label colour. The header background is the same accent mixed into BASE. */
    HEADER_TEXT: string;
  };
  INTERACTIVE_NORMAL: string;
  BACKGROUND_NODE: string;
  BACKGROUND_MODIFIER_ACCENT: string;
  TEXT_POSITIVE: string;
  GRID_BG_COLOR: string;
  GRID_COLOR_PRIMARY: string;
  GRID_COLOR_SECONDARY: string;
  /** Flavour base, needed by consumers that mix accents against it. */
  BASE: string;
  EDGE_STROKE: string;
  NODE_FILL: string;
  NODE_STROKE: string;
  SPINNER_TRACK: string;
  SPINNER_HEAD: string;
  OVERLAY_BG: string;
}

/**
 * Derive a canvas theme from a Catppuccin flavour.
 *
 * Every value comes from the palette. The canvas used to carry a second set of colours
 * hard-coded as `isDark ? a : b` inside buildCanvasStyle, which meant half the surface
 * ignored the theme entirely; those are now tokens here.
 */
const buildTheme = (palette: CatppuccinPalette): JSONCrackTheme => ({
  NODE_COLORS: {
    TEXT: palette.text,
    NODE_KEY: palette.blue,
    NODE_VALUE: palette.text,
    INTEGER: palette.peach,
    NULL: palette.overlay0,
    BOOL: {
      FALSE: palette.red,
      TRUE: palette.green,
    },
    CHILD_COUNT: palette.subtext0,
    DIVIDER: palette.surface0,
    HEADER_TEXT: palette.subtext1,
  },
  INTERACTIVE_NORMAL: palette.subtext0,
  BACKGROUND_NODE: palette.mantle,
  BACKGROUND_MODIFIER_ACCENT: palette.surface0,
  TEXT_POSITIVE: palette.green,
  GRID_BG_COLOR: palette.crust,
  // Dots, so this sits between the background and surface0: mantle alone was invisible
  // against crust, while surface0 at full strength competed with the nodes. Mixed rather
  // than given an alpha so the value stays a plain hex like every other token.
  GRID_COLOR_PRIMARY: mixHex(palette.surface0, palette.crust, 0.45),
  GRID_COLOR_SECONDARY: palette.base,
  BASE: palette.base,
  EDGE_STROKE: palette.surface2,
  NODE_FILL: palette.mantle,
  NODE_STROKE: palette.surface0,
  SPINNER_TRACK: palette.surface1,
  SPINNER_HEAD: palette.text,
  OVERLAY_BG: palette.crust,
});

export const themes: Record<CanvasThemeMode, JSONCrackTheme> = {
  dark: buildTheme(mocha),
  light: buildTheme(latte),
};
