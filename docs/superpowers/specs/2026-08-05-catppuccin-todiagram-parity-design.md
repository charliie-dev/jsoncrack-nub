# 移植 ToDiagram 的 UI 語言、換上 Catppuccin、補齊 schema 驗證

日期：2026-08-05
狀態：待實作
影響範圍：`apps/www` 的主題與編輯器版面、`packages/jsoncrack-react` 的節點渲染與色票、schema 驗證資料流

## 目標

參考 [ToDiagram](https://todiagram.com/editor) 的介面語言改造這個 fork 的編輯器，配色換成
[Catppuccin](https://github.com/catppuccin/catppuccin)，並讓「貼一份 JSON Schema 驗證目前文件」
這件事在四種輸入格式上都成立。

拆成五塊工作。第 2 與第 5 塊互相耦合，必須同一批驗收，其餘三塊可獨立驗收：

1. **主題收斂**：把散在三層、其中兩層重複的顏色定義收成單一來源，值換成 Catppuccin Mocha 與 Latte
2. **節點視覺**：節點加上彩色 header 條，顏色依 key 名稱從 accent 池取
3. **UI 重組**：新增左側面板頂 bar、canvas 空狀態引導卡片
4. **Schema 驗證**：JSON 沿用現有行內驗證，YAML 用 ajv 加 YAML AST 補上行內驗證，XML 與 CSV 用 ajv
   驗證轉換後的 object
5. **ELK layout**：調校間距與 edge routing 參數，並讓邊從對應的那一列出發而非節點右緣

## 非目標

使用者明確排除，不做：

- AI text-to-diagram
- MCP server
- 一鍵公開分享連結
- 團隊共編
- fuzzy search 掃 key/value/path
- canvas 內即時換整套色盤

範圍判斷後排除，不做：

- **Mermaid 輸入**。工程量最大且與其他三項無關，留待下一輪
- **多文件 tab bar**（ToDiagram 頂部那排 `JSON Untitled ✕ +`）。要引進多檔案狀態管理
- **`Documents` / `Templates` / `Create Document`**。需要後端
- ToDiagram pill toolbar 上的 play 鍵。那是它的 Custom Diagram 執行鍵
- 改動 `fast-xml-parser` 的 `isArray` 設定。會改變現有 XML 畫圖的節點結構，屬破壞性變更

## 現況：四項原始需求裡兩項已經完成

進場前的盤點結果，避免重做：

| 原始需求 | 現況 |
|---|---|
| 匯出 PNG / JPEG / SVG | **已有**。`DownloadModal` 用 `html-to-image` 的 `toPng` / `toJpeg` / `toSvg`，另有複製到剪貼簿 |
| ELK 佈局引擎 | **已在用**，不需換引擎。`reaflow@5.4.1` 內部就是 elkjs，`JSONCrackComponent.tsx:41` 已在傳 `elk.layered.*` 選項。但只有三個參數，沒設 `edgeRouting` 也沒設任何間距；`EdgeData` 只有 `from` / `to`，沒有 port，所以邊從節點右緣出發而不是從對應的列。見架構第 5 節 |
| 輸入 JSON / YAML / XML / CSV | 已有，見 `apps/www/src/lib/utils/jsonAdapter.ts` |
| 底部浮動 pill toolbar | **已有**。`GraphView/Toolbar/index.tsx:53` 的 `StyledToolbarDock` 已是 `bottom: 12px` 加 `translateX(-50%)` 的浮動 pill，`StyledToolbar` 已套 `glassSurface`。按鈕清單與截圖幾乎一致，只差配色 |
| JSON + JSON Schema 驗證 | **已有**。`SchemaModal` 寫入 `useFile.jsonSchema`，`TextEditor.tsx:48` 餵給 Monaco 的 `jsonDefaults.setDiagnosticsOptions`，錯誤以行內 marker 呈現 |
| YAML / XML / CSV 的 schema 驗證 | 缺。`TextEditor.tsx:93` 是 `language={fileType}`，schema 只掛在 json language 上 |
| Catppuccin 配色 | 缺 |
| 節點彩色 header | 缺。目前是單色卡片，key 統一色 |
| 左側面板頂 bar、空狀態引導 | 缺 |

## 決策紀錄

| # | 決策 | 選擇 | 理由 |
|---|---|---|---|
| D1 | Mermaid 範圍 | 這輪不做 | 工程量最大且與其他項無關 |
| D2 | JSON Schema 的用途 | 貼 schema 驗證目前的 JSON / YAML 是否合法 | 使用者修正後的需求，不是把 schema 當畫圖輸入 |
| D3 | UI 改動深度 | 配色加上工具列與面板重組 | |
| D4 | Catppuccin 套法 | Mocha 接 dark，Latte 接 light | 同一組 token 兩組值，亮暗切換與 `PageLayout` 強制 light 的邏輯都不用改 |
| D5 | 色票放哪 | 放 `packages/jsoncrack-react`，`apps/www` 消費 | canvas 是唯一需要 JS 端色值的地方，節點寬度在 `calculateNodeSize.ts` 用 JS 量測 |
| D6 | 節點 header 著色規則 | `hash(key 名稱) % ACCENT_POOL.length` | 同名 key 跨檔案同色，不需額外狀態，與截圖行為一致 |
| D7 | YAML 驗證引擎 | ajv 加 `yaml` 的 AST | 原定 monaco-yaml，實作後證實它與 monaco 0.53+ 不相容，見架構第 4 節。改法仍給行內紅波浪線與行號 |
| D8 | XML / CSV 驗證引擎 | ajv 驗證 `contentToJson` 的產出 | Monaco 對這兩個格式沒有 schema 驗證機制可用 |
| D9 | JSON Schema draft | ajv 只用 draft-07，不裝 `ajv-draft-04` | 實作後修正：draft 支援其實依驗證器而異。Monaco 與 yaml-language-server 都吃 draft-04 起的多個版本，所以 JSON 與 YAML 沒有這個限制；只有 XML 與 CSV 的 ajv 路徑限 draft-07，其他版本回報 `Not checked` |
| D10 | ELK 範圍 | 參數調校加上 row-anchored ports | 邊從對應的列出發是截圖最明顯的視覺特徵，只調參數做不到 |

## 架構

### 1. 主題色票收斂

現況三層，其中兩層是同一組節點色的重複副本：

| 層 | 檔案 | 誰在吃 |
|---|---|---|
| Canvas | `packages/jsoncrack-react/src/theme.ts` | 節點與 grid 的真正色源，由 `theme="dark"｜"light"` prop 選 |
| styled-components | `apps/www/src/constants/theme.ts` | `editor.tsx:151` 依 `darkmodeEnabled` 切 `darkTheme` / `lightTheme`；`widget.tsx:82` 同理；`PageLayout/index.tsx:26` 固定 `lightTheme` |
| Mantine | `_app.tsx` 的 `createTheme` | 元件庫色，目前只定義一組 `brightBlue` |

`constants/theme.ts:20` 的 `nodeColors` 與 package 的 `theme.ts` 定義同一組節點色，而 canvas 實際
上已不吃前者。這份重複必須在這次收掉，否則兩邊色值會漂移。

套件對外開兩個入口。根路徑 `jsoncrack-react` 帶 canvas 元件，`jsoncrack-react/palette` 只有色票、
accent helpers 與節點尺寸，不碰 React 也不碰 renderer。host 端在 server 會執行到的模組
（`_app.tsx`、`constants/*`）一律走後者：從根路徑 import 會讓 Next.js 收集 page data 時把 reaflow
載進 server，`next build` 會在 static export 階段失敗。

**新檔 `packages/jsoncrack-react/src/catppuccin.ts`**

匯出 `mocha` 與 `latte` 兩組完整具名色，使用 Catppuccin 官方名稱：`base`、`mantle`、`crust`、
`surface0` 到 `surface2`、`overlay0` 到 `overlay2`、`text`、`subtext0`、`subtext1`，以及 14 個
accent（`rosewater`、`flamingo`、`pink`、`mauve`、`red`、`maroon`、`peach`、`yellow`、`green`、
`teal`、`sky`、`sapphire`、`blue`、`lavender`）。

另匯出 `ACCENT_POOL`，**單一組色名陣列，兩個 flavor 共用**。名稱相同、值各自取自該 flavor，所以
`hash(key) % ACCENT_POOL.length` 在亮暗切換時結果不變，節點不會整批換色。若改成每個 flavor 一份池
而長度不同，切換主題會讓每個節點的顏色重新洗牌。

14 個 accent 裡排除 5 個，理由是在 header 尺寸下與鄰近色難以分辨，不是對比不足：`rosewater` 與
`flamingo` 讀起來像 `pink`，`maroon` 像 `red`，`sapphire` 像 `sky`；`yellow` 則是 Latte 淺底上最弱
的一色。剩下 9 個：`mauve`、`red`、`peach`、`green`、`teal`、`sky`、`blue`、`lavender`、`pink`。

**改 `packages/jsoncrack-react/src/theme.ts`**

`themes.dark` 從 `mocha` 組出，`themes.light` 從 `latte` 組出。既有 token 名稱全部沿用，所以
`JSONCrackComponent` 與 `nodeStyles.ts` 的取值點不動。新增 header 用的 token。

**改 `apps/www/src/constants/theme.ts`**

`nodeColors` 保留但改由色盤組出。原本以為它是 canvas theme 的重複副本可以直接刪，實際上
`TreeView/Label.tsx` 與 `TreeView/Value.tsx` 在讀 `theme.NODE_COLORS`，而且需要 `PARENT_OBJ` 與
`PARENT_ARR` 這兩個 canvas 沒有的欄位。重疊的 key 刻意解析到 canvas 用的同一組色，讓同一個值在兩
個檢視裡讀起來一致。

色票從 **`jsoncrack-react/palette`** 匯入，不是 package 根路徑。`darkTheme` 與 `lightTheme` 的語意 token 逐一映射
到 mocha 與 latte。`fixedColors` 那批 Discord 色一併映射進色盤：`BLURPLE` 對 `blue`、`CRIMSON` 對
`red`、`ORANGE` 對 `peach`、`SEAGREEN` 對 `green`、`DANGER` 與 `TEXT_DANGER` 對 `red` 與 `maroon`。
不映射的話畫面上會冒出不屬於 Catppuccin 的顏色。

**改 `apps/www/src/pages/_app.tsx`**

Mantine 的 `colors` 需要 10 階陣列，以 Catppuccin accent 為中心生成階梯，`primaryColor` 指向
`mauve`。`Toaster` 的 `toastOptions.style` 目前硬編 `#4D4D4D` 與 `#B9BBBE`，改成 `surface0` 與
`text`。

**十處色碼比對必須一起改掉**

`theme.BACKGROUND_SECONDARY === "#f2f3f5"` 這個判斷式出現十次，換色盤後全部會選錯值：

- `GraphView/index.tsx:33`，節點的 drop-shadow
- `GraphView/Toolbar/index.tsx` 的 `glassSurface` 共五處：背景（28 附近）、邊框（34）、inset 高光
  （39）、近距陰影（44）、遠距陰影（47）
- `GraphView/Toolbar/index.tsx:78`，`StyledToolbar` 的 divider 邊框
- `Toolbar/SearchInput.tsx` 的 `Counter` 兩處。這兩處的紅色 `#dc2626` / `#f87171` 本身也在色盤
  外，改用 `theme.CRIMSON` 與 `theme.INTERACTIVE_NORMAL` 之後連亮暗分支都不需要
- `BottomBar.tsx:71`，pane bar 按鈕的 hover 背景。這一處歸 Plan B，因為它會重寫該檔案

修法是在 theme 物件加一個 `IS_DARK: boolean`，七處直接讀它。不逐處改成 `$dark` prop：五處在共用的
`glassSurface` css helper 裡，加 prop 就得讓每個使用者往下傳。放進 theme 之後也不可能再漂移。

### 2. 節點 header 與 accent

**新檔 `packages/jsoncrack-react/src/utils/accentForKey.ts`**

純函式，輸入 key 名稱字串，回傳 `ACCENT_POOL` 中的一個 accent 名稱。實作為穩定 hash 取模，例如
FNV-1a 或 djb2。要求：同一輸入永遠同一輸出，跨 session 穩定，不依賴任何外部狀態。

**改 `ObjectNode.tsx`、`TextNode.tsx`、`nodeStyles.ts`**

節點頂部加一條 header：

- 高度沿用 `NODE_DIMENSIONS.PARENT_HEIGHT`（36）
- 文字是該節點的 key 名稱，`workspaces[0]` 這類陣列元素用含索引的完整名稱
- **根節點沒有 key 名稱**，header 文字用 `useFile.fileData` 的檔名，沒有檔名時用 `Untitled`。
  截圖裡 ToDiagram 就是這樣。著色用固定的第一個 accent，不進 hash，讓根節點在任何文件裡都是同一色
- 背景是 accent 與 `base` 的低比例混色，文字用 accent 原色。與截圖一致，截圖的
  `author` 是深綠底加亮綠字、`scripts` 是深紫底加亮紫字，不是亮底深字

**混色在 JS 端算成 hex，不用 CSS `color-mix()`。** 節點是用 `<foreignObject>` 渲染 HTML，所以
header 其實可以吃 CSS 色彩函式，這點與最初的判斷不同。改用 JS 的理由是可單元測試，而且同一個色值也
要給沒有元素可讀的程式碼使用，不必依賴瀏覽器對 `color-mix` 的支援差異。混色函式與 `accentForKey`
放在一起。

**改 `packages/jsoncrack-react/src/utils/calculateNodeSize.ts`**

把 header 高度加進節點總高。這個函式的輸出是 ELK layout 的輸入，算漏了節點會直接重疊。這是本次
最容易靜默出錯的地方，必須有單元測試。

### 3. UI 重組

**改造既有的 `BottomBar.tsx`，改名為 `PaneBar.tsx`**

這裡要修正一個原本的誤判：PaneBar 不是新元件。`editor.tsx:167` 把 `BottomBar` 放在 `TextEditor`
之前，而 `StyledTextEditor`（`editor.tsx:60`）是 `flex-direction: column`，所以它顯示在編輯器面板的
**頂部**，還帶著 `border-bottom`。名字是歷史遺留，位置正是 PaneBar 要的位置。

它已經有兩塊要的東西，所以實際工作比原本估的小：

| 內容 | 現在的狀態 | 動作 |
|---|---|---|
| 格式下拉 `JSON ⌄` | `BottomBar.tsx:151-171` 已在這條 bar 的右側 | 不搬，原地保留 |
| Valid / Invalid 狀態 | `BottomBar.tsx:111-132` 已有兩態 | 擴充成四態，加錯誤數 |
| `{ } JSON Schema` 入口 | 藏在 `Toolbar/ToolsMenu.tsx:41-49` 選單內 | 提到這條 bar 當常駐按鈕，並從選單移除，不留兩個入口 |

狀態燈的四態依優先序是 parse 錯誤、schema 不可用、Monaco marker、schema 違規、通過。`error` 併入
狀態燈，不另外顯示。`Popover` 的 position 要從 `top` 改成 `bottom`，因為這條 bar 在面板頂部。

**狀態燈的錯誤數來源**：`TextEditor.tsx:98` 現在是 `onValidate={errors => setError(errors[0]?.message
|| "")}`，只留第一條訊息、丟掉數量。改成同時存下 marker 數與完整清單，`useFile` 新增對應欄位。JSON
與 YAML 的錯誤數都從這裡來，因為兩者都是 Monaco marker。XML 與 CSV 的錯誤數來自 ajv 的結果欄位。

**新元件 `apps/www/src/features/editor/views/GraphView/EmptyState.tsx`**

canvas 中央的引導卡片，在編輯器內容為空時顯示。四張格式卡片（JSON / YAML / XML / CSV），點擊載入
該格式的範例並切換 `format`。下方一條 `Open File`，接現有的 `ImportModal`。

**這是一個行為變更**：`useFile.ts:147` 的 `checkEditorSession` 目前一律把 `defaultJson` 塞進編輯
器，所以編輯器從不為空。要改成在沒有 session storage 內容、也沒有 `?json=` 參數時保持空白。新使用
者第一次進來看到的是空編輯器加中央引導卡片，不是一份能立刻看到圖的範例。已與使用者確認採用此行為。

### 4. Schema 驗證

同一份 `useFile.jsonSchema` 餵給三套驗證器，依當前 `format` 分派：

| 格式 | 驗證器 | 錯誤呈現 |
|---|---|---|
| JSON | Monaco `jsonDefaults`（現有，不動） | 行內 marker，有行號 |
| YAML | ajv 對 `yaml` AST，主執行緒 | 行內 marker，有行號 |
| XML / CSV | ajv 驗證 `contentToJson` 的產出 | PaneBar 錯誤清單，只有 JSON Pointer 路徑 |

**YAML 整合：為什麼不是 monaco-yaml**

原定用 monaco-yaml，實作後證實它在 monaco 0.53 之後完全無法運作。`monaco-worker-manager`
呼叫 `monaco.editor.createWebWorker({ moduleId, label })`，而 monaco 0.53 把這個 API 換成
`createWebWorker({ worker, host?, keepIdleModels? })`，改由呼叫端自備 `Worker`。0.56 因此拿到
一個不認得的 descriptor，警告 `Could not create web worker(s)`，退回主執行緒跑通用 editor
worker，每次 `doValidation` 都回 `Missing requestHandler`。monaco-yaml 宣告 peer
`monaco-editor >=0.36`，這個範圍是錯的。

改成 ajv 加 `yaml` 套件的 AST，全程在主執行緒：

1. `parseDocument(text)` 取得帶 range 的 AST
2. ajv 驗證 `doc.toJS()`
3. 每個 ajv 錯誤的 JSON Pointer 經 `Document.getIn` 反查回 source range
4. `monaco.editor.setModelMarkers` 畫上行內波浪線

兩個容易錯的地方：陣列索引必須轉成數字，否則 AST 查找會 miss；缺少的 required 屬性沒有自己的
節點，range 要往上取最近的祖先而不是丟掉該錯誤。兩者都有單元測試。

（下面這段保留當時的計畫內容，實際未採用。）

裝 `monaco-yaml@5.5.1`，peer 是 `monaco-editor >=0.36`，專案裝 0.56.0。

在 `TextEditor.tsx` 加一個 effect，與現有的 `jsonDefaults` effect 並列：

```ts
configureMonacoYaml(monaco, {
  validate: true,
  enableSchemaRequest: true,
  schemas: [{ uri: "http://example.com/schema.json", fileMatch: ["*"], schema: jsonSchema }],
})
```

`fileMatch: ["*"]` 與現有 JSON 那邊一致，所以同一份 schema 同時掛在兩個 language 上，切換格式就
自動換驗證器，不需要額外狀態。

monaco-yaml 規定同時只能有一個 configured instance。保存回傳的 disposable，schema 變更時呼叫它的
`update()`，不是重複 configure。元件卸載時 `dispose()`。

**ajv 整合**

XML 與 CSV 的驗證掛在 `useFile.setContents` 已有的 `contentToJson` 之後。它已經把兩種格式都轉成
JS object，ajv 直接對該 object 驗證，結果存進 store 供 PaneBar 讀取。

**XML 驗證的是轉換後的 JSON 形狀，不是 XML 本身。** `jsonAdapter.ts:22` 的 parser 設定改變了結構，
schema 必須照這個轉換規則寫：

- `attributeNamePrefix: "$"` 加上 `ignoreAttributes: false`，所以 `<user id="1">` 的屬性變成鍵
  `$id`，schema 要寫 `"$id"` 而不是 `id`
- 單一元素是 object，重複元素才是 array。`<items><item>a</item></items>` 轉出來 `item` 是字串，
  兩個 `<item>` 才變陣列。要同時涵蓋得寫 `oneOf`

現成的 XSD 或對 XML 結構的直覺都套不上去。這條規則寫進 `SchemaModal` 的說明文字，那是使用者貼
schema 的地方。不寫進 `docs.tsx`，同一段話放兩處只會多一份會過期的副本。

CSV 乾淨得多：`csv2json` 產出 array of objects，schema 形狀是
`{ type: "array", items: { type: "object", properties: {...} } }`。

**兩個要接受的不一致**

1. 同一份 schema 在 JSON 模式由 Monaco 自己的驗證實作處理，在 XML / CSV 模式由 ajv 處理。兩者對
   邊緣語意的解讀可能有細微差異，例如 `format` 關鍵字的檢查嚴格度
2. `SchemaModal` 現在的預設範例是 draft-04，要改成 draft-07 並在 modal 內寫明支援範圍。舊的
   draft-04 schema 多數欄位仍能驗證，但 `exclusiveMinimum` 這類語意在兩個 draft 之間不同，不保證
   等價

### 5. ELK layout 調校與 row-anchored ports

#### 5a. 參數調校

`JSONCrackComponent.tsx:41` 現在只有三個參數，沒有 `edgeRouting` 也沒有任何間距設定。要加上的參數
與各自的視覺目標：

| 參數 | 起始值 | 視覺目標 |
|---|---|---|
| `elk.edgeRouting` | `ORTHOGONAL` | 純直角折線並共用垂直通道，不要斜線或曲線 |
| `elk.layered.spacing.nodeNodeBetweenLayers` | `80` | 父子層之間留出足夠的垂直通道空間 |
| `elk.spacing.nodeNode` | `24` | 同層節點垂直間距，緊湊但不貼死 |
| `elk.spacing.edgeEdge` | `12` | 垂直通道裡平行線之間的間隔 |
| `elk.layered.spacing.edgeNodeBetweenLayers` | `16` | 線不貼著節點邊緣走 |
| `elk.layered.crossingMinimization.strategy` | `LAYER_SWEEP` | 減少交叉線 |

保留現有的 `NETWORK_SIMPLEX` 與 `EDGE_LENGTH`。不設 `elk.layered.mergeEdges`，維持預設的 false，
截圖裡同一父節點的多條邊各自獨立不合流。

**表中數值是起始值，不是最終值。** 實作時拿同一份範例 JSON 前後對照逐項調，並在四個
`layoutDirection`（`RIGHT` / `LEFT` / `DOWN` / `UP`）下都確認。`direction` 由 prop 傳入，同一組間距
在垂直方向的觀感會不同。

#### 5b. row-anchored ports

讓邊從對應的那一列右側出發，而不是節點右緣。改動四處：

- **`types.ts`**：`EdgeData` 加 `fromPort`；`NodeData` 加 `ports`
- **`parser.ts`**：建立父節點時，為每個指向子節點的 row 產生一個 port，同時把該 edge 的 `fromPort`
  指向它。目前 edge 在第 31、94、113 行三處被 push，三處都要帶上 port
- **`layoutOptions`**：加 `elk.portConstraints: "FIXED_POS"`。不加的話 ELK 會自行決定 port 位置，
  等於整個 5b 沒有效果
- **node 渲染**：接受 ports 但不畫出可見的 port 圖形

**y 偏移公式與 header 的耦合**：

```
port.y = HEADER_HEIGHT + rowIndex * NODE_DIMENSIONS.ROW_HEIGHT + ROW_HEIGHT / 2
```

`HEADER_HEIGHT` 來自架構第 2 節，兩處必須引用同一個常數。任一邊改了另一邊沒跟上，所有邊會整體偏移
一個 header 的高度，而且不會有任何錯誤訊息。

**要先驗證的假設**：reaflow 鎖在 5.4.1，需確認它把 `NodeData.ports` 與 `EdgeData.fromPort` 交給
ELK 的方式，以及 `elk.portConstraints` 該下在 node 層還是 graph 層。這是本節的第一步。

## 錯誤處理

- **schema 本身不是合法 JSON**：`SchemaModal` 已有 try/catch 加 toast，不動
- **yaml worker 載入失敗要 fail soft**：狀態燈顯示「驗證不可用」的中性狀態，不顯示綠勾，也不讓
  編輯器掛掉。綠勾必須代表真的驗證過了
- **ajv 對 schema 本身編譯失敗**：同上，狀態燈顯示驗證不可用並附編譯錯誤訊息，不阻擋畫圖
- **YAML 語法錯誤**由 monaco 自己的 YAML 語言支援標出，**schema 違規**由這裡的 AST 檢查標出，
  兩者都是 model marker。schema 檢查在文件無法 parse 時不執行，避免在語法錯誤上疊加雜訊
- **XML / CSV parse 失敗**：現有 `useFile.error` 路徑照舊，schema 驗證在 parse 失敗時不執行

## 風險與先行驗證

**風險 1：monaco-yaml 的 worker 與 AMD 載入的 monaco 共存。** 這是實作計畫的第一步，失敗就退回
ajv 方案處理 YAML。

現在的 monaco 由 `@monaco-editor/react` 的 loader 從 `/monaco/vs` 以 AMD 載入
（`TextEditor.tsx:18`），它自己會設 `MonacoEnvironment`。monaco-yaml 需要
`MonacoEnvironment.getWorker` 回傳 bundler 產出的 `monaco-yaml/yaml.worker`。做法是覆寫
`getWorker`，只在 label 是 `yaml` 時回傳 bundled worker，其他 label 落回 AMD 原本的路徑。

**未經驗證的假設**：falsy 回傳能否可靠地落回 AMD 的 `getWorkerUrl`。用最小 spike 先確認：切到
YAML 貼一份違反 schema 的內容，確認出現 marker；同時切回 JSON 確認原本的驗證與自動完成沒壞。

**風險 2：static export 下的 worker chunk。** `new Worker(new URL("monaco-yaml/yaml.worker",
import.meta.url))` 靠 webpack 5 原生支援。dev 與 build script 都帶 `--webpack`，所以走 webpack
不是 turbopack。要驗證 worker chunk 正確輸出到 `out/_next/static/` 且 nginx 能供應。
`next.config.js` 的 `turbopack.resolveAlias` 日後改用 turbopack 時需另外處理，在檔案裡留註記。

**風險 3：`calculateNodeSize` 漏算 header 高度導致節點重疊。** 靜默失敗，只在視覺上看得出來。用
單元測試守住。

**風險 4：port 的 y 偏移與 header 高度不同步。** 同樣靜默失敗，所有邊整體偏移一個 header 的高度。
兩處引用同一個常數，並用單元測試斷言公式。

**風險 5：reaflow 5.4.1 對 ports 的支援程度未經驗證。** 若它不把 `fromPort` 交給 ELK，或
`portConstraints` 下錯層級，5b 會完全沒有效果卻不報錯。實作第一步先用一個兩層的最小 JSON 確認邊的
起點真的落在該列高度上，再往下做。失敗就把 5b 退成後續 slice，5a 仍可獨立交付。

## 測試

`apps/www` 沒有測試框架，`package.json` 只有 `lint`（tsc 加 eslint 加 prettier），沒有 test
script。這次不建立，範圍會失控。

- **`packages/jsoncrack-react` 有 vitest**，加兩組單元測試到現有的 `src/__tests__/`：
  - `accentForKey`：同輸入同輸出、輸出必在 `ACCENT_POOL` 內、不同 key 有合理分散
  - `calculateNodeSize`：header 高度計入總高，含 object 節點與 text 節點兩種
  - `parser.ts` 的 port 產生：每個指向子節點的 row 都有對應 port、`fromPort` 與 port id 對得上、
    y 偏移符合公式且含 header 高度
- **`apps/www` 靠手動驗收清單**，見下節

## 驗收清單

1. Mocha 與 Latte 兩個 flavor 都能切換，editor 與 widget 兩頁都正確
2. landing、docs、legal 三類頁面仍強制 light，且是 Latte 而非舊的 light 值
3. 三處色碼比對改掉後，暗色下節點陰影、pill 陰影、divider 邊框都是深色側的值
4. 節點 header 顯示 key 名稱，同名 key 同色，色來自 `ACCENT_POOL`
5. 節點不重疊，含深層嵌套與長 key 名稱
6. 邊是直角折線，從對應的那一列右側出發，起點高度與該列對齊
7. 四個 `layoutDirection` 下間距與 edge routing 都可接受，節點與邊不重疊
8. PaneBar 的格式下拉能切換四種格式，`BottomBar` 不再重複顯示格式與錯誤
9. PaneBar 的 JSON Schema 按鈕能開 `SchemaModal`
10. 空編輯器顯示四張格式卡片與 `Open File`，點卡片載入範例並切格式
11. 貼一份 draft-07 schema 後：JSON 與 YAML 出現行內 marker；XML 與 CSV 在 PaneBar 出現帶 JSON
    Pointer 路徑的錯誤清單
12. 狀態燈：通過顯示綠勾，失敗顯示紅叉加錯誤數，worker 或 ajv 不可用顯示中性狀態
13. `nub run -r lint` 全通過
14. `nub run -r --if-present test` 全通過
15. `docker build` 後容器內 YAML 驗證仍可用，確認 worker chunk 有被 nginx 供應
