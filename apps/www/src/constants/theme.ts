import { latte, mocha, type CatppuccinPalette } from "jsoncrack-react/palette";

/**
 * Colours that used to be hard-coded Discord values. Mapped onto the palette so nothing
 * on screen falls outside Catppuccin. Names are kept because call sites reference them.
 */
const fixedColors = (palette: CatppuccinPalette) => ({
  CRIMSON: palette.red,
  BLURPLE: palette.blue,
  PURPLE: palette.mauve,
  FULL_WHITE: palette.text,
  BLACK: palette.crust,
  BLACK_DARK: palette.mantle,
  BLACK_LIGHT: palette.base,
  BLACK_PRIMARY: palette.surface0,
  DARK_SALMON: palette.maroon,
  DANGER: palette.red,
  LIGHTGREEN: palette.green,
  SEAGREEN: palette.teal,
  ORANGE: palette.peach,
  SILVER: palette.subtext0,
  PRIMARY: palette.surface1,
  TEXT_DANGER: palette.maroon,
});

/**
 * Colours for the tree view's labels and values.
 *
 * Not the same set as the canvas theme in jsoncrack-react: the tree distinguishes object
 * from array containers, which the canvas does not, so PARENT_OBJ and PARENT_ARR live
 * only here. The overlapping keys deliberately resolve to the same palette entries the
 * canvas uses, so a value reads the same colour in both views.
 */
const nodeColors = (palette: CatppuccinPalette) => ({
  TEXT: palette.text,
  NODE_KEY: palette.blue,
  NODE_VALUE: palette.text,
  INTEGER: palette.peach,
  NULL: palette.overlay0,
  BOOL: {
    FALSE: palette.red,
    TRUE: palette.green,
  },
  PARENT_ARR: palette.yellow,
  PARENT_OBJ: palette.blue,
  CHILD_COUNT: palette.subtext0,
  DIVIDER: palette.surface0,
});

const buildTheme = (palette: CatppuccinPalette, isDark: boolean) => ({
  ...fixedColors(palette),
  NODE_COLORS: nodeColors(palette),
  /**
   * Whether this theme is the dark flavour.
   *
   * Several call sites used to answer this by comparing BACKGROUND_SECONDARY against the
   * literal "#f2f3f5". That silently selected the light-side value for every shadow and
   * border the moment the palette changed.
   */
  IS_DARK: isDark,
  BLACK_SECONDARY: palette.mantle,
  SILVER_DARK: palette.surface2,
  NODE_KEY: palette.peach,
  OBJECT_KEY: palette.blue,
  SIDEBAR_ICONS: palette.overlay1,

  INTERACTIVE_NORMAL: palette.subtext0,
  INTERACTIVE_HOVER: palette.subtext1,
  INTERACTIVE_ACTIVE: palette.text,
  BACKGROUND_NODE: palette.mantle,
  BACKGROUND_TERTIARY: palette.crust,
  BACKGROUND_SECONDARY: palette.mantle,
  TOOLBAR_BG: palette.surface0,
  BACKGROUND_PRIMARY: palette.base,
  BACKGROUND_MODIFIER_ACCENT: palette.surface0,
  MODAL_BACKGROUND: palette.base,
  TEXT_NORMAL: palette.text,
  TEXT_POSITIVE: palette.green,
  GRID_BG_COLOR: palette.crust,
  GRID_COLOR_PRIMARY: palette.mantle,
  GRID_COLOR_SECONDARY: palette.base,
});

export const darkTheme = buildTheme(mocha, true);
export const lightTheme = buildTheme(latte, false);

const themeDs = {
  ...lightTheme,
  ...darkTheme,
};

export default themeDs;
