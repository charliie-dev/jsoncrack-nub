# Schema Validation and Editor Pane Implementation Plan（Plan B，五塊中的 3 / 4）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓一份 JSON Schema 能驗證四種輸入格式，並把編輯器面板頂部那條 bar 重組成帶驗證狀態與 schema 入口的形狀，同時把「一進來就有範例」換成格式引導卡片。

**Architecture:** 同一份 `useFile.jsonSchema` 餵給三套驗證器：JSON 走 Monaco 現有的 `jsonDefaults`，YAML 走 monaco-yaml，XML 與 CSV 走 ajv 驗證 `contentToJson` 的產出。三者的結果統一收斂成 `useFile` 上的一組驗證狀態欄位，由面板頂部的狀態燈呈現。

**Tech Stack:** Next.js 16 static export、Monaco 0.56（runtime 從 `/monaco/vs` 以 AMD 載入）、monaco-yaml 5.5.1、ajv 8.20、zustand、Mantine 8

## 與 Plan A 的關係

Plan B 不依賴 Plan A 的任何介面，兩份可以並行，但有兩個交界：

1. **`theme.IS_DARK`** 由 Plan A 的 Task 9 加進 `apps/www/src/constants/theme.ts`。Plan B 的 Task 5 要用它修掉 `BottomBar.tsx:71` 的色碼比對。若 Plan B 先做到那一步而 Plan A 還沒動，就在 Task 5 裡先加上這個 token，Plan A 遇到已存在時跳過。
2. **`BottomBar.tsx`** 只由 Plan B 改。Plan A 的 Task 9 列出的七處色碼比對刻意不含這個檔案的第 71 行，那是第八處，屬於 Plan B。

## 一個已知的取捨

`apps/www` 沒有測試框架，spec 決定這次不建立。代價集中在 Task 2：ajv 那層要判斷 draft、要在 schema 編譯失敗時 fail soft、要把 ajv 的錯誤物件轉成可讀清單，這是本次唯一真正該有單元測試的邏輯，而它只能靠手動驗收。

若要改為建立測試，成本是 `apps/www` 加 vitest devDependency、一個 `test` script、一份 config，可以照 `packages/jsoncrack-react` 的設定抄。這超出已批准的 spec 範圍，所以 plan 照 spec 走，把它記在這裡。

## Global Constraints

- JSON Schema 一律以 **draft-07** 為準。ajv 只用主套件，不裝 `ajv-draft-04`
- 三套驗證器共用同一份 `useFile.jsonSchema`，不新增第二個 schema 輸入介面
- **綠勾必須代表真的驗證過了。** 驗證器不可用時顯示中性狀態，不可顯示綠勾
- 驗證失敗不阻擋畫圖。schema 只影響狀態燈與錯誤清單
- Monaco 維持 runtime 從 `/monaco/vs` 以 AMD 載入，不改成 bundle
- 版本鎖：monaco-editor 0.56.0、monaco-yaml `^5.5.1`（peer 是 `monaco-editor >=0.36`）、ajv `^8.20.0`
- 每個 task 的 commit 之前 `nub run --filter www lint` 必須通過
- XML 與 CSV 沒有行內 marker，錯誤只有 JSON Pointer 路徑。這是已接受的限制，不要為此改動 Monaco 的 language 註冊

---

### Task 1: monaco-yaml worker spike

**這個 task 不產出正式程式碼，只驗證一個假設。失敗就停下來回報，不要硬做。**

現在的 monaco 由 `@monaco-editor/react` 的 loader 從 `/monaco/vs` 以 AMD 載入（`TextEditor.tsx:18`），loader 自己會設定 `MonacoEnvironment`。monaco-yaml 需要 `MonacoEnvironment.getWorker` 回傳 bundler 產出的 worker。要驗證的是覆寫 `getWorker` 只處理 `yaml` label 時，其他 label 能否落回 AMD 原本的解析路徑。

**Files:**
- Modify（暫時，最後全部還原）: `apps/www/src/features/editor/TextEditor.tsx`

- [ ] **Step 1: 裝依賴**

```bash
nub add --filter www monaco-yaml@^5.5.1
```

確認 `apps/www/package.json` 的 dependencies 出現 `monaco-yaml`，且 `pnpm-lock.yaml` 有更新。

- [ ] **Step 2: 暫時接上 worker 與 configureMonacoYaml**

在 `TextEditor.tsx` 的 `loader.config` 之後加入：

