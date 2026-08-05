# Catppuccin Canvas Implementation Plan（Plan A，五塊中的 1 / 2 / 5）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 canvas 的顏色收斂成 Catppuccin 單一來源，節點加上依 key 上色的 header 條，並調整 ELK layout 讓邊從對應的那一列出發。

**Architecture:** 顏色的單一來源放在 `packages/jsoncrack-react/src/catppuccin.ts`，`theme.ts` 從它組出 dark 與 light 兩組 token，`canvasHelpers.ts` 的 `buildCanvasStyle` 把 token 全部投影成 CSS custom properties。節點以 `<foreignObject>` 渲染 HTML，所以 header 是 HTML 元素而非 SVG。節點尺寸常數目前有三份副本，收斂成 package 的單一 export，因為 header 高度必須同時被尺寸計算與 port y 偏移引用。

**Tech Stack:** TypeScript、React 19、reaflow 5.4.1（內含 elkjs）、vitest、nub 0.6.0

## Global Constraints

- 色值必須逐字等於 `catppuccin/palette` 的 `palette.json`，不得自行調整明度或飽和度
- `ACCENT_POOL` 是單一組色名陣列，兩個 flavor 共用。名稱相同、值不同，所以 `hash % length` 在亮暗切換時結果不變
- 節點尺寸常數（`ROW_HEIGHT`、`PARENT_HEIGHT`、`HEADER_HEIGHT`）單一來源，完成後 repo 內不得再有本地副本
- 混色在 JS 端算成 hex，不用 CSS `color-mix()`。理由是可單元測試且不依賴瀏覽器對 `color-mix` 的支援差異
- 每個新增的純函式都要有 vitest 測試
- 不建立 `apps/www` 的測試框架，那裡的驗收是手動的
- 版本鎖不動：reaflow 5.4.1、monaco-editor 0.56.0
- 每個 task 的最後一步 commit 之前，`nub run --filter jsoncrack-react lint` 必須通過
- 測試指令一律跑整個 package：`nub run --filter jsoncrack-react test`。這個 package 的測試很快，不需要 filter 到單一檔案，也避免 nub 的 `--` 參數傳遞問題

---

### Task 1: Catppuccin 色票模組

**Files:**
- Create: `packages/jsoncrack-react/src/catppuccin.ts`
- Test: `packages/jsoncrack-react/src/__tests__/catppuccin.test.ts`

**Interfaces:**
- Consumes: 無
- Produces: `mocha`、`latte`（皆為 `CatppuccinPalette`）、`ACCENT_POOL: readonly AccentName[]`、型別 `CatppuccinPalette`、`AccentName`

- [ ] **Step 1: Write the failing test**

`packages/jsoncrack-react/src/__tests__/catppuccin.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { ACCENT_POOL, latte, mocha } from "../catppuccin";

describe("catppuccin palettes", () => {
  it("exposes the same 26 colour names in both flavours", () => {
    const mochaKeys = Object.keys(mocha).sort();
    const latteKeys = Object.keys(latte).sort();

    expect(mochaKeys).toEqual(latteKeys);
    expect(mochaKeys).toHaveLength(26);
  });

  it("uses the exact upstream hex values", () => {
    expect(mocha.base).toBe("#1e1e2e");
    expect(mocha.mauve).toBe("#cba6f7");
    expect(mocha.crust).toBe("#11111b");
    expect(latte.base).toBe("#eff1f5");
    expect(latte.mauve).toBe("#8839ef");
    expect(latte.crust).toBe("#dce0e8");
  });

  it("stores every colour as a lowercase 6-digit hex", () => {
    for (const value of [...Object.values(mocha), ...Object.values(latte)]) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the accent pool resolvable in both flavours", () => {
    expect(ACCENT_POOL.length).toBeGreaterThan(0);

    for (const name of ACCENT_POOL) {
      expect(mocha[name]).toMatch(/^#[0-9a-f]{6}$/);
      expect(latte[name]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("excludes accents that are hard to tell apart from their neighbours", () => {
    expect(ACCENT_POOL).not.toContain("rosewater");
    expect(ACCENT_POOL).not.toContain("flamingo");
    expect(ACCENT_POOL).not.toContain("maroon");
    expect(ACCENT_POOL).not.toContain("sapphire");
    expect(ACCENT_POOL).not.toContain("yellow");
  });

  it("has no duplicate entries in the accent pool", () => {
    expect(new Set(ACCENT_POOL).size).toBe(ACCENT_POOL.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nub run --filter jsoncrack-react test`
Expected: FAIL，錯誤訊息是無法解析 `../catppuccin`

- [ ] **Step 3: Write minimal implementation**

`packages/jsoncrack-react/src/catppuccin.ts`

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nub run --filter jsoncrack-react test`
Expected: PASS，6 個 catppuccin 測試全過

- [ ] **Step 5: Commit**

```bash
nub run --filter jsoncrack-react lint
git add packages/jsoncrack-react/src/catppuccin.ts packages/jsoncrack-react/src/__tests__/catppuccin.test.ts
git commit -m "feat(canvas): add catppuccin palette module"
```

---

### Task 2: 混色與 accent 選擇

**Files:**
- Create: `packages/jsoncrack-react/src/utils/accentForKey.ts`
- Test: `packages/jsoncrack-react/src/__tests__/accentForKey.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `ACCENT_POOL`、`AccentName`、`CatppuccinPalette`
- Produces: `accentForKey(key: string): AccentName`、`mixHex(fg: string, bg: string, fgRatio: number): string`、`ROOT_ACCENT: AccentName`

- [ ] **Step 1: Write the failing test**

