/**
 * Side-effect-free entry point for consumers that only need colours and geometry.
 *
 * Importing the package root pulls in the canvas component and therefore reaflow, which
 * Next.js then has to load while collecting page data on the server. Nothing reachable
 * from this module touches React, the DOM, or any renderer, so a host can safely read it
 * from `_app` or a constants file.
 */
export { ACCENT_POOL, latte, mocha } from "./catppuccin";
export type { AccentName, CatppuccinPalette } from "./catppuccin";
export { NODE_DIMENSIONS } from "./nodeDimensions";
export { accentForKey, mixHex, ROOT_ACCENT } from "./utils/accentForKey";