```ts
type WorkerFactory = (moduleId: string, label: string) => Worker;

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker?: WorkerFactory;
      getWorkerUrl?: (moduleId: string, label: string) => string;
    };
  }
}

if (typeof window !== "undefined") {
  const previous = window.MonacoEnvironment;

  window.MonacoEnvironment = {
    ...previous,
    getWorker: (moduleId, label) => {
      if (label === "yaml") {
        return new Worker(new URL("monaco-yaml/yaml.worker", import.meta.url));
      }

      if (previous?.getWorker) return previous.getWorker(moduleId, label);
      if (previous?.getWorkerUrl) return new Worker(previous.getWorkerUrl(moduleId, label));

      throw new Error(`No worker factory for label ${label}`);
    },
  };
}
```

在元件內加一個暫時的 effect：

```ts
  React.useEffect(() => {
    if (!monaco) return;

    let disposed = false;
    let handle: { dispose: () => void } | undefined;

    void import("monaco-yaml").then(({ configureMonacoYaml }) => {
      if (disposed) return;
      handle = configureMonacoYaml(monaco, {
        validate: true,
        enableSchemaRequest: true,
        schemas: [
          {
            uri: "http://example.com/schema.json",
            fileMatch: ["*"],
            schema: { type: "object", required: ["mustExist"], properties: { mustExist: { type: "string" } } },
          },
        ],
      });
    });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [monaco]);
```

- [ ] **Step 3: 驗證 YAML 端出現 marker**

Run: `nub run --filter www dev`

在編輯器把格式切成 YAML，貼上：

```yaml
somethingElse: 1
```

Expected: `somethingElse` 或文件開頭出現紅波浪線，hover 顯示缺少 `mustExist`。開瀏覽器 devtools 的 Network 面板，應該看到一個 yaml worker 的 chunk 被載入。

- [ ] **Step 4: 驗證 JSON 端沒有壞掉**

把格式切回 JSON，貼上這份 repo 的 `package.json`。

Expected: 沒有紅波浪線；輸入 `"` 時 Monaco 的自動完成仍會出現；devtools console 沒有 worker 相關錯誤。

**如果 JSON 端壞了**，表示 falsy 或委派回 `getWorkerUrl` 的路徑不成立。改成把非 yaml 的 label 直接回傳 `previous.getWorker` 的結果而不做任何 fallback，再試一次。兩種都不行就把觀察寫下來，還原所有改動，停止 Task 1、3、4，YAML 改用 Task 2 的 ajv 路徑處理，其餘 task 照原樣進行。

- [ ] **Step 5: 還原並記錄**

把 Step 2 的暫時 effect 移除，保留 `MonacoEnvironment` 的覆寫（Task 3 會用到它）。`monaco-yaml` 依賴保留。

```bash
nub run --filter www lint
git add apps/www/package.json pnpm-lock.yaml apps/www/src/features/editor/TextEditor.tsx
git commit -m "build(www): add monaco-yaml and wire its worker factory"
```

---

### Task 2: ajv 驗證模組與 useFile 的驗證狀態

**Files:**
- Create: `apps/www/src/lib/utils/validateAgainstSchema.ts`
- Modify: `apps/www/src/store/useFile.ts:50-57`（initialStates）、`:100-126`（setContents）、`:23-36`（actions 型別）

**Interfaces:**
- Consumes: `useFile.jsonSchema`、`contentToJson` 的產出
- Produces:
  - `type SchemaIssue = { path: string; message: string }`
  - `type SchemaValidation = { status: "off" | "valid" | "invalid" | "unavailable"; issues: SchemaIssue[]; reason?: string }`
  - `validateAgainstSchema(data: unknown, schema: object | null): SchemaValidation`
  - `useFile` 新增 state `schemaValidation: SchemaValidation`

- [ ] **Step 1: 裝依賴**

```bash
nub add --filter www ajv@^8.20.0
```

- [ ] **Step 2: 寫驗證模組**

`apps/www/src/lib/utils/validateAgainstSchema.ts`

