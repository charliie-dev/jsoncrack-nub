import { ACCENT_POOL, type AccentName } from "../catppuccin";

/** Accent used for the root node, which has no key of its own. Fixed so the root reads the same in every document. */
export const ROOT_ACCENT: AccentName = ACCENT_POOL[0];

/**
 * FNV-1a, 32-bit. Chosen over a hand-rolled sum because it spreads short similar strings
 * ("name" vs "names") into different buckets, which is exactly the input this sees.
 */
const hash = (input: string): number => {
  let value = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }

  return value >>> 0;
};

/** Pick a stable accent for a node's key name. Same key always yields the same accent. */
export const accentForKey = (key: string): AccentName =>
  ACCENT_POOL[hash(key) % ACCENT_POOL.length];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);

/**
 * Blend two hex colours in sRGB, `fgRatio` of the foreground over the rest background.
 *
 * Done in JS rather than with CSS `color-mix()` so the result is unit-testable and does
 * not vary with browser support. Node headers live inside a foreignObject so CSS would
 * work there, but the same value is also needed by code that has no element to read from.
 */
export const mixHex = (fg: string, bg: string, fgRatio: number): string => {
  const ratio = clamp01(fgRatio);
  const foreground = fg.toLowerCase();
  const background = bg.toLowerCase();

  const mixed = [1, 3, 5].map(offset => {
    const value = channel(foreground, offset) * ratio + channel(background, offset) * (1 - ratio);
    return Math.round(value).toString(16).padStart(2, "0");
  });

  return `#${mixed.join("")}`;
};