`packages/jsoncrack-react/src/__tests__/accentForKey.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { ACCENT_POOL } from "../catppuccin";
import { ROOT_ACCENT, accentForKey, mixHex } from "../utils/accentForKey";

describe("accentForKey", () => {
  it("returns the same accent for the same key every time", () => {
    expect(accentForKey("scripts")).toBe(accentForKey("scripts"));
    expect(accentForKey("devEngines")).toBe(accentForKey("devEngines"));
  });

  it("always returns a name that is in the pool", () => {
    const keys = ["a", "author", "bugs", "scripts", "workspaces", "packageManager", "", "x".repeat(200)];

    for (const key of keys) {
      expect(ACCENT_POOL).toContain(accentForKey(key));
    }
  });

  it("spreads a realistic set of keys across most of the pool", () => {
    const keys = [
      "name", "private", "license", "homepage", "author", "bugs", "scripts",
      "workspaces", "packageManager", "devEngines", "overrides", "runtime",
      "dependencies", "devDependencies", "exports", "files", "keywords",
    ];
    const used = new Set(keys.map(accentForKey));

    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it("is case sensitive, so differently cased keys may differ", () => {
    expect(typeof accentForKey("Scripts")).toBe("string");
  });

  it("exposes a fixed accent for the root node", () => {
    expect(ACCENT_POOL).toContain(ROOT_ACCENT);
  });
});

describe("mixHex", () => {
  it("returns the background when the foreground ratio is 0", () => {
    expect(mixHex("#ffffff", "#1e1e2e", 0)).toBe("#1e1e2e");
  });

  it("returns the foreground when the foreground ratio is 1", () => {
    expect(mixHex("#ffffff", "#1e1e2e", 1)).toBe("#ffffff");
  });

  it("mixes channel by channel at the midpoint", () => {
    expect(mixHex("#ffffff", "#000000", 0.5)).toBe("#808080");
  });

  it("produces a lowercase 6-digit hex", () => {
    expect(mixHex("#cba6f7", "#1e1e2e", 0.15)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("clamps ratios outside 0 to 1", () => {
    expect(mixHex("#ffffff", "#000000", -1)).toBe("#000000");
    expect(mixHex("#ffffff", "#000000", 2)).toBe("#ffffff");
  });

  it("accepts hex input without regard to case", () => {
    expect(mixHex("#FFFFFF", "#000000", 1)).toBe("#ffffff");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nub run --filter jsoncrack-react test`
Expected: FAIL，無法解析 `../utils/accentForKey`

- [ ] **Step 3: Write minimal implementation**

`packages/jsoncrack-react/src/utils/accentForKey.ts`

```ts
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
export const accentForKey = (key: string): AccentName => ACCENT_POOL[hash(key) % ACCENT_POOL.length];

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nub run --filter jsoncrack-react test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
nub run --filter jsoncrack-react lint
git add packages/jsoncrack-react/src/utils/accentForKey.ts packages/jsoncrack-react/src/__tests__/accentForKey.test.ts
git commit -m "feat(canvas): add stable accent picker and hex mixer"
```

---

### Task 3: 節點尺寸常數收斂並加入 header 高度

三份 `ROW_HEIGHT` 副本目前散在 `packages/jsoncrack-react/src/utils/calculateNodeSize.ts:2`、`packages/jsoncrack-react/src/components/ObjectNode.tsx:23`、`apps/www/src/constants/graph.ts`。Task 8 的 port y 偏移必須引用同一個 `HEADER_HEIGHT`，所以先收斂再加高度。

**Files:**
- Create: `packages/jsoncrack-react/src/nodeDimensions.ts`
- Modify: `packages/jsoncrack-react/src/utils/calculateNodeSize.ts:1-4`（刪除私有常數）、`:27`、`:55`
- Modify: `packages/jsoncrack-react/src/components/ObjectNode.tsx:23`、`:26`
- Modify: `packages/jsoncrack-react/src/index.ts`（匯出新模組）
- Modify: `apps/www/src/constants/graph.ts`（改為 re-export）
- Test: `packages/jsoncrack-react/src/__tests__/calculateNodeSize.test.ts`

**Interfaces:**
- Consumes: 無
- Produces: `NODE_DIMENSIONS: { ROW_HEIGHT: 30; PARENT_HEIGHT: 36; HEADER_HEIGHT: 36 }`

- [ ] **Step 1: Write the failing test**

`packages/jsoncrack-react/src/__tests__/calculateNodeSize.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { NODE_DIMENSIONS } from "../nodeDimensions";
import { calculateNodeSize } from "../utils/calculateNodeSize";

describe("NODE_DIMENSIONS", () => {
  it("keeps the existing row and parent heights", () => {
    expect(NODE_DIMENSIONS.ROW_HEIGHT).toBe(30);
    expect(NODE_DIMENSIONS.PARENT_HEIGHT).toBe(36);
  });

  it("declares a header height", () => {
    expect(NODE_DIMENSIONS.HEADER_HEIGHT).toBe(36);
  });
});

describe("calculateNodeSize", () => {
  it("adds the header height to a multi-row object node", () => {
    const rows: [string, string][] = [
      ["name", "jsoncrack-monorepo"],
      ["private", "true"],
      ["license", "Apache-2.0"],
    ];

    const { height } = calculateNodeSize(rows);

    expect(height).toBe(3 * NODE_DIMENSIONS.ROW_HEIGHT + NODE_DIMENSIONS.HEADER_HEIGHT);
  });

  it("adds the header height to a single-value text node", () => {
    const { height } = calculateNodeSize("apps/*");

    expect(height).toBe(NODE_DIMENSIONS.PARENT_HEIGHT + NODE_DIMENSIONS.HEADER_HEIGHT);
  });

  it("still returns the empty-text fallback without a header", () => {
    expect(calculateNodeSize("")).toEqual({ width: 45, height: 45 });
  });

  it("caches by text and parent flag, so a repeated call is identical", () => {
    const first = calculateNodeSize("cached-value");
    const second = calculateNodeSize("cached-value");

    expect(second).toEqual(first);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nub run --filter jsoncrack-react test`
Expected: FAIL，無法解析 `../nodeDimensions`

- [ ] **Step 3: Write minimal implementation**

`packages/jsoncrack-react/src/nodeDimensions.ts`

```ts
/**
 * Single source for node geometry.
 *
 * These numbers used to exist in three places: this package's calculateNodeSize, its
 * ObjectNode, and apps/www's constants/graph. Task 8 anchors edge ports to individual
 * rows, and that y offset has to agree with the height the layout was given, so a second
 * copy is no longer merely untidy.
 */
export const NODE_DIMENSIONS = {
  /** Height of one key/value row inside a node. */
  ROW_HEIGHT: 30,
  /** Height of a node whose body is a single scalar value. */
  PARENT_HEIGHT: 36,
  /** Height of the coloured header strip above every node's body. */
  HEADER_HEIGHT: 36,
} as const;
```