```ts
import Ajv, { type ErrorObject } from "ajv";

/**
 * One problem with the current document.
 *
 * `path` is whatever locator the producing validator can offer: ajv gives a JSON Pointer
 * such as `/author/email`, while Monaco markers give `line:column`. The pane renders it
 * verbatim, so the two can share this shape.
 */
export type SchemaIssue = {
  path: string;
  message: string;
};

/**
 * Outcome of validating the current document against the user's schema.
 *
 * `unavailable` exists so the status lamp never shows a green tick for a document that was
 * not actually checked. A schema that fails to compile, or a draft ajv cannot read, lands
 * here rather than silently passing.
 */
export type SchemaValidation = {
  status: "off" | "valid" | "invalid" | "unavailable";
  issues: SchemaIssue[];
  reason?: string;
};

export const SCHEMA_OFF: SchemaValidation = { status: "off", issues: [] };

const formatIssue = (error: ErrorObject): SchemaIssue => ({
  path: error.instancePath || "/",
  message: error.message ?? "is invalid",
});

/**
 * Validate a parsed document against a JSON Schema.
 *
 * strict is off because real-world schemas carry keywords ajv would otherwise reject
 * outright, and this is a viewer: refusing to validate is worse than tolerating an unknown
 * keyword. allErrors is on because the pane lists every problem, not just the first.
 *
 * Only draft-07 is supported. A schema declaring draft-04 or 2020-12 makes ajv throw at
 * compile time, which surfaces as `unavailable` with ajv's own message.
 */
export const validateAgainstSchema = (data: unknown, schema: object | null): SchemaValidation => {
  if (!schema) return SCHEMA_OFF;

  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);

    if (validate(data)) return { status: "valid", issues: [] };

    return {
      status: "invalid",
      issues: (validate.errors ?? []).map(formatIssue),
    };
  } catch (error) {
    return {
      status: "unavailable",
      issues: [],
      reason: error instanceof Error ? error.message : "Schema could not be compiled",
    };
  }
};
```

- [ ] **Step 3: 接進 useFile**

`apps/www/src/store/useFile.ts`。import 與 initialStates：

```ts
import { FileFormat } from "../enums/file.enum";
import { SCHEMA_OFF, validateAgainstSchema, type SchemaValidation } from "../lib/utils/validateAgainstSchema";
```

```ts
const initialStates = {
  fileData: null as File | null,
  format: FileFormat.JSON,
  contents: defaultJson,
  error: null as any,
  hasChanges: false,
  jsonSchema: null as object | null,
  schemaValidation: SCHEMA_OFF as SchemaValidation,
};
```

`setJsonSchema` 要在 schema 變更時立刻重驗，不能等到下一次輸入：

```ts
  setJsonSchema: jsonSchema => {
    set({ jsonSchema });
    get().setContents({ hasChanges: false, skipUpdate: true });
  },
```

`setContents` 在 `contentToJson` 之後、`debouncedUpdateJson` 之前插入驗證。只有 XML 與 CSV 走 ajv，JSON 與 YAML 由 Monaco 與 monaco-yaml 各自產 marker，重複驗證會讓同一個問題出現兩次：

```ts
      const json = await contentToJson(get().contents, get().format);

      const format = get().format;
      const usesAjv = format === FileFormat.XML || format === FileFormat.CSV;
      set({
        schemaValidation: usesAjv ? validateAgainstSchema(json, get().jsonSchema) : SCHEMA_OFF,
      });

      if (!useConfig.getState().liveTransformEnabled && skipUpdate) return;
```

`error` 的 catch 區塊維持原樣。parse 失敗時 `contentToJson` 會 throw，所以驗證那行不會執行，`schemaValidation` 保留上一次的值。在 catch 內把它清成 `SCHEMA_OFF`，避免顯示過期結果：

```ts
    } catch (error: any) {
      set({ schemaValidation: SCHEMA_OFF });
      if (error?.mark?.snippet) return set({ error: error.mark.snippet });
```

`JsonActions` 型別不需要新增 action，`schemaValidation` 是 state 而非 action。

- [ ] **Step 4: 手動驗證**

Run: `nub run --filter www dev`

1. 切到 CSV，貼 `name,age\nalice,30`，開 Tools 選單的 JSON Schema，貼上：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["name", "age", "email"],
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "number" },
      "email": { "type": "string" }
    }
  }
}
```

Expected: `schemaValidation.status` 是 `invalid`，issues 含 `/0` 缺少 `email`。此時還沒有 UI，用 devtools 的 React 或在 `setContents` 暫時 `console.log` 確認。

2. 把 schema 的 `$schema` 改成 `http://json-schema.org/draft-04/schema#`
Expected: status 變成 `unavailable`，`reason` 是 ajv 的訊息

3. 切到 JSON
Expected: status 變回 `off`，因為 JSON 由 Monaco 負責

- [ ] **Step 5: Commit**

```bash
nub run --filter www lint
git add apps/www/package.json pnpm-lock.yaml apps/www/src/lib/utils/validateAgainstSchema.ts apps/www/src/store/useFile.ts
git commit -m "feat(www): validate xml and csv against the json schema with ajv"
```

---

### Task 3: monaco-yaml 正式整合與 SchemaModal 改 draft-07

**Files:**
- Modify: `apps/www/src/features/editor/TextEditor.tsx:45-62`
- Modify: `apps/www/src/features/modals/SchemaModal/index.tsx:15-31`（預設範例）、`:56`（說明文字）

**Interfaces:**
- Consumes: Task 1 留下的 `MonacoEnvironment.getWorker` 覆寫、`useFile.jsonSchema`
- Produces: 無新介面

