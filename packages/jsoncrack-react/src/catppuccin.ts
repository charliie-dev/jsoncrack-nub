/**
 * Catppuccin colour values, copied verbatim from catppuccin/palette's palette.json.
 * Do not tweak these by hand: the whole point of adopting a published palette is that
 * every surface in the app resolves to the same set of values.
 */
export interface CatppuccinPalette {
  rosewater: string;
  flamingo: string;
  pink: string;
  mauve: string;
  red: string;
  maroon: string;
  peach: string;
  yellow: string;
  green: string;
  teal: string;
  sky: string;
  sapphire: string;
  blue: string;
  lavender: string;
  text: string;
  subtext1: string;
  subtext0: string;
  overlay2: string;
  overlay1: string;
  overlay0: string;
  surface2: string;
  surface1: string;
  surface0: string;
  base: string;
  mantle: string;
  crust: string;
}

export const mocha: CatppuccinPalette = {
  rosewater: "#f5e0dc",
  flamingo: "#f2cdcd",
  pink: "#f5c2e7",
  mauve: "#cba6f7",
  red: "#f38ba8",
  maroon: "#eba0ac",
  peach: "#fab387",
  yellow: "#f9e2af",
  green: "#a6e3a1",
  teal: "#94e2d5",
  sky: "#89dceb",
  sapphire: "#74c7ec",
  blue: "#89b4fa",
  lavender: "#b4befe",
  text: "#cdd6f4",
  subtext1: "#bac2de",
  subtext0: "#a6adc8",
  overlay2: "#9399b2",
  overlay1: "#7f849c",
  overlay0: "#6c7086",
  surface2: "#585b70",
  surface1: "#45475a",
  surface0: "#313244",
  base: "#1e1e2e",
  mantle: "#181825",
  crust: "#11111b",
};

export const latte: CatppuccinPalette = {
  rosewater: "#dc8a78",
  flamingo: "#dd7878",
  pink: "#ea76cb",
  mauve: "#8839ef",
  red: "#d20f39",
  maroon: "#e64553",
  peach: "#fe640b",
  yellow: "#df8e1d",
  green: "#40a02b",
  teal: "#179299",
  sky: "#04a5e5",
  sapphire: "#209fb5",
  blue: "#1e66f5",
  lavender: "#7287fd",
  text: "#4c4f69",
  subtext1: "#5c5f77",
  subtext0: "#6c6f85",
  overlay2: "#7c7f93",
  overlay1: "#8c8fa1",
  overlay0: "#9ca0b0",
  surface2: "#acb0be",
  surface1: "#bcc0cc",
  surface0: "#ccd0da",
  base: "#eff1f5",
  mantle: "#e6e9ef",
  crust: "#dce0e8",
};

export type AccentName = keyof CatppuccinPalette;

/**
 * Accents used to colour node headers, in a fixed order.
 *
 * Single array shared by both flavours on purpose. If each flavour had its own pool and
 * the lengths differed, `hash(key) % pool.length` would resolve differently in light and
 * dark, so every node would change colour when the user toggles the theme.
 *
 * Five of the fourteen accents are left out because they are hard to tell apart from a
 * neighbour at header size: rosewater and flamingo read as pink, maroon reads as red,
 * sapphire reads as sky, and yellow is the weakest accent against Latte's light base.
 */
export const ACCENT_POOL = [
  "mauve",
  "red",
  "peach",
  "green",
  "teal",
  "sky",
  "blue",
  "lavender",
  "pink",
] as const satisfies readonly AccentName[];