`packages/jsoncrack-react/src/utils/calculateNodeSize.ts`，刪掉第 1 到 4 行的私有常數，改為 import，並在兩處高度計算加上 header：

```ts
import { NODE_DIMENSIONS } from "../nodeDimensions";

type Text = number | string | [string, string][];
type Size = { width: number; height: number };
```

`fallbackSize` 的 height 改成：

```ts
    height:
      (single ? NODE_DIMENSIONS.PARENT_HEIGHT : lines.length * NODE_DIMENSIONS.ROW_HEIGHT) +
      NODE_DIMENSIONS.HEADER_HEIGHT,
```

`calculateWidthAndHeight` 的 height 改成：

```ts
  const height =
    (single ? NODE_DIMENSIONS.PARENT_HEIGHT : lines * NODE_DIMENSIONS.ROW_HEIGHT) +
    NODE_DIMENSIONS.HEADER_HEIGHT;
```

第 32 行的空字串提前返回保持原樣，不加 header：

```ts
  if (!str) return { width: 45, height: 45 };
```

`packages/jsoncrack-react/src/components/ObjectNode.tsx`，刪掉第 23 行的 `const ROW_HEIGHT = 30;`，改為 import，並讓 row 位置從 header 之下算起：

```ts
import { NODE_DIMENSIONS } from "../nodeDimensions";
```

```ts
  const rowPosition = NODE_DIMENSIONS.HEADER_HEIGHT + index * NODE_DIMENSIONS.ROW_HEIGHT;
```

`packages/jsoncrack-react/src/index.ts` 加一行匯出：

```ts
export { NODE_DIMENSIONS } from "./nodeDimensions";
```

`apps/www/src/constants/graph.ts` 改為 re-export，只留 `SUPPORTED_LIMIT`：

```ts
export { NODE_DIMENSIONS } from "jsoncrack-react";

export const SUPPORTED_LIMIT = +(process.env.NEXT_PUBLIC_NODE_LIMIT as string);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nub run --filter jsoncrack-react test`
Expected: PASS。既有的 `parser.test.ts` 若斷言了節點高度數值也會一起變動，把那些期望值加上 `NODE_DIMENSIONS.HEADER_HEIGHT`，不要改回舊值

- [ ] **Step 5: Commit**

```bash
nub run -r lint
git add packages/jsoncrack-react/src apps/www/src/constants/graph.ts
git commit -m "refactor(canvas): collapse node dimension copies and reserve header height"
```

---

### Task 4: theme.ts 與 buildCanvasStyle 改用 Catppuccin

`buildCanvasStyle` 目前有一批繞過 theme token 的硬編碼 `isDark` 三元色（`canvasHelpers.ts:44-46` 的 `--edge-stroke`、`--node-fill`、`--node-stroke`，以及 `:60-62` 的 spinner 與 overlay）。這些一併收進 token，否則換色盤後 canvas 會有一半不是 Catppuccin。

**Files:**
- Modify: `packages/jsoncrack-react/src/theme.ts`（整份重寫）
- Modify: `packages/jsoncrack-react/src/canvasHelpers.ts:33-63`
- Test: `packages/jsoncrack-react/src/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `mocha`、`latte`、`CatppuccinPalette`；Task 2 的 `mixHex`
- Produces: `JSONCrackTheme` 新增欄位 `NODE_COLORS.HEADER_TEXT`、`EDGE_STROKE`、`NODE_FILL`、`NODE_STROKE`、`SPINNER_TRACK`、`SPINNER_HEAD`、`OVERLAY_BG`、`BASE`；`themes` 的 key 不變，仍是 `dark` 與 `light`

- [ ] **Step 1: Write the failing test**

`packages/jsoncrack-react/src/__tests__/theme.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildCanvasStyle } from "../canvasHelpers";
import { latte, mocha } from "../catppuccin";
import { themes } from "../theme";