- [ ] **Step 1: 把 configureMonacoYaml 接成正式 effect**

`TextEditor.tsx`。現有的 `jsonDefaults` effect 保留不動，在它下面加：

```ts
  React.useEffect(() => {
    if (!monaco) return;

    let disposed = false;
    let handle: { update: (options: unknown) => void; dispose: () => void } | undefined;

    // monaco-yaml allows only one configured instance at a time, so the handle is kept and
    // updated rather than reconfigured. Dynamic import keeps its worker out of the initial
    // bundle for the majority of sessions that never switch to YAML.
    void import("monaco-yaml").then(({ configureMonacoYaml }) => {
      if (disposed) return;

      handle = configureMonacoYaml(monaco, {
        validate: true,
        enableSchemaRequest: true,
        ...(jsonSchema && {
          schemas: [
            {
              uri: "http://example.com/schema.json",
              fileMatch: ["*"],
              schema: jsonSchema,
            },
          ],
        }),
      });
    });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [monaco, jsonSchema]);
```

`jsonSchema` 放進依賴陣列，schema 變更時 effect 重跑並 dispose 舊 handle。這比呼叫 `update()` 少一條分支，代價是重建一次 worker 設定，而 schema 變更是使用者手動觸發的低頻操作。

- [ ] **Step 2: SchemaModal 的預設範例改成 draft-07**

`apps/www/src/features/modals/SchemaModal/index.tsx` 第 15 到 31 行的 `useState` 初始值：

```tsx
  const [schema, setSchema] = React.useState(
    JSON.stringify(
      {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "Product",
        description: "A product from catalog",
        type: "object",
        properties: {
          id: {
            description: "The unique identifier for a product",
            type: "integer",
          },
        },
        required: ["id"],
      },
      null,
      2
    )
  );
```

第 56 行的說明文字改成講清楚支援範圍與各格式的差別：

```tsx
        <Text fz="sm">
          Draft-07 schemas only. JSON and YAML show violations inline in the editor; XML and CSV
          list them in the pane header, addressed by JSON Pointer.
        </Text>
        <Text fz="sm" c="dimmed">
          XML is validated after conversion to JSON, not as XML. Attributes become keys prefixed
          with <Code>$</Code>, and a single child element is an object while repeated ones are an
          array, so write the schema against that shape.
        </Text>
```

`Code` 要加進第 3 行的 `@mantine/core` import 清單（`ExternalMode.tsx` 有相同用法可參考）。

**spec 提到這條 XML 規則也要寫進 `docs.tsx`，這裡刻意不做。** 使用者是在 `SchemaModal` 裡貼 schema 的，說明放在他當下會看到的位置才有作用；`docs.tsx` 是說明頁，把同一段話放兩處只會多一份會過期的副本。若之後決定要放，那是獨立的文件工作。

- [ ] **Step 3: 手動驗證**

Run: `nub run --filter www dev`

1. 開 JSON Schema modal，直接套用預設範例
2. 切到 YAML，貼 `name: x`
Expected: 出現紅波浪線，訊息是缺少 `id`
3. 切到 JSON，貼 `{"name":"x"}`
Expected: 同樣出現紅波浪線
4. 切到 CSV，貼 `name\nx`
Expected: 編輯器內沒有波浪線，Task 2 的 `schemaValidation` 是 `invalid`
5. 清除 schema（modal 的 Clear）
Expected: 三種格式都不再有 schema 相關的波浪線，YAML 的語法錯誤仍會標出

- [ ] **Step 4: Commit**

```bash
nub run --filter www lint
git add apps/www/src/features/editor/TextEditor.tsx apps/www/src/features/modals/SchemaModal/index.tsx
git commit -m "feat(www): validate yaml against the json schema via monaco-yaml"
```

---

### Task 4: marker 數接線

`TextEditor.tsx:98` 現在是 `onValidate={errors => setError(errors[0]?.message || "")}`，只留第一條訊息、丟掉數量。狀態燈要顯示錯誤數，所以要同時存下數量與清單。

**Files:**
- Modify: `apps/www/src/features/editor/TextEditor.tsx:98`
- Modify: `apps/www/src/store/useFile.ts`（新增 `markers` state 與 `setMarkers` action）

**Interfaces:**
- Consumes: Monaco 的 `editor.IMarker[]`
- Produces: `useFile.markers: SchemaIssue[]`、`setMarkers(markers: SchemaIssue[]): void`

- [ ] **Step 1: useFile 加 markers**

Task 2 已經 import 過 `validateAgainstSchema` 那個模組，把型別一併加進同一行 import：

