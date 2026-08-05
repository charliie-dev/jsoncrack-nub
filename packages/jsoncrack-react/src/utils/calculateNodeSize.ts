import { NODE_DIMENSIONS } from "../nodeDimensions";

type Text = number | string | [string, string][];
type Size = { width: number; height: number };

const CACHE_TTL_MS = 120_000;
const sizeCache = new Map<string, Size>();
let lastCacheClearAt = Date.now();

const calculateLines = (text: Text): string => {
  if (Array.isArray(text)) {
    return text.map(([k, v]) => `${k}: ${JSON.stringify(v).slice(0, 80)}`).join("\n");
  }

  return `${text}`;
};

const fallbackSize = (str: string, single: boolean): Size => {
  const lines = str.split("\n");
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);

  return {
    width: Math.min(700, Math.max(45, longestLine * 8 + 24)),
    height:
      (single ? NODE_DIMENSIONS.PARENT_HEIGHT : lines.length * NODE_DIMENSIONS.ROW_HEIGHT) +
      NODE_DIMENSIONS.HEADER_HEIGHT,
  };
};

const calculateWidthAndHeight = (str: string, single = false): Size => {
  if (!str) return { width: 45, height: 45 };

  if (typeof document === "undefined") {
    return fallbackSize(str, single);
  }

  const dummyElement = document.createElement("div");
  dummyElement.style.position = "absolute";
  dummyElement.style.visibility = "hidden";
  dummyElement.style.pointerEvents = "none";
  dummyElement.style.whiteSpace = single ? "nowrap" : "pre-wrap";
  dummyElement.innerText = str;
  dummyElement.style.fontSize = "12px";
  dummyElement.style.width = "fit-content";
  dummyElement.style.padding = "0 10px";
  dummyElement.style.fontWeight = "500";
  dummyElement.style.fontFamily = "monospace";
  document.body.appendChild(dummyElement);

  const clientRect = dummyElement.getBoundingClientRect();
  const lines = str.split("\n").length;

  const width = clientRect.width + 4;
  const height =
    (single ? NODE_DIMENSIONS.PARENT_HEIGHT : lines * NODE_DIMENSIONS.ROW_HEIGHT) +
    NODE_DIMENSIONS.HEADER_HEIGHT;

  document.body.removeChild(dummyElement);
  return { width, height };
};

const maybeClearCache = () => {
  if (Date.now() - lastCacheClearAt < CACHE_TTL_MS) return;
  sizeCache.clear();
  lastCacheClearAt = Date.now();
};

/** Fallbacks used when measurement produces something ELK cannot lay out. */
const SAFE_SIZE = {
  width: 120,
  height: NODE_DIMENSIONS.PARENT_HEIGHT + NODE_DIMENSIONS.HEADER_HEIGHT,
};

/**
 * Guarantee a finite size.
 *
 * A NaN or Infinity here does not fail where it is produced: it travels into ELK, which
 * rejects the whole layout with "Severe implementation error in the Json to ElkGraph
 * importer" and no indication of which node caused it. The canvas then sits on its
 * spinner forever. Substituting a usable number keeps the graph rendering, and the warning
 * names the input so the real cause is findable.
 */
const clampToFinite = (size: Size, text: Text, headerLabel?: string) => {
  if (Number.isFinite(size.width) && Number.isFinite(size.height)) return;

  console.warn("jsoncrack: node measured to a non-finite size, falling back", {
    width: size.width,
    height: size.height,
    headerLabel,
    text: JSON.stringify(text).slice(0, 120),
  });

  if (!Number.isFinite(size.width)) size.width = SAFE_SIZE.width;
  if (!Number.isFinite(size.height)) size.height = SAFE_SIZE.height;
};

/**
 * Measure a node.
 *
 * `headerLabel` widens the result when the coloured header is longer than anything in the
 * body. Without it a node like `workspaces[0]` whose only row is `apps/*` comes out sized
 * for the row, and the header is clipped. Height is unaffected: the header's own height is
 * already added inside calculateWidthAndHeight.
 */
export const calculateNodeSize = (text: Text, isParent = false, headerLabel?: string) => {
  maybeClearCache();

  const cacheKey = `${JSON.stringify(text)}-${isParent}-${headerLabel ?? ""}`;

  const cached = sizeCache.get(cacheKey);
  if (cached) return cached;

  const lines = calculateLines(text);
  const sizes = calculateWidthAndHeight(lines, typeof text === "string");

  if (isParent) sizes.width += 80;

  if (headerLabel) {
    // Measured as a single line, and bold, so it is never narrower than the real header.
    const header = calculateWidthAndHeight(headerLabel, true);
    sizes.width = Math.max(sizes.width, header.width);
  }

  if (sizes.width > 700) sizes.width = 700;

  clampToFinite(sizes, text, headerLabel);

  sizeCache.set(cacheKey, sizes);
  return sizes;
};