describe("themes", () => {
  it("builds the dark flavour from mocha", () => {
    expect(themes.dark.BASE).toBe(mocha.base);
    expect(themes.dark.NODE_COLORS.NODE_KEY).toBe(mocha.blue);
    expect(themes.dark.GRID_BG_COLOR).toBe(mocha.crust);
  });

  it("builds the light flavour from latte", () => {
    expect(themes.light.BASE).toBe(latte.base);
    expect(themes.light.NODE_COLORS.NODE_KEY).toBe(latte.blue);
    expect(themes.light.GRID_BG_COLOR).toBe(latte.crust);
  });

  it("defines every token in both flavours", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("no longer leaves canvas colours outside the palette", () => {
    const palettes = { dark: mocha, light: latte } as const;

    for (const flavour of ["dark", "light"] as const) {
      const values = Object.values(palettes[flavour]);
      const theme = themes[flavour];

      expect(values).toContain(theme.EDGE_STROKE);
      expect(values).toContain(theme.NODE_FILL);
      expect(values).toContain(theme.NODE_STROKE);
    }
  });
});

describe("buildCanvasStyle", () => {
  it("projects the dark tokens onto css variables", () => {
    const style = buildCanvasStyle("dark") as Record<string, string>;

    expect(style["--bg-color"]).toBe(mocha.crust);
    expect(style["--edge-stroke"]).toBe(themes.dark.EDGE_STROKE);
    expect(style["--node-fill"]).toBe(themes.dark.NODE_FILL);
    expect(style["--node-header-text"]).toBe(themes.dark.NODE_COLORS.HEADER_TEXT);
  });

  it("still lets a caller style override a token", () => {
    const style = buildCanvasStyle("dark", { "--bg-color": "#123456" } as never) as Record<string, string>;

    expect(style["--bg-color"]).toBe("#123456");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nub run --filter jsoncrack-react test`
Expected: FAIL，`themes.dark.BASE` 是 undefined

- [ ] **Step 3: Write minimal implementation**

`packages/jsoncrack-react/src/theme.ts`，整份改成從色票組出：

```ts
import type { CatppuccinPalette } from "./catppuccin";
import { latte, mocha } from "./catppuccin";
import type { CanvasThemeMode } from "./types";

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
  GRID_COLOR_PRIMARY: palette.mantle,
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
```

`packages/jsoncrack-react/src/canvasHelpers.ts`，把 `buildCanvasStyle` 的硬編碼三元改成讀 token，並加上 header 用的兩個變數。`isDark` 不再需要：

```ts
export const buildCanvasStyle = (
  theme: CanvasThemeMode,
  userStyle?: CSSProperties
): CSSProperties => {
  const themeTokens = themes[theme];

  return {
    "--bg-color": themeTokens.GRID_BG_COLOR,
    "--line-color-1": themeTokens.GRID_COLOR_PRIMARY,
    "--line-color-2": themeTokens.GRID_COLOR_SECONDARY,
    "--edge-stroke": themeTokens.EDGE_STROKE,
    "--node-fill": themeTokens.NODE_FILL,
    "--node-stroke": themeTokens.NODE_STROKE,
    "--interactive-normal": themeTokens.INTERACTIVE_NORMAL,
    "--background-node": themeTokens.BACKGROUND_NODE,
    "--node-text": themeTokens.NODE_COLORS.TEXT,
    "--node-key": themeTokens.NODE_COLORS.NODE_KEY,
    "--node-value": themeTokens.NODE_COLORS.NODE_VALUE,
    "--node-integer": themeTokens.NODE_COLORS.INTEGER,
    "--node-null": themeTokens.NODE_COLORS.NULL,
    "--node-bool-true": themeTokens.NODE_COLORS.BOOL.TRUE,
    "--node-bool-false": themeTokens.NODE_COLORS.BOOL.FALSE,
    "--node-child-count": themeTokens.NODE_COLORS.CHILD_COUNT,
    "--node-divider": themeTokens.NODE_COLORS.DIVIDER,
    "--node-header-text": themeTokens.NODE_COLORS.HEADER_TEXT,
    "--node-base": themeTokens.BASE,
    "--text-positive": themeTokens.TEXT_POSITIVE,
    "--background-modifier-accent": themeTokens.BACKGROUND_MODIFIER_ACCENT,
    "--spinner-track": themeTokens.SPINNER_TRACK,
    "--spinner-head": themeTokens.SPINNER_HEAD,
    "--overlay-bg": themeTokens.OVERLAY_BG,
    ...userStyle,
  } as CSSProperties;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nub run --filter jsoncrack-react test`
Expected: PASS。既有的 `canvasHelpers.test.ts` 若斷言了舊的硬編碼色字串，改成斷言對應的 token，不要把 token 改回字面色

- [ ] **Step 5: Commit**

```bash
nub run --filter jsoncrack-react lint
git add packages/jsoncrack-react/src
git commit -m "feat(canvas): derive canvas theme from catppuccin flavours"
```

---

### Task 5: 節點 header 文字

root 節點沒有自己的 key（`parser.ts:144` 走 `!node.parent` 分支，`getNodePath` 是空陣列，pop 出 undefined），而 array 元素的 `parentKey` 是容器名稱而非帶索引的名稱：`workspaces[0]` 的 `parentKey` 是 `"workspaces"`。header 文字因此要從 `NodeData.path` 算，不能直接用 `parentKey`。

**Files:**
- Create: `packages/jsoncrack-react/src/utils/nodeHeaderLabel.ts`
- Test: `packages/jsoncrack-react/src/__tests__/nodeHeaderLabel.test.ts`

**Interfaces:**
- Consumes: `JSONPath` from `jsonc-parser`
- Produces: `nodeHeaderLabel(path: JSONPath | undefined, rootLabel: string): string`、`DEFAULT_ROOT_LABEL = "Untitled"`

- [ ] **Step 1: Write the failing test**

`packages/jsoncrack-react/src/__tests__/nodeHeaderLabel.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOT_LABEL, nodeHeaderLabel } from "../utils/nodeHeaderLabel";

describe("nodeHeaderLabel", () => {
  it("uses the root label for the root node's empty path", () => {
    expect(nodeHeaderLabel([], "package.json")).toBe("package.json");
  });

  it("uses the root label when the path is missing", () => {
    expect(nodeHeaderLabel(undefined, "package.json")).toBe("package.json");
  });

  it("falls back to Untitled when no root label is given", () => {
    expect(nodeHeaderLabel([], "")).toBe(DEFAULT_ROOT_LABEL);
    expect(DEFAULT_ROOT_LABEL).toBe("Untitled");
  });

  it("uses the last segment for an object property", () => {
    expect(nodeHeaderLabel(["author"], "package.json")).toBe("author");
    expect(nodeHeaderLabel(["devEngines", "runtime"], "package.json")).toBe("runtime");
  });

  it("renders an array element as container plus index", () => {
    expect(nodeHeaderLabel(["workspaces", 0], "package.json")).toBe("workspaces[0]");
    expect(nodeHeaderLabel(["workspaces", 1], "package.json")).toBe("workspaces[1]");
  });

  it("renders a nested array element against its own container", () => {
    expect(nodeHeaderLabel(["a", "b", 2], "package.json")).toBe("b[2]");
  });

  it("renders an index at the root of an array document", () => {
    expect(nodeHeaderLabel([3], "data.json")).toBe("[3]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nub run --filter jsoncrack-react test`
Expected: FAIL，無法解析 `../utils/nodeHeaderLabel`

- [ ] **Step 3: Write minimal implementation**

`packages/jsoncrack-react/src/utils/nodeHeaderLabel.ts`

```ts
import type { JSONPath } from "jsonc-parser";

/** Header text for a document whose own name is unknown. Matches what the editor shows in its tab. */
export const DEFAULT_ROOT_LABEL = "Untitled";

/**
 * Header text for a node, derived from its JSON path.
 *
 * NodeData.parentKey is not usable here: for an array element it holds the container's
 * name, so both workspaces[0] and workspaces[1] would read "workspaces". The path keeps
 * the index, so it is the only input that can tell them apart.
 */
export const nodeHeaderLabel = (path: JSONPath | undefined, rootLabel: string): string => {
  if (!path || path.length === 0) return rootLabel || DEFAULT_ROOT_LABEL;

  const last = path[path.length - 1];

  if (typeof last === "number") {
    const container = path.length > 1 ? path[path.length - 2] : "";
    return `${container}[${last}]`;
  }

  return String(last);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nub run --filter jsoncrack-react test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
nub run --filter jsoncrack-react lint
git add packages/jsoncrack-react/src/utils/nodeHeaderLabel.ts packages/jsoncrack-react/src/__tests__/nodeHeaderLabel.test.ts
git commit -m "feat(canvas): derive node header labels from json paths"
```

---

### Task 6: 渲染節點 header

節點以 `<foreignObject>` 渲染 HTML，所以 header 是一個 `div`，用 Task 4 加的 `--node-header-text` 與 `--node-base` 兩個 CSS 變數，背景由 Task 2 的 `mixHex` 在 JS 端算出。

**Files:**
- Modify: `packages/jsoncrack-react/src/components/ObjectNode.tsx`
- Modify: `packages/jsoncrack-react/src/components/TextNode.tsx`
- Modify: `packages/jsoncrack-react/src/components/Node.module.css`
- Modify: `packages/jsoncrack-react/src/JSONCrackComponent.tsx`（新增 `rootLabel` prop 並傳給 node 渲染）
- Create: `packages/jsoncrack-react/src/components/NodeHeader.tsx`

**Interfaces:**
- Consumes: Task 1 的 `mocha`、`latte`；Task 2 的 `accentForKey`、`mixHex`、`ROOT_ACCENT`；Task 3 的 `NODE_DIMENSIONS`；Task 5 的 `nodeHeaderLabel`
- Produces: `NodeHeader` 元件，props 為 `{ label: string; accentKey: string | null; theme: CanvasThemeMode; width: number }`；`JSONCrackProps` 新增選用 `rootLabel?: string`

- [ ] **Step 1: Write the failing test**

`packages/jsoncrack-react/src/__tests__/nodeHeader.test.ts`

這個 task 的可測部分是顏色決策，不是 DOM。把顏色決策抽成純函式一起測。

```ts
import { describe, expect, it } from "vitest";
import { mocha } from "../catppuccin";
import { ROOT_ACCENT, accentForKey } from "../utils/accentForKey";
import { headerColors } from "../components/NodeHeader";

describe("headerColors", () => {
  it("uses the hashed accent for a keyed node", () => {
    const colors = headerColors("scripts", "dark");

    expect(colors.text).toBe(mocha[accentForKey("scripts")]);
  });

  it("uses the fixed root accent when there is no key", () => {
    const colors = headerColors(null, "dark");

    expect(colors.text).toBe(mocha[ROOT_ACCENT]);
  });

  it("mixes the background towards the flavour base", () => {
    const colors = headerColors("scripts", "dark");

    expect(colors.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(colors.background).not.toBe(colors.text);
    expect(colors.background).not.toBe(mocha.base);
  });

  it("returns the same colours for the same input", () => {
    expect(headerColors("author", "dark")).toEqual(headerColors("author", "dark"));
  });

  it("returns different values per flavour", () => {
    expect(headerColors("author", "dark").text).not.toBe(headerColors("author", "light").text);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nub run --filter jsoncrack-react test`
Expected: FAIL，無法解析 `../components/NodeHeader`

- [ ] **Step 3: Write minimal implementation**

`packages/jsoncrack-react/src/components/NodeHeader.tsx`

```tsx
import React from "react";
import { latte, mocha } from "../catppuccin";
import { NODE_DIMENSIONS } from "../nodeDimensions";
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
        height: NODE_DIMENSIONS.HEADER_HEIGHT,
        color: text,
        background,
      }}
      data-header-label={label}
    >
      {label}
    </div>
  );
};
```

`packages/jsoncrack-react/src/components/Node.module.css` 加上：

```css
.header {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding: 0 10px;
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px solid var(--node-divider);
}
```

`ObjectNode.tsx` 的 `ObjectNodeBase` 在 rows 之前渲染 header。`theme` 與 `rootLabel` 由 `JSONCrackComponent` 的 render factory 往下傳，加進 `ObjectNodeProps`：

```tsx
type ObjectNodeProps = {
  node: NodeData;
  x: number;
  y: number;
  theme: CanvasThemeMode;
  rootLabel: string;
};
```

```tsx
const ObjectNodeBase = ({ node, x, y, theme, rootLabel }: ObjectNodeProps) => {
  const parentPath = node.path ?? [];
  const label = nodeHeaderLabel(node.path, rootLabel);
  const isRoot = !node.path || node.path.length === 0;

  return (
    <foreignObject
      className={`${styles.foreignObject} ${styles.objectForeignObject}`}
      data-id={`node-${node.id}`}
      width={node.width}
      height={node.height}
      x={0}
      y={0}
    >
      <NodeHeader
        label={label}
        accentKey={isRoot ? null : label}
        theme={theme}
        width={node.width}
      />
      {node.text.map((row, index) => (
        <Row key={`${node.id}-${index}`} row={row} x={x} y={y} index={index} parentPath={parentPath} />
      ))}
    </foreignObject>
  );
};
```

`propsAreEqual` 要把新的兩個 prop 納入比較，否則切換 flavour 時 header 不會重繪：

```tsx
const propsAreEqual = (prev: ObjectNodeProps, next: ObjectNodeProps) => {
  return (
    prev.theme === next.theme &&
    prev.rootLabel === next.rootLabel &&
    prev.node.width === next.node.width &&
    prev.node.height === next.node.height &&
    arePathsEqual(prev.node.path, next.node.path) &&
    areRowsEqual(prev.node.text, next.node.text)
  );
};
```

`TextNode.tsx` 整個元件改成：

```tsx
import React from "react";
import type { CanvasThemeMode, NodeData } from "../types";
import { nodeHeaderLabel } from "../utils/nodeHeaderLabel";
import { NodeHeader } from "./NodeHeader";
import styles from "./Node.module.css";
import { TextRenderer } from "./TextRenderer";
import { getTextColor } from "./nodeStyles";

type TextNodeProps = {
  node: NodeData;
  x: number;
  y: number;
  theme: CanvasThemeMode;
  rootLabel: string;
};

const TextNodeBase = ({ node, x, y, theme, rootLabel }: TextNodeProps) => {
  const { text, width, height } = node;
  const firstRow = text[0];

  if (!firstRow) return null;

  const value = firstRow.value;
  const label = nodeHeaderLabel(node.path, rootLabel);
  const isRoot = !node.path || node.path.length === 0;

  return (
    <foreignObject
      className={styles.foreignObject}
      data-id={`node-${node.id}`}
      width={width}
      height={height}
      x={0}
      y={0}
    >
      <NodeHeader label={label} accentKey={isRoot ? null : label} theme={theme} width={width} />
      <span
        className={styles.textNodeWrapper}
        data-x={x}
        data-y={y}
        data-key={JSON.stringify(text)}
      >
        <span className={styles.key} style={{ color: getTextColor({ value, type: typeof value }) }}>
          <TextRenderer>{value}</TextRenderer>
        </span>
      </span>
    </foreignObject>
  );
};

const propsAreEqual = (prev: TextNodeProps, next: TextNodeProps) => {
  return (
    prev.theme === next.theme &&
    prev.rootLabel === next.rootLabel &&
    prev.node.text === next.node.text &&
    prev.node.width === next.node.width
  );
};

export const TextNode = React.memo(TextNodeBase, propsAreEqual);
```

**接著必須檢查 `Node.module.css` 的 `.textNodeWrapper` 與 `.foreignObject`。** 這兩個 class 原本假設整個 foreignObject 只有一個內容區塊，若其中任一個用了 `height: 100%` 或垂直居中，加入 header 後值會變成節點總高而把 header 推出可視範圍。判斷標準：header 完整可見且文字垂直居中，body 從 header 下緣開始。需要時把 wrapper 的高度改成 `calc(100% - 36px)`，36 取自 `NODE_DIMENSIONS.HEADER_HEIGHT`，或改用 flex column 讓 header 與 body 自然堆疊。

`JSONCrackComponent.tsx` 新增 prop 並串到 render factory。import 要加上 `DEFAULT_ROOT_LABEL`：

```ts
import { DEFAULT_ROOT_LABEL } from "./utils/nodeHeaderLabel";
```

```tsx
  /** Header text for the root node. Defaults to "Untitled". */
  rootLabel?: string;
```

```tsx
      rootLabel = DEFAULT_ROOT_LABEL,
```

render factory 內把 `theme` 與 `rootLabel` 傳給 `ObjectNode` 與 `TextNode`。因為兩者已進入 memo 比較，factory 的 `useMemo` 依賴陣列要加上 `theme` 與 `rootLabel`。

- [ ] **Step 4: Run test to verify it passes**

Run: `nub run --filter jsoncrack-react test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
nub run --filter jsoncrack-react lint
git add packages/jsoncrack-react/src
git commit -m "feat(canvas): render coloured node headers"
```

---

### Task 7: ELK 參數調校

**Files:**
- Modify: `packages/jsoncrack-react/src/JSONCrackComponent.tsx:41-45`

**Interfaces:**
- Consumes: 無
- Produces: 無新介面，只有 `layoutOptions` 的內容變更

- [ ] **Step 1: Write the failing test**

這一步沒有單元測試可寫。ELK 的輸出是幾何結果，斷言座標會鎖死一組實作細節，改任何間距都會讓測試紅掉而不代表壞掉。改成一個結構斷言，只保證選項有被送進去而非被打錯字：

`packages/jsoncrack-react/src/__tests__/layoutOptions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { layoutOptions } from "../JSONCrackComponent";

describe("layoutOptions", () => {
  it("routes edges orthogonally", () => {
    expect(layoutOptions["elk.edgeRouting"]).toBe("ORTHOGONAL");
  });

  it("sets every spacing option as a numeric string, which is what elk expects", () => {
    const spacingKeys = Object.keys(layoutOptions).filter(key => key.includes("spacing"));

    expect(spacingKeys.length).toBeGreaterThanOrEqual(4);

    for (const key of spacingKeys) {
      expect(layoutOptions[key]).toMatch(/^\d+$/);
    }
  });

  it("keeps node placement on network simplex", () => {
    expect(layoutOptions["elk.layered.nodePlacement.strategy"]).toBe("NETWORK_SIMPLEX");
  });

  it("leaves edge merging off so sibling edges stay separate", () => {
    expect(layoutOptions["elk.layered.mergeEdges"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nub run --filter jsoncrack-react test`
Expected: FAIL，`layoutOptions` 沒有被匯出

- [ ] **Step 3: Write minimal implementation**

`packages/jsoncrack-react/src/JSONCrackComponent.tsx`，把 `layoutOptions` 改為具名匯出並補上參數：

```ts
/**
 * ELK options handed to reaflow's Canvas.
 *
 * Values are tuned for the left-to-right key/value layout, not copied from a default.
 * Every spacing value must be a numeric string: elk parses these from strings and
 * silently ignores a number.
 */
export const layoutOptions: Record<string, string> = {
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.layered.spacing.edgeNodeBetweenLayers": "16",
  "elk.spacing.nodeNode": "24",
  "elk.spacing.edgeEdge": "12",
  "elk.spacing.edgeLabel": "15",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nub run --filter jsoncrack-react test`
Expected: PASS

然後做視覺調校，這部分無法靠測試判斷：

```bash
nub run --filter jsoncrack-react build
nub run --filter www dev
```

開 `http://localhost:3000`，貼上這份 repo 的 `package.json`，逐項確認並依需要調整上面四個間距值：

1. 父子層之間的水平留白足夠讓垂直通道走線，不會擠在一起
2. 同層節點不相黏，也不過度鬆散
3. 通道內的平行線彼此分辨得出來
4. 線不貼著節點邊緣
5. 用工具列的 rotate layout 依序切到 `LEFT`、`DOWN`、`UP`，四個方向都不重疊

調整後的值要寫進上面那個 const，並在 commit message 裡記下最終數值。

- [ ] **Step 5: Commit**

```bash
nub run --filter jsoncrack-react lint
git add packages/jsoncrack-react/src
git commit -m "feat(canvas): tune elk spacing and route edges orthogonally"
```

---

### Task 8: row-anchored ports（已調查，退為後續 slice）

**狀態：不執行。** spike 的結論是這個 task 的核心假設不成立，2026-08-05 與使用者確認後退成後續
slice。Task 1 到 7 與 9 不受影響，已全部交付。

#### spike 結果

原本的計畫是給每個容器 row 一個 port，設 `elk.portConstraints: "FIXED_POS"`，讓 ELK 把邊的起點
放在我們算的 y 上。讀 `reaflow@5.4.1` 的 `mapNode` 之後確認這條路走不通：

```js
ports: node.ports ? node.ports.map(port => ({
  id: port.id,
  properties: { ...port, "port.side": port.side, "port.alignment": port.alignment || "CENTER" }
})) : []
```

reaflow 只把 `id` 與 `properties` 交給 ELK。**port 的 `x` / `y` / `width` / `height` 沒有被提到
ELK port 物件的頂層**，而 ELK 讀座標讀的正是頂層欄位，不是 properties。所以 `FIXED_POS` 沒有座標
可用。

另外兩件在同一次調查中確認的事，未來若重啟這個 slice 會用到：

1. `portConstraints: "FIXED_ORDER"` 是 reaflow 硬編碼在 **node 層** 的 `nodeLayoutOptions`。因為
   它後面接 `...node.layoutOptions || {}`，所以只有 `NodeData.layoutOptions` 覆蓋得掉，下在 graph
   層的 `layoutOptions` 無效。
2. `EdgeProps.sections: EdgeSections[]` 存在，所以在 `CustomEdge` 裡後處理邊的幾何是可行的。

#### 未來重啟時的三條路

| 方案 | 效果 | 代價 |
|---|---|---|
| `FIXED_ORDER` 加 `port.index` | 同一父節點的多條邊按 row 順序沿右側分開，ELK 自行平均分佈 | 不精確對齊 row，只是比全部擠在中點好 |
| 在 `CustomEdge` 後處理 `sections` | 精確對齊 row 高度 | 要自己維持直角轉折，邊線可能穿過節點 |
| 不用 reaflow，直接驅動 elkjs | 完全控制 port 座標 | 等於重寫 canvas 層 |

### Task 9: apps/www 的 styled-components 與 Mantine 主題

這個 task 沒有自動測試，`apps/www` 沒有測試框架。驗收靠 lint、build 與手動確認清單。

**Files:**
- Modify: `apps/www/src/constants/theme.ts`（整份重寫）
- Modify: `apps/www/src/pages/_app.tsx:57-90`（Mantine theme 的 colors 與 primaryColor）、`:104-119`（Toaster 樣式）
- Modify: `apps/www/src/features/editor/views/GraphView/index.tsx:33`
- Modify: `apps/www/src/features/editor/views/GraphView/Toolbar/index.tsx:50` 附近與 `:79`

**Interfaces:**
- Consumes: Task 1 的 `mocha`、`latte`（透過 `jsoncrack-react` 匯出）
- Produces: `darkTheme`、`lightTheme` 的 token 名稱全部不變，只有值改變。`nodeColors` 移除

- [ ] **Step 1: 把色票匯出到 package 的 public API**

`packages/jsoncrack-react/src/index.ts` 加：

```ts
export { latte, mocha, ACCENT_POOL } from "./catppuccin";
export type { AccentName, CatppuccinPalette } from "./catppuccin";
```

Run: `nub run --filter jsoncrack-react build`
Expected: 成功，`dist/index.d.ts` 內含這些型別

- [ ] **Step 2: 重寫 apps/www 的 styled-components theme**

`apps/www/src/constants/theme.ts`。刪除第 20 到 55 行的 `nodeColors`，它是 package `theme.ts` 的重複副本而 canvas 已經不吃它。`fixedColors` 的 Discord 色映射進色盤：

```ts
import { latte, mocha, type CatppuccinPalette } from "jsoncrack-react";

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

const buildTheme = (palette: CatppuccinPalette) => ({
  ...fixedColors(palette),
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

export const darkTheme = buildTheme(mocha);
export const lightTheme = buildTheme(latte);

const themeDs = {
  ...lightTheme,
  ...darkTheme,
};

export default themeDs;
```

- [ ] **Step 3: 修掉七處色碼比對**

`theme.BACKGROUND_SECONDARY === "#f2f3f5"` 這個判斷式出現七次，換色盤後全部會選錯值：

| 檔案 | 位置 | 用途 |
|---|---|---|
| `GraphView/index.tsx` | 33 | 節點的 drop-shadow |
| `GraphView/Toolbar/index.tsx` | 28 附近 | `glassSurface` 的背景 |
| `GraphView/Toolbar/index.tsx` | 34 | `glassSurface` 的邊框 |
| `GraphView/Toolbar/index.tsx` | 39 | `glassSurface` 的 inset 高光 |
| `GraphView/Toolbar/index.tsx` | 44 | `glassSurface` 的近距陰影 |
| `GraphView/Toolbar/index.tsx` | 47 | `glassSurface` 的遠距陰影 |
| `GraphView/Toolbar/index.tsx` | 78 | `StyledToolbar` 的 divider 邊框 |

不要逐處改成 `$dark` prop。`glassSurface` 是共用的 css helper，六處裡有五處在它裡面，加 prop 就得讓每個使用者都往下傳。改成在 theme 物件本身放一個布林值，七處都直接讀，之後也不可能再漂移。

`apps/www/src/constants/theme.ts` 的 `buildTheme` 收一個 flavour 旗標：

```ts
const buildTheme = (palette: CatppuccinPalette, isDark: boolean) => ({
  ...fixedColors(palette),
  /**
   * Whether this theme is the dark flavour.
   *
   * Seven call sites used to answer this by comparing BACKGROUND_SECONDARY against the
   * literal "#f2f3f5". That silently selected the light-side value for every shadow and
   * border the moment the palette changed.
   */
  IS_DARK: isDark,
  BLACK_SECONDARY: palette.mantle,
```

```ts
export const darkTheme = buildTheme(mocha, true);
export const lightTheme = buildTheme(latte, false);
```

七處判斷式全部改成讀它。`GraphView/index.tsx:33`：

```tsx
    filter: drop-shadow(
      2px 2px 0
        ${({ theme }) => (theme.IS_DARK ? "rgba(0, 0, 0, 0.6)" : "rgba(15, 23, 42, 0.25)")}
    );
```

`GraphView/Toolbar/index.tsx` 的 `glassSurface`，五處都是同一個形狀，把 `theme.BACKGROUND_SECONDARY === "#f2f3f5"` 換成 `!theme.IS_DARK`，三元的兩側順序保持原樣不要對調：

```tsx
  border: 1px solid
    ${({ theme }) => (!theme.IS_DARK ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)")};
```

`StyledToolbar` 的 divider（第 78 行）同樣處理。改完後 grep 確認一個都沒漏：

```bash
rg -n 'BACKGROUND_SECONDARY === ' apps/www/src
```

預期沒有任何輸出。注意 `rg` 沒有 `-r` 這個「recursive」旗標，`-r` 是 `--replace`，寫成 `rg -rn` 會把每個 match 印成替換後的字串而看不出真相。

- [ ] **Step 4: Mantine theme 與 Toaster**

`apps/www/src/pages/_app.tsx`。Mantine 的 `colors` 需要 10 階陣列，用 `mauve` 為中心生成，並把 `primaryColor` 指向它。`defaultGradient` 的兩個硬編碼色也換掉：

```tsx
import { latte, mixHex, mocha } from "jsoncrack-react";

/** Mantine wants ten steps per colour; interpolate from the flavour base to the accent. */
const shades = (accent: string, base: string) =>
  Array.from({ length: 10 }, (_, index) => mixHex(accent, base, (index + 1) / 10)) as [
    string, string, string, string, string, string, string, string, string, string,
  ];
```

`mixHex` 來自 package，所以 Step 1 的匯出清單要一併加上：

```ts
export { accentForKey, mixHex, ROOT_ACCENT } from "./utils/accentForKey";
```

theme 內：

```tsx
  primaryColor: "mauve",
  colors: {
    mauve: shades(mocha.mauve, mocha.base),
  },
  defaultGradient: {
    from: mocha.blue,
    to: mocha.mauve,
    deg: 180,
  },
```

`Toaster` 的 `toastOptions.style` 換掉兩個硬編碼色：

```tsx
                style: {
                  background: mocha.surface0,
                  color: mocha.text,
                  borderRadius: 4,
                },
```

- [ ] **Step 5: 驗收**

```bash
nub run -r lint
nub run -r build
nub run --filter www dev
```

逐項確認：

1. `/editor` 深色是 Mocha，切到淺色是 Latte
2. `/`、`/docs`、`/legal/privacy` 三頁仍是淺色，且是 Latte 的值
3. 深色下節點陰影、底部 pill 的陰影、pill 內 divider 都是深色側的值
4. 節點 header 顯示 key 名稱，同名 key 同色，root 顯示 `Untitled`
5. toast 的底色是 `surface0`
6. `/widget` 兩種 theme 都正確

- [ ] **Step 6: Commit**

```bash
git add apps/www/src packages/jsoncrack-react/src/index.ts
git commit -m "feat(www): move styled-components and mantine themes onto catppuccin"
```

---

## 執行結果（2026-08-05）

Task 1 到 7 與 Task 9 全部完成，97 個單元測試通過，`nub run -r build` 綠，static export 產物確認
含 Mocha 與 Latte 兩組色值。Task 8 已調查後退為後續 slice，見該節。

分支 `feat/catppuccin-canvas`，commits：

| Task | Commit |
|---|---|
| 1 色票模組 | `775761ed` |
| 2 accentForKey / mixHex | `9308c07c` |
| 3 尺寸常數收斂 | `85c357ff` |
| 4 canvas theme | `9eb968c0` |
| 5 nodeHeaderLabel | `32f7e356` |
| 6 節點 header 渲染 | `c90d5596` |
| 7 ELK 參數 | `64ae7361` |
| 9 apps 主題 | `36283483` |
| 追加修正 | `b31833f6` |

### 計畫與實際的四處偏差

上面的 task 內容保留當時的計畫原貌，以下是執行時發現與它不符的地方。

1. **Task 9 Step 2 說可以刪掉 `nodeColors`，這是錯的。** 它不是 canvas theme 的重複副本：
   `TreeView/Label.tsx` 與 `TreeView/Value.tsx` 在讀 `theme.NODE_COLORS`，而且需要 `PARENT_OBJ`
   與 `PARENT_ARR` 這兩個 canvas 沒有的欄位。實際做法是保留這個 key 並改由色盤組出。

2. **色碼比對是十處，不是 Task 9 Step 3 列的七處。** 漏掉的是 `Toolbar/SearchInput.tsx` 的兩處
   （已在 Plan A 修掉，那裡的紅色本身也在色盤外，改用 `theme.CRIMSON` 與
   `theme.INTERACTIVE_NORMAL` 後連亮暗分支都不需要）以及 `BottomBar.tsx:71`（歸 Plan B）。

3. **`next build` 一度整個失敗，plan 完全沒有預期到。** `_app.tsx` 與 constants 從 package barrel
   import 之後，Next.js 收集 page data 時會在 server 端載入那些模組，barrel 又 re-export canvas
   元件，於是 reaflow 經過 nub 的 module preload 時丟出
   `TypeError: Cannot read properties of undefined (reading 'match')`。TypeScript 與 client compile
   都通過，只在 static export 階段爆。修法是新增 `jsoncrack-react/palette` 子路徑入口，只含色票、
   accent helpers 與節點尺寸，不碰 React 與 renderer，建置後 0.22 kB。`vite.config.ts` 因此改成
   多 entry。

4. **`layoutOptions` 移到獨立的 `src/layoutOptions.ts`**，plan 原本說從 `JSONCrackComponent` 具名
   匯出。測試若 import 那個元件會連帶載入 CSS module 與 reaflow，在 vitest 的 node 環境下無法解析。

### 尚未驗收的項目

以下需要人眼確認，程式碼已交付但數值可能要再調：

- Task 7 表格裡的四個間距值是起始值。四個 `layoutDirection` 下的觀感尚未逐一確認
- Task 9 Step 5 的六項手動驗收清單

### 後續工作

- Task 8 的 row-anchored ports，三條替代路徑見該節
- Plan B（`2026-08-05-schema-validation-and-pane.md`）的 PaneBar 與 schema 驗證，其中會處理
  `BottomBar.tsx:71` 這第十處色碼比對