```ts
import {
  SCHEMA_OFF,
  validateAgainstSchema,
  type SchemaIssue,
  type SchemaValidation,
} from "../lib/utils/validateAgainstSchema";
```

`initialStates` 加：

```ts
  markers: [] as SchemaIssue[],
```

`JsonActions` 加：

```ts
  setMarkers: (markers: SchemaIssue[]) => void;
```

實作：

```ts
  setMarkers: markers => set({ markers }),
```

`error` 保留不動，`BottomBar` 目前在讀它，Task 5 才會改。

- [ ] **Step 2: TextEditor 把 marker 轉成 issues**

```tsx
          onValidate={markers => {
            // Monaco reports line and column, not a JSON Pointer. The pane shows that position
            // verbatim: JSON and YAML violations are already underlined in the editor, so this
            // list is a count and a summary rather than the primary way to find them.
            setMarkers(
              markers.map(marker => ({
                path: `${marker.startLineNumber}:${marker.startColumn}`,
                message: marker.message,
              }))
            );
            setError(markers[0]?.message || "");
          }}
```

元件內取得 action，放在第 37 行 `setError` 那一行旁邊：

```ts
  const setMarkers = useFile(state => state.setMarkers);
```

- [ ] **Step 3: 手動驗證**

Run: `nub run --filter www dev`

貼一份缺右大括號的 JSON。
Expected: `useFile.markers` 長度大於 0，每筆的 path 形如 `12:3`；`error` 仍是第一條訊息

- [ ] **Step 4: Commit**

```bash
nub run --filter www lint
git add apps/www/src/features/editor/TextEditor.tsx apps/www/src/store/useFile.ts
git commit -m "feat(www): keep the full monaco marker list, not just the first message"
```

---

### Task 5: 把 BottomBar 改造成 PaneBar

`BottomBar` 的名字是歷史遺留。`editor.tsx:166` 把它放在 `TextEditor` 之前，而 `StyledTextEditor` 是 `flex-direction: column`（`editor.tsx:60`），所以它顯示在編輯器面板的**頂部**，而且已經有 `border-bottom`。spec 說要新增的 PaneBar 位置就是它，所以這是改造而非新增。

它已經有 Valid / Invalid 狀態（`BottomBar.tsx:111-132`）與格式下拉（`:151-171`）。要補的是 schema 入口、狀態燈的錯誤數與中性狀態，以及第 71 行那處色碼比對。

**Files:**
- Rename: `apps/www/src/features/editor/BottomBar.tsx` → `apps/www/src/features/editor/PaneBar.tsx`
- Modify: `apps/www/src/pages/editor.tsx:167`（引用改名）
- Modify: `apps/www/src/features/editor/Toolbar/ToolsMenu.tsx:41-49`（移除 JSON Schema 項目）
- Modify: `apps/www/src/constants/theme.ts`（若 Plan A 尚未加 `IS_DARK` 就在此加上）

**Interfaces:**
- Consumes: Task 2 的 `useFile.schemaValidation`、Task 4 的 `useFile.markers`、`useFile.error`、Plan A 的 `theme.IS_DARK`
- Produces: 具名匯出 `PaneBar`

- [ ] **Step 1: 改名並修掉色碼比對**

```bash
git mv apps/www/src/features/editor/BottomBar.tsx apps/www/src/features/editor/PaneBar.tsx
```

把元件與 styled component 一併改名：`BottomBar` → `PaneBar`、`StyledBottomBar` → `StyledPaneBar`、`StyledBottomBarItem` → `StyledPaneBarItem`。

第 71 行的色碼比對改成讀 token。這是 spec 列出的第八處，Plan A 刻意沒碰：

```tsx
  &:hover:not(&:disabled) {
    background-color: ${({ theme }) =>
      theme.IS_DARK ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"};
    color: ${({ theme }) => theme.INTERACTIVE_HOVER};
  }
```

若 Plan A 還沒把 `IS_DARK` 加進 `constants/theme.ts`，照 Plan A Task 9 Step 3 的寫法先加上，Plan A 執行到那一步時遇到已存在就跳過。

`editor.tsx` 第 12 行附近的 import 與第 167 行的用法一併改名。

- [ ] **Step 2: 狀態燈改成三態加計數**

替換原本第 111 到 132 行的那個 `StyledPaneBarItem`。狀態的優先序是 parse 錯誤、schema 不可用、marker、schema 違規、通過：

