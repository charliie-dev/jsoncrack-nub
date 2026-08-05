import { latte, mocha, type CatppuccinPalette } from "jsoncrack-react/palette";

/**
 * Monaco theme names registered by `defineCatppuccinThemes`.
 *
 * The editor used to pass Monaco's built-in "vs-dark" and "light" straight through, so the
 * text pane kept VS Code's default palette while everything around it was Catppuccin.
 */
export const MONACO_THEME = {
  dark: "catppuccin-mocha",
  light: "catppuccin-latte",
} as const;

/** Monaco wants bare hex without the leading hash. */
const bare = (hex: string) => hex.replace("#", "");

type MonacoLike = {
  editor: {
    defineTheme: (name: string, theme: unknown) => void;
  };
};

const buildTheme = (palette: CatppuccinPalette, dark: boolean) => ({
  base: dark ? "vs-dark" : "vs",
  // Inherit so any token this list does not name still resolves to something readable
  // rather than falling back to the default foreground.
  inherit: true,
  rules: [
    { token: "", foreground: bare(palette.text) },
    { token: "comment", foreground: bare(palette.overlay0), fontStyle: "italic" },
    { token: "string", foreground: bare(palette.green) },
    // JSON splits keys and values into their own token types; without these a key would
    // read the same green as its value.
    { token: "string.key.json", foreground: bare(palette.blue) },
    { token: "string.value.json", foreground: bare(palette.green) },
    { token: "number", foreground: bare(palette.peach) },
    { token: "keyword", foreground: bare(palette.mauve) },
    { token: "keyword.json", foreground: bare(palette.mauve) },
    { token: "delimiter", foreground: bare(palette.overlay2) },
    { token: "delimiter.bracket", foreground: bare(palette.overlay2) },
    // YAML keys arrive as `type`, XML as `tag` plus `attribute.name`.
    { token: "type", foreground: bare(palette.blue) },
    { token: "tag", foreground: bare(palette.blue) },
    { token: "attribute.name", foreground: bare(palette.yellow) },
    { token: "attribute.value", foreground: bare(palette.green) },
  ],
  colors: {
    "editor.background": palette.base,
    "editor.foreground": palette.text,
    "editorLineNumber.foreground": palette.overlay0,
    "editorLineNumber.activeForeground": palette.lavender,
    "editorCursor.foreground": palette.rosewater,
    "editor.selectionBackground": palette.surface2,
    "editor.inactiveSelectionBackground": palette.surface1,
    "editor.lineHighlightBackground": palette.surface0,
    "editorIndentGuide.background1": palette.surface0,
    "editorIndentGuide.activeBackground1": palette.surface2,
    "editorWhitespace.foreground": palette.surface1,
    "editorBracketMatch.background": palette.surface1,
    "editorBracketMatch.border": palette.overlay2,
    "editorError.foreground": palette.red,
    "editorWarning.foreground": palette.yellow,
    "editorGutter.background": palette.base,
    "editorWidget.background": palette.mantle,
    "editorWidget.border": palette.surface0,
    "editorSuggestWidget.background": palette.mantle,
    "editorSuggestWidget.selectedBackground": palette.surface0,
    "editorHoverWidget.background": palette.mantle,
    "editorHoverWidget.border": palette.surface0,
    "scrollbarSlider.background": palette.surface0,
    "scrollbarSlider.hoverBackground": palette.surface1,
    "scrollbarSlider.activeBackground": palette.surface2,
    "minimap.background": palette.base,
  },
});

/**
 * Register both flavours with Monaco.
 *
 * Safe to call more than once: defineTheme overwrites by name. Every Editor instance calls
 * it from `beforeMount` so no component has to depend on another having mounted first.
 */
export const defineCatppuccinThemes = (monaco: MonacoLike) => {
  monaco.editor.defineTheme(MONACO_THEME.dark, buildTheme(mocha, true));
  monaco.editor.defineTheme(MONACO_THEME.light, buildTheme(latte, false));
};