```tsx
type LampState = {
  icon: React.ReactNode;
  label: string;
  detail: string | null;
};

const useLampState = (): LampState => {
  const error = useFile(state => state.error);
  const markers = useFile(state => state.markers);
  const schemaValidation = useFile(state => state.schemaValidation);

  if (error) {
    return { icon: <VscError color="red" />, label: "Invalid", detail: error };
  }

  if (schemaValidation.status === "unavailable") {
    return {
      icon: <VscWarning />,
      label: "Not checked",
      detail: schemaValidation.reason ?? "The schema could not be compiled",
    };
  }

  if (markers.length > 0) {
    return {
      icon: <VscError color="red" />,
      label: `${markers.length} problem${markers.length === 1 ? "" : "s"}`,
      detail: markers.map(marker => `${marker.path} ${marker.message}`).join("\n"),
    };
  }

  if (schemaValidation.status === "invalid") {
    const count = schemaValidation.issues.length;
    return {
      icon: <VscError color="red" />,
      label: `${count} problem${count === 1 ? "" : "s"}`,
      detail: schemaValidation.issues.map(issue => `${issue.path} ${issue.message}`).join("\n"),
    };
  }

  return { icon: <VscCheck />, label: "Valid", detail: null };
};
```

`VscWarning` 加進第 8 行的 `react-icons/vsc` import。元件內用它：

```tsx
  const lamp = useLampState();
```

```tsx
        <StyledPaneBarItem>
          {lamp.detail ? (
            <Popover width="auto" shadow="md" position="bottom" withArrow>
              <Popover.Target>
                <Flex align="center" gap={2}>
                  {lamp.icon}
                  <Text fw={500} fz="xs">
                    {lamp.label}
                  </Text>
                </Flex>
              </Popover.Target>
              <Popover.Dropdown style={{ pointerEvents: "none", maxWidth: 480 }}>
                <Text size="xs" style={{ whiteSpace: "pre-wrap" }}>
                  {lamp.detail}
                </Text>
              </Popover.Dropdown>
            </Popover>
          ) : (
            <Flex align="center" gap={2}>
              {lamp.icon}
              <Text size="xs">{lamp.label}</Text>
            </Flex>
          )}
        </StyledPaneBarItem>
```

`Popover` 的 position 從 `top` 改成 `bottom`，因為這條 bar 在面板頂部，往上彈會超出視窗。

- [ ] **Step 3: 加 JSON Schema 入口，並從 Tools 選單移除**

在 `StyledRight` 的格式下拉左邊加一個常駐按鈕：

```tsx
        <Tooltip label="Validate against a JSON Schema" position="bottom" withArrow openDelay={750}>
          <StyledPaneBarItem
            onClick={() => {
              setVisible("SchemaModal", true);
              gaEvent("open_schema_modal");
            }}
          >
            <VscJson />
            <Text fz="xs">JSON Schema</Text>
          </StyledPaneBarItem>
        </Tooltip>
```

需要的 import：`VscJson` 加進 `react-icons/vsc`，以及：

```ts
import { useModal } from "../../store/useModal";
```

```ts
  const setVisible = useModal(state => state.setVisible);
```

`ToolsMenu.tsx` 移除第 41 到 49 行的 JSON Schema 項目。同一個入口留在兩處會讓使用者不確定哪個才是主要的。移除後該檔案的 `VscJson` import 若沒有其他用途也一併刪掉。

- [ ] **Step 4: 手動驗證**

Run: `nub run --filter www dev`

1. 貼一份合法 JSON
Expected: 狀態燈是綠勾加 `Valid`
2. 刪掉一個右大括號
Expected: 變成 `1 problem`，hover 顯示 `行:列 訊息`
3. 修好，套用 Task 3 的 draft-07 範例 schema，貼 `{"name":"x"}`
Expected: 顯示 problem 數，內容是缺少 `id`
4. 把 schema 換成 draft-04
Expected: 顯示 `Not checked` 加警告圖示，**不是綠勾**
5. 切到 CSV 並貼不符 schema 的內容
Expected: 顯示 problem 數，路徑是 JSON Pointer 形如 `/0`
6. Tools 選單不再有 JSON Schema，PaneBar 上有
7. 亮暗兩種主題下 hover 的背景色都正確

- [ ] **Step 5: Commit**

```bash
nub run --filter www lint
git add apps/www/src
git commit -m "feat(www): rebuild the editor pane bar with a three-state validation lamp"
```

---

### Task 6: 空狀態格式引導

`useFile.ts:147` 的 `checkEditorSession` 目前一律把 `defaultJson` 塞進編輯器，所以編輯器從不為空。這個 task 讓它在沒有 session、沒有 `?json=` 參數時保持空白，並在 canvas 中央顯示格式卡片。

**這是使用者可見的行為變更，spec 已確認採用。**

**Files:**
- Create: `apps/www/src/features/editor/views/GraphView/EmptyState.tsx`
- Modify: `apps/www/src/store/useFile.ts:142-154`
- Modify: `apps/www/src/features/editor/views/GraphView/index.tsx`

**Interfaces:**
- Consumes: `useFile.setContents`、`useFile.contents`、`useModal.setVisible`、`example.json`
- Produces: 具名匯出 `EmptyState`

- [ ] **Step 1: checkEditorSession 不再塞預設範例**

```ts
  checkEditorSession: (url, widget) => {
    if (url && typeof url === "string" && isURL(url)) {
      return get().fetchUrl(url);
    }

    const sessionContent = sessionStorage.getItem("content") as string | null;
    const format = sessionStorage.getItem("format") as FileFormat | null;

    if (format) set({ format });

    // Deliberately empty when there is nothing to restore. The canvas shows a format picker
    // instead of a pre-filled example, so the first thing a new user sees is a choice rather
    // than someone else's data.
    if (widget) return get().setContents({ contents: "", hasChanges: false });

    get().setContents({ contents: sessionContent ?? "", hasChanges: false });
  },
```

`initialStates.contents` 也要從 `defaultJson` 改成空字串，否則首次 render 會閃一下範例：

```ts
  contents: "",
```

`defaultJson`（第 12 行）與 `exampleJson`（第 5 行的 import）在這之後都沒有使用者了，兩行一併刪掉。範例改由 `EmptyState` 自己 import，那是唯一還需要它的地方。lint 會因為未使用的變數而失敗，所以不能留著。

**注意 `setContents` 的第 103 行是 `...(contents && { contents })`**，空字串是 falsy，所以傳空字串不會清掉既有內容。要改成明確判斷 undefined：

```ts
      set({
        ...(contents !== undefined && { contents }),
        error: null,
```

- [ ] **Step 2: 寫 EmptyState**

`apps/www/src/features/editor/views/GraphView/EmptyState.tsx`

```tsx
import React from "react";
import { Button, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import styled from "styled-components";
import { event as gaEvent } from "nextjs-google-analytics";
import { LuFolderOpen } from "react-icons/lu";
import { VscJson, VscSymbolNamespace, VscTable, VscListTree } from "react-icons/vsc";
import exampleJson from "../../../../data/example.json";
import { FileFormat } from "../../../../enums/file.enum";
import { jsonToContent } from "../../../../lib/utils/jsonAdapter";
import useFile from "../../../../store/useFile";
import { useModal } from "../../../../store/useModal";

const StyledOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
`;

const FORMAT_CARDS = [
  {
    format: FileFormat.JSON,
    label: "JSON",
    hint: "Objects, arrays & nested data",
    icon: <VscJson size={28} />,
  },
  {
    format: FileFormat.YAML,
    label: "YAML",
    hint: "Config files & pipelines",
    icon: <VscListTree size={28} />,
  },
  {
    format: FileFormat.XML,
    label: "XML",
    hint: "Markup & structured documents",
    icon: <VscSymbolNamespace size={28} />,
  },
  {
    format: FileFormat.CSV,
    label: "CSV",
    hint: "Tables & spreadsheets",
    icon: <VscTable size={28} />,
  },
] as const;

export const EmptyState = () => {
  const setContents = useFile(state => state.setContents);
  const setVisible = useModal(state => state.setVisible);

  const loadExample = async (format: FileFormat) => {
    // Convert the bundled JSON example into the chosen format rather than shipping four
    // fixtures. jsonToContent already backs the format dropdown, so the output is exactly
    // what switching format would produce.
    const contents = await jsonToContent(JSON.stringify(exampleJson, null, 2), format);

    setContents({ contents, format, hasChanges: false });
    gaEvent("empty_state_pick_format", { label: format });
  };

  return (
    <StyledOverlay>
      <Stack gap="lg" align="center" maw={640} w="100%">
        <Stack gap={4} align="center">
          <Title order={3}>Start with a format</Title>
          <Text c="dimmed" fz="sm" ta="center">
            Pick a format to load an example, or just start typing in the editor.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" w="100%">
          {FORMAT_CARDS.map(card => (
            <Card
              key={card.format}
              withBorder
              radius="md"
              padding="md"
              component="button"
              type="button"
              onClick={() => void loadExample(card.format)}
            >
              <Stack gap={6} align="center">
                {card.icon}
                <Text fw={600} fz="sm">
                  {card.label}
                </Text>
                <Text c="dimmed" fz="xs" ta="center">
                  {card.hint}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Button
          variant="default"
          fullWidth
          leftSection={<LuFolderOpen />}
          onClick={() => {
            setVisible("ImportModal", true);
            gaEvent("empty_state_open_file");
          }}
        >
          Open File
        </Button>
      </Stack>
    </StyledOverlay>
  );
};
```

- [ ] **Step 3: 在 GraphView 顯示它**

`apps/www/src/features/editor/views/GraphView/index.tsx`。widget 模式不顯示，那是嵌入用的，沒有編輯器可以打字：

```tsx
  const contents = useFile(state => state.contents);
  const isEmpty = contents.trim().length === 0;
```

```tsx
    <Box pos="relative" h="100%" w="100%">
      {!isWidget && isEmpty && <EmptyState />}
      {!isWidget && <SecureInfo />}
```

需要的 import：

```ts
import useFile from "../../../../store/useFile";
import { EmptyState } from "./EmptyState";
```

- [ ] **Step 4: 手動驗證**

```bash
nub run --filter www dev
```

用無痕視窗開 `http://localhost:3000`（避免 sessionStorage 殘留）。

1. Expected: 編輯器空白，canvas 中央顯示四張卡片與 Open File
2. 點 YAML 卡片
Expected: 編輯器出現 YAML 格式的範例，PaneBar 的格式顯示 YAML，圖畫出來，卡片消失
3. 全選刪除編輯器內容
Expected: 卡片重新出現
4. 重新整理
Expected: 編輯器保留剛才的內容（sessionStorage），不顯示卡片
5. 點 Open File
Expected: 開啟 ImportModal
6. 開 `http://localhost:3000/widget`
Expected: 不顯示卡片
7. 開 `http://localhost:3000/?json=https://raw.githubusercontent.com/AykutSarac/jsoncrack.com/main/package.json`
Expected: 抓取該 URL 的內容，不顯示卡片

- [ ] **Step 5: Commit**

```bash
nub run --filter www lint
git add apps/www/src
git commit -m "feat(www): replace the preloaded example with a format picker"
```

---

### Task 7: static export 與容器內驗證

worker chunk 在 `next dev` 下可用不代表 `output: "export"` 之後可用。這個 task 確認 build 產物與容器都正常。

**Files:**
- Modify: `apps/www/next.config.js`（僅在需要時，加註記）

- [ ] **Step 1: build 並確認 worker chunk 存在**

```bash
nub run --filter www build
fd -t f 'worker' apps/www/out/_next/static | head -20
```

Expected: 至少一個檔名含 `yaml` 或 `worker` 的 js 檔。若完全找不到，表示 webpack 沒有把 `new Worker(new URL(...))` 打包成 chunk，回頭確認 Task 1 的寫法有沒有被動態 import 包住而導致 webpack 靜態分析不到。

- [ ] **Step 2: 在 static export 產物上驗證**

```bash
nub run --filter www start
```

開 `http://localhost:3000`，套用 draft-07 schema，切到 YAML 貼不符的內容。

Expected: 出現紅波浪線。devtools 的 Network 面板顯示 worker chunk 從 `/_next/static/` 載入，回應 200

- [ ] **Step 3: 容器內驗證**

```bash
docker build -f apps/www/Dockerfile -t jsoncrack-nub:schema-check .
docker run --rm -p 8080:8080 jsoncrack-nub:schema-check
```

開 `http://localhost:8080`，重複 Step 2 的操作。

Expected: 行為一致。這一步實際驗證的是 `apps/www/nginx.conf` 的 `try_files $uri $uri.html $uri/index.html =404` 能供應 worker chunk。它是帶副檔名的實體檔案，第一個 `$uri` 就會命中，所以預期不需要改 nginx 設定。若 worker 回 404，把觀察記下來再決定要不要加 location 規則。

- [ ] **Step 4: 在 next.config.js 留下註記**

```js
  // The yaml worker is emitted by webpack from `new Worker(new URL("monaco-yaml/yaml.worker",
  // import.meta.url))` in TextEditor. Both dev and build run with `--webpack`, so this works
  // today. Switching to turbopack needs that worker wired up here as well, otherwise YAML
  // schema validation silently stops producing markers.
  turbopack: {
```

- [ ] **Step 5: Commit**

```bash
git add apps/www/next.config.js
git commit -m "docs(www): note the yaml worker's dependency on the webpack builder"
```

---

## Plan B 完成後的狀態

- 一份 draft-07 schema 驗證四種格式：JSON 與 YAML 行內 marker，XML 與 CSV 在 PaneBar 列出 JSON Pointer 路徑
- 編輯器面板頂部的 bar 有三態驗證狀態燈、schema 入口、格式下拉
- 空編輯器顯示格式引導卡片，不再預載範例
- spec 的第 3、4 塊完成，spec 列出的第八處色碼比對一併修掉

Plan A 與 Plan B 都完成後，spec 的驗收清單 15 項可以全部走一遍。
