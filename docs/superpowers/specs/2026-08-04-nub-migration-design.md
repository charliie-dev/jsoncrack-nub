# 以 nub 取代 bun：fork patch 重建設計

日期：2026-08-04
狀態：待實作
影響範圍：工具鏈、容器化、CI、git 歷史（改寫）

## 目標

把這個 fork 的所有改動從 `upstream/main` 重新疊成 6 個乾淨 commit，並把工具鏈從 bun 換成
[nub](https://nubjs.com/)。fork 原有的三大類改動全部保留：拆除不需要的部分、容器化與自架、
更新 GitHub workflow。

不變更任何一行應用程式原始碼。`apps/www/src` 與 `packages/jsoncrack-react/src` 在改寫前後必須
逐 byte 相同（唯一例外是移除 landing page 與推廣入口，那屬於「拆除」類，本來就在 fork 的
patch 裡）。

## 背景：nub 與 bun 不是同類工具

bun 是 runtime，取代 node。nub 跑在 stock node 上，取代的是 pnpm / npx / corepack / nvm。
這個差異決定了整份設計的形狀：

- production image 完全不受影響，現在就是 nginx 送 Next.js static export
- 只有 builder stage 換掉，base image 從 `oven/bun:1-alpine` 換成 `ghcr.io/nubjs/nub:0.6.0-alpine`
- workspace `--filter` 沿用 pnpm 語法，`package.json#workspaces` 直接可用
- CI 有官方 `nubjs/setup-nub@v0`，`cache: true` 一行取代 `jdx/mise-action` 加兩段手寫 cache

### 實測確認的事實

在 `scratchpad/nub-probe` 用 upstream 的 `pnpm-lock.yaml` 加上 `packageManager: nub@0.6.0`
實測 `nub install --lockfile-only`，得到：

1. nub 確實寫回 `pnpm-lock.yaml`（`lockfileVersion: '9.0'`，652 packages），不會改成別的格式
2. **nub identity 下 `pnpm-workspace.yaml` 不會被讀取**，會噴
   `pnpm-workspace.yaml is not read under nub identity`。此檔必須刪除，workspace globs 改由
   `package.json#workspaces` 提供。官方文件未記載此限制。
3. 因為 fork 刪掉 `apps/vscode` 與 `apps/chrome-extension`，`importers` 從 5 個降到 3 個，
   與 upstream 的 lockfile 差約 4871 行
4. `nub run -r` 預設帶 topological sort。`www` 以 `workspace:*` 依賴 `jsoncrack-react`，
   所以 `-r build` 會自動先建 package 再建 app
5. `ghcr.io/nubjs/nub:0.6.0-alpine` 的 image config 為 `User: node`、`WorkingDir: /app`、
   `NODE_VERSION=26.3.1`、entrypoint `tini -- docker-entrypoint.sh`。實測 `nub --version` 回
   `v0.6.0`、`node --version` 回 `v26.3.1`

### Docker Hardened Images 實測

使用者本機已登入 `dhi.io`（帳號 `nicsdp`）。DHI 的 namespace 在 registry root，不是
`dhi.io/<org>/<image>`：

| repo | tags | 說明 |
|---|---|---|
| `dhi.io/nginx` | 129 | 最新 1.31.3，有 alpine / debian / fips / compat 變體 |
| `dhi.io/node` | 378 | 最新 26.5.1，162 個 alpine 變體 |

以 registry API 取得的 image config：

| image | User | WorkingDir | Entrypoint | ExposedPorts | 壓縮大小 |
|---|---|---|---|---|---|
| `dhi.io/nginx:1.31.3-alpine` | 65532 | `/` | `["nginx"]` | 8080/tcp | 4 MB |
| `dhi.io/nginx:1.31.3-compat` | 65532 | `/` | `["nginx"]` | 8080/tcp | 11 MB |
| `dhi.io/node:26.5.1-alpine` | 1000 | `/app` | null | — | — |
| `dhi.io/node:26.5.1-alpine-dev` | 0 | `/app` | null | — | — |

關鍵契合：`dhi.io/nginx` 原生以 uid 65532 執行且已 `EXPOSE 8080`，完全對應現有的
`nginx.conf` 與 compose 設定，故不再需要 `nginxinc/nginx-unprivileged`。`dhi.io/node` 最終
未採用（見下方 CVE 一節），此處記錄其 config 供日後參考。

**DHI runtime image 無 shell 的顧慮不成立。** 實際 `docker export` 檢查
`dhi.io/nginx:1.31.3-alpine` 的檔案清單，確認含 busybox 提供的 `bin/sh`、`bin/ash`、
`usr/bin/wget`、`usr/bin/nc`。所以 Dockerfile 的 `HEALTHCHECK` 與 compose 的 `CMD-SHELL`
healthcheck 都可正常運作，不需改用較大的 `-compat` 變體（4 MB 對 11 MB）。

### CVE 實測比較（trivy）

五個候選 image 的掃描結果：

| image | CRITICAL | HIGH | MEDIUM | 角色 |
|---|---|---|---|---|
| `dhi.io/nginx:1.31.3-alpine` | 0 | 0 | 0 | production（採用） |
| `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` | 2 | 31 | 46 | production（未採用） |
| `ghcr.io/nubjs/nub:0.6.0-alpine` | 1 | 6 | 10 | builder（採用） |
| `ghcr.io/nubjs/nub:0.6.0-slim` | 5 | 24 | 65 | builder（未採用） |
| `dhi.io/node:26.5.1-debian-dev` | 16 | 28 | 75 | builder（未採用） |

production 選 `dhi.io/nginx:1.31.3-alpine` 毫無疑問：全等級 0 CVE，對照
`nginx-unprivileged` 的 2 CRITICAL 與 31 HIGH。它也原生以 uid 65532 執行、已 `EXPOSE 8080`，
與現有 `nginx.conf` 和 compose 設定完全相符。

**DHI 的 0-CVE 保證只適用 runtime 變體，不含 `-dev`。** 實測對照：

- `dhi.io/node:26.5.1-debian` → 0 CRITICAL / 0 HIGH / 5 MEDIUM
- `dhi.io/node:26.5.1-debian-dev` → 16 CRITICAL / 28 HIGH

那 16 個 CRITICAL 全部來自 perl（`libperl5.40`、`perl`、`perl-base`、`perl-modules-5.40`），
是 `-dev` 變體為帶 build 工具鏈才引入的。builder 無法用 runtime 變體，因為它以 uid 1000 執行
且無 npm，裝不了 nub。

供應鏈證明方面官方 image 反而較完整：`ghcr.io/nubjs/nub` 帶 SLSA provenance 與 Anchore 產的
SPDX SBOM；`dhi.io/node` 以 `docker buildx imagetools inspect` 取到的 Provenance 是空的 `{}`。

builder stage 會被丟棄，其 CVE 不進最終 image，因此選最少 CVE 且最簡單的
`ghcr.io/nubjs/nub:0.6.0-alpine`：nub 已預裝故不需 npm 安裝層，CI 也不需 `dhi.io` 認證，
外部貢獻者能直接 build。

### 已排除的 DHI builder 路徑與踩到的 nub bug

此段記錄已排除方案的實測發現，避免後人重走。若日後改用 DHI 的 node image 作 builder，會踩到
下列兩個問題。

用 `dhi.io/node:26.5.1-alpine-dev` 安裝 nub 後，`nub --version` 失敗：

```
@nubjs/nub: the @nubjs/nub-linux-arm64 package is not installed. Try: npm rebuild @nubjs/nub
```

讀 `@nubjs/nub/platform.js` 的 `isMusl()` 找到根因，這是 nub 的偵測缺陷撞上 DHI 的精簡化：

1. 主要判斷是 `if (header && "glibcVersionRuntime" in header) return !header.glibcVersionRuntime`
2. musl 上這個 key **完全不存在**（實測 `"glibcVersionRuntime" in header` 為 `false`），所以主
   判斷不成立，落到 `ldd --version` fallback
3. DHI image 精簡掉了 `ldd`（實測 `command -v ldd` 找不到），`execSync` 拋錯
4. catch 分支檢查錯誤輸出含不含 `"musl"`，而錯誤是 `ldd: not found`，不含 → 判定為 glibc
5. launcher 於是去找 `@nubjs/nub-linux-arm64`，但 npm 依 `os`/`cpu`/`libc` 過濾並未安裝它

一般 alpine 有 busybox 提供的 `ldd` 所以不會踩到，DHI 精簡後才暴露。手動安裝
`@nubjs/nub-linux-arm64-musl` 無效，因為 launcher 要的是 glibc 那個名字。改用 glibc 的
`dhi.io/node:26.5.1-debian-dev` 可通過（實測 `nub v0.6.0`、`node v26.5.1`）。

第二個問題：**DHI node 預設封鎖 npm install-scripts**，nub 的 `postinstall`（負責為 platform
binary 補上執行位元）不會執行，必須寫成
`npm install -g --allow-scripts=@nubjs/nub @nubjs/nub`。

採用官方 nub image 後這兩個問題都不存在，因為 binary 已預裝、無安裝期腳本。

### 已知風險

- **nub 是 0.6.0，尚未到 1.0。** 這次會把它放進 CI 與 Docker build 的關鍵路徑。使用者已知
  並確認採用。
- **現有 build 從未在 node 上驗證過**，一直是 bun。改用 node 26 後必須完整重跑驗證。
- **Docker 跨 stage COPY 的 symlink layout。** nub 從 `pnpm-lock.yaml` 推導 isolated layout
  （pnpm 式 symlink 進 `node_modules/.pnpm`），跨 stage `COPY` 的相對路徑必須保持有效。
  官方文件要求 multi-stage 用 `nub ci` 而非 `nub install` 正是為此，但需實測。
  fallback：deps stage 改用 `nub install --frozen-lockfile --layout hoisted`，或把 deps 與
  builder 併成單一 stage（犧牲 layer cache）。
- **CI 需要 dhi.io 認證。** production stage 用 `dhi.io/nginx`，因此 `image-publish.yml` 的
  build 需存取 `dhi.io`，必須新增一組 registry 憑證 secret 並在 workflow 加
  `docker/login-action` 步驟（現有的 GHCR login 步驟之外再加一個）。外部貢獻者在沒有該憑證的
  情況下無法 build container image；`pull-request.yml` 的 lint 與 build job 不碰 Docker，
  不受影響。

## 決策記錄

| 決策 | 選擇 | 理由 |
|---|---|---|
| lockfile | 沿用 upstream 的 `pnpm-lock.yaml` | nub 原生讀寫 pnpm v9。upstream 同樣維護此檔，未來 sync 有固定食譜（取 upstream 版後跑一次 `nub install --no-frozen-lockfile`），不會像 `bun.lock` 那樣靜默過期 |
| git 歷史 | 從 `upstream/main` 重寫 6 個 commit | 順便修掉上一輪 review 找到的 4 個問題；`pnpm-lock.yaml` 在歷史中從未被刪除過 |
| mise 定位 | 降級為工具鏈安裝器加 task runner | `[tools]` 只留 `nub = "0.6.0"`，讓新 clone 的人有管道拿到 nub；node 版本由 `.node-version` 提供 |
| 命名 | 全面改成 nub | repo 已改名 `jsoncrack-nub`；`bun-experiments.md` → `nub-experiments.md` |
| base image | builder 用官方 nub image，production 用 DHI | builder `ghcr.io/nubjs/nub:0.6.0-alpine`，production `dhi.io/nginx:1.31.3-alpine`。依 trivy 實測選出，見下方 CVE 一節 |
| compose 結構 | 合併成單一 root `compose.yml`，本地 build | 使用者要求 root compose 指向 `apps/www/Dockerfile`，與 `apps/www/compose.yml` 功能重疊故刪除 |
| node 版本 | 釘到 patch `26.5.1` | 對齊本機 mise 的 26.5.1。Docker 側由 nub 的 node manager 依 `.node-version` 自動補齊（實測確認），三邊落在同一 patch。偏離 upstream CI 的 24.10.0 |

### lockfile 選擇的實際效益

先前曾表述為「未來 sync 可自動 merge」，實測後修正為：

| | 原本（`bun.lock` 且刪除 `pnpm-lock.yaml`） | 改用 `pnpm-lock.yaml` |
|---|---|---|
| 每次 sync upstream | 必定 modify/delete 衝突 | 可能文字衝突 |
| 解法 | 手動判斷保留刪除，再手動想起要更新 lockfile | 固定食譜：取 upstream 版，跑 `nub install --no-frozen-lockfile` |
| 靜默失效 | 會。上一次 rebase 就發生，`bun.lock` 零衝突但整份過期 | 不會。upstream 也在維護同一個檔案 |

## Commit 拓撲

從 `upstream/main`（`3c9af69e`）重新疊 6 個 commit。

```
upstream/main (3c9af69e)
 │
 ├─ 1. chore: remove vscode and chrome-extension apps
 ├─ 2. chore: strip landing page and route index to editor
 ├─ 3. build: adopt nub toolchain
 ├─ 4. feat(container): self-hostable image and compose stack
 ├─ 5. ci: rebuild workflows on nub and add image publishing
 └─ 6. docs: document nub toolchain and self-hosting
```

三大類的落點：commit 1 與 2 是拆除，4 是容器化與自架，5 是 gh workflow。

### Commit 1：移除 vscode 與 chrome-extension

- 刪 `apps/vscode/*`（22 檔）、`apps/chrome-extension/*`（16 檔）
- 刪 `.vscode/launch.json`、`.vscode/tasks.json`
- root `package.json` 移除 `dev:vscode`、`build:vscode`、`lint:vscode`、`lint:fix:vscode`、
  `dev:chrome`、`build:chrome`、`lint:chrome`
- `Navbar.tsx` 移除 VS Code 與 Chrome 按鈕，連帶移除 `VscVscode`、`FaChrome` import
- `Footer.tsx` 移除 VS Code 連結
- `pnpm-lock.yaml` 重新產生，`importers` 由 5 降為 3

### Commit 2：拆掉 landing page

- 刪 `apps/www/src/layout/Landing/` 全部 7 個檔案（FAQ、Features、HeroPreview、HeroSection、
  Section1、Section2、Section3）
- `apps/www/src/pages/index.tsx` 改為 `export { default } from "./editor";`
- `Footer.tsx` 移除 `/#faq` 錨點
- 刪 `.npmrc`

### Commit 3：採用 nub 工具鏈

`package.json` 身份欄位：

```jsonc
"packageManager": "nub@0.6.0",
"devEngines": {
  "packageManager": { "name": "nub", "version": "0.6.0", "onFail": "ignore" },
  "runtime": { "name": "node", "version": "26.5.1" }
},
"workspaces": ["apps/*", "packages/*"]
```

移除 `engines.bun`。新增 `.node-version` 內容為 `26.5.1`（釘到 patch）。

`devEngines.runtime` 必須同樣釘成 exact `26.5.1`，不能寫 `^26`。`setup-nub` 的解析順序是
`devEngines.runtime` → `.node-version` → `.nvmrc` → `.tool-versions` → `engines.node`，
排在最前面的 `devEngines.runtime` 若是範圍就會解析成最新的 26.x，把 `.node-version` 的
exact pin 蓋掉。

Docker 側不需額外處理。`ghcr.io/nubjs/nub:0.6.0-alpine` 內建的是 node 26.3.1，但實測
`nub run` 會依 `.node-version` 自行補齊：

```
--- image 內建 node ---
v26.3.1
--- nub run 看到的 node ---
Using Node.js 26.5.1 (resolved from .node-version)
Installing from nodejs.org...
Installed in 7.0s
v26.5.1
```

所以本機（mise）、CI（setup-nub）、Docker（nub node manager）三邊都落在 26.5.1。代價是
Docker build 首次多約 7 秒下載 node，且 build 過程需連得上 nodejs.org。若要避免這次下載，
可改把 `.node-version` 釘成 image 內建的 26.3.1，但那會讓本機 mise 降版，故不採用。

root scripts 對照：

| script | 舊（bun） | 新（nub） |
|---|---|---|
| `dev` | `bun run --filter jsoncrack-react build && bun run --filter www dev` | `nub run --filter jsoncrack-react build && nub run --filter www dev` |
| `build` | `bun run --filter jsoncrack-react build && bun run --filter www build` | `nub run -r build` |
| `start` | `bun run --filter www start` | `nub run --filter www start` |
| `lint` | `... build && (A & B & wait)` | `nub run --filter jsoncrack-react build && nub run -r lint` |
| `lint:fix` | `A & B & wait` | `nub run -r lint:fix` |
| `test` | `bun run --filter jsoncrack-react test` | `nub run -r --if-present test` |
| `analyze` | `... && ANALYZE=true bun run --filter www build` | `nub run --filter jsoncrack-react build && ANALYZE=true nub run --filter www build` |
| `clean` | `bun run --filter '*' clean` | `nub run -r --if-present clean` |

`lint` 仍需前置的 `--filter jsoncrack-react build`，因為 `www` 的 `tsc` 讀
`jsoncrack-react/dist` 的型別，而 topological order 只保證 `lint` 的執行順序，不會自動先跑
`build`。`--if-present` 是必要的：`www` 沒有 `test` 與 `clean` script。flag 必須放在 script
名稱之前，因為 `[ARGS]...` 會把後續參數轉發給 script。

刪除的檔案：

| 檔案 | 原因 |
|---|---|
| `turbo.json` | 不再使用 turbo |
| `pnpm-workspace.yaml` | 實測 nub identity 下不讀取並發出警告，globs 移進 `package.json#workspaces` |

清掉殘留參照（上一輪 review 的發現）：

- `apps/www/.gitignore` 的 `.turbo/` 與 `pnpm-lock.yaml`
- `apps/www/.dockerignore` 的 `.turbo`
- `packages/jsoncrack-react/.gitignore` 的 `.turbo/`

`mise.toml`：`[tools]` 只留 `nub = "0.6.0"`（`mise registry` 確認有
`nub → npm:@nubjs/nub`）。7 個 `bun run` 轉發任務改成 `nub run`，`bun install` 改成
`nub install`。

`CONTRIBUTING.md` 與 `.github/pull_request_template.md` 的指令改成 `nub`。

### Commit 4：容器化與自架

`apps/www/Dockerfile`：

```dockerfile
# syntax=docker/dockerfile:1.6

FROM --platform=$BUILDPLATFORM ghcr.io/nubjs/nub:0.6.0-alpine AS base

FROM base AS deps
COPY --chown=node:node .node-version package.json pnpm-lock.yaml ./
COPY --chown=node:node apps/www/package.json ./apps/www/package.json
COPY --chown=node:node packages/jsoncrack-react/package.json ./packages/jsoncrack-react/package.json
RUN nub ci

FROM base AS builder
ARG SITE_URL=https://jsoncrack.com
ENV SITE_URL=$SITE_URL
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/apps/www/node_modules ./apps/www/node_modules
COPY --from=deps --chown=node:node /app/packages/jsoncrack-react/node_modules ./packages/jsoncrack-react/node_modules
COPY --chown=node:node . .
RUN nub run build

FROM dhi.io/nginx:1.31.3-alpine AS production
COPY --from=builder --chown=65532:65532 /app/apps/www/out /app
COPY apps/www/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://localhost:8080/ || exit 1
```

不需要 `WORKDIR`：兩個 image 的 `WorkingDir` 都已設定（nub image 為 `/app`）。不需要 `USER`：
builder 的官方 nub image 已是 `node`，`dhi.io/nginx` 原生以 uid 65532 執行。builder 內的
`COPY` 用 `--chown=node:node`，進入 production 的那次改用 `--chown=65532:65532`。

不需要 `apk add libc6-compat` 也不需要 `npm install -g @nubjs/nub`，官方 nub image 已預裝
binary 且處理好 musl 相依。

deps stage 必須把 `.node-version` 一併 `COPY` 進去，否則 `nub ci` 會用 image 內建的 26.3.1，
與 builder stage 實際跑的 26.5.1 不一致。放在依賴定義那一層也讓 node 的下載結果進入同一個
layer cache。

`dhi.io/nginx:1.31.3-alpine` 已宣告 `EXPOSE 8080`，此處重複宣告是為了在 Dockerfile 內明示
契約，不影響行為。

依 `dockerfile-builder` 標準所做的修正：

| 檢查項 | 原況 | 修正 |
|---|---|---|
| 固定版本 tag | `nginx-unprivileged:1-alpine` 為浮動 minor | 改用 `dhi.io/nginx:1.31.3-alpine`，釘到 patch；builder 亦釘 `0.6.0-alpine` |
| `HEALTHCHECK` | Dockerfile 未宣告，僅 compose 有 | 加進 Dockerfile（已確認 DHI nginx 帶 busybox 的 `sh` 與 `wget`） |
| `.dockerignore` | 未排除 `.env` | 兩份都補 `.env`、`.env.*`、`*.pem`、`*.key` |
| 多平台 | `image-publish.yml` 送 amd64+arm64 但 Dockerfile 未宣告 | builder 加 `--platform=$BUILDPLATFORM` |
| rootless | 依賴 `nginx-unprivileged` 的 uid 101 | DHI nginx 原生 uid 65532，且 runtime 無 package manager |

`compose.yml`（單一份，置於 root）：

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json
services:
  jsoncrack:
    build:
      context: .
      dockerfile: apps/www/Dockerfile
      args:
        SITE_URL: ${SITE_URL:-https://jsoncrack.com}
    container_name: jsoncrack
    ports:
      - "${PORT:-8080}:8080"
    restart: unless-stopped
    init: true
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    pids_limit: 100
    tmpfs:
      - /tmp
      - /var/cache/nginx
      - /run
    healthcheck:
      test: ["CMD-SHELL", "wget -qO /dev/null http://localhost:8080/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
# vim: set ft=yaml.docker-compose :
```

`apps/www/compose.yml` 刪除。`mise.toml` 的 `dc:build:up`、`dc:build:rec`、`dc:build:down`
併進 `dc:up`、`dc:rec`、`dc:down`，`dc:*` 任務由 10 個降到 7 個（`mise.toml` 全部任務由 18
降到 15）。`SITE_URL` 現可從 `.env` 帶進 build，這是原本拉預建 image 時做不到的。

不加 `stop_grace_period`：靜態站無狀態，預設 10s 足夠。healthcheck 的 `localhost:8080` 保持
寫死，容器內 port 固定，`${PORT}` 只映射主機側。

其餘原樣保留：`apps/www/nginx.conf` 的 `listen [::]:8080`、`.dockerignore` 兩份、
`.env.example` 兩份、`apps/www/.env`（`NEXT_PUBLIC_NODE_LIMIT=10000` 與
`NEXT_PUBLIC_DISABLE_EXTERNAL_MODE=true`）、`next-sitemap.config.js` 的
`process.env.SITE_URL` fallback。

### Commit 5：CI

`pull-request.yml` 與 `deploy.yml` 的 install 段落：

```yaml
- uses: actions/checkout@v6
- uses: nubjs/setup-nub@v0
  with:
    cache: true
- run: nub ci
- run: nub run lint      # deploy.yml 為 nub run build
```

移除 `jdx/mise-action` 與兩段手寫的依賴 `actions/cache`，由 `setup-nub` 的 `cache: true`
取代。Next.js 的 `.next/cache` 那段保留，`hashFiles('bun.lock')` 改成
`hashFiles('pnpm-lock.yaml')`。

action 版本對齊 upstream，修掉上一輪 review 發現的降版問題：`actions/checkout@v4 → v6`、
`actions/cache@v4 → v5`，`image-publish.yml` 的 `checkout@v4` 一併升級。

`image-publish.yml` 的 image 名稱來自 `IMAGE_NAME: ${{ github.repository }}` 自動推導，
無 hardcode，repo 改名後自動生效，此檔除 action 版本外不需改動。

### Commit 6：文件

`README.md` 全文改成 nub，包含 prerequisites、setup、scripts 對照、Docker 一節（單一 compose
路徑）、環境變數表。`bun-experiments.md` 改名 `nub-experiments.md` 並重寫為 nub 的決策與
實測發現（含前述三項官方文件未記載的行為）。

## 驗證

改寫歷史前先建立新的備份 ref，並保留既有的 `backup-main-08373eb`。

| # | 檢查 | 通過條件 |
|---|---|---|
| 1 | `nub ci` | 從 `pnpm-lock.yaml` 乾淨安裝，無 drift 錯誤 |
| 2 | `nub run -r --if-present test` | 52 tests / 3 files 全過 |
| 3 | `nub run lint` | tsc + eslint + prettier 三者 exit 0 |
| 4 | `nub run build` | static export 加 sitemap 成功 |
| 5 | `docker build -f apps/www/Dockerfile .` | 三個 stage 都過，symlink layout 存活 |
| 6 | `docker compose up -d` 後 curl | `localhost:8080` 實際回傳編輯器頁面 |
| 7 | `mise dc:validate` | `docker compose config --quiet` 通過 |
| 8 | 與目前已 rebase 的 `f89c9db4` 比對 | `apps/www/src` 與 `packages/jsoncrack-react/src` 逐 byte 相同 |
| 9 | `trivy image` 掃最終 image | 不因本次改動引入新的 CRITICAL 或 HIGH |

第 4 項是最大的功能風險：現有 build 從未在 node 上跑過。第 8 項防止改寫歷史時弄髒應用程式碼，
工具鏈遷移不應動到任何一行 app 原始碼。

比對基準必須是 `f89c9db4`（目前已 rebase 的 main），不能用 `backup-main-08373eb`。upstream 那
65 個 commit 動過 `apps/www/src` 與 `packages/jsoncrack-react/src`（79 檔案、+2741/−2324），
拿 rebase 前的備份比對必定不同。`f89c9db4` 與重寫後的 main 都站在同一個 `upstream/main` 上，
才是有效的比較。

驗證全過後才 `git push --force-with-lease origin main`，且需使用者明確同意。

## 非目標

- 不升級 Next.js、React 或其他應用層依賴
- 不改動應用程式功能與 UI
- 不動 `upstream` remote，也不向 upstream 發 PR
- 不改 `packages/jsoncrack-react` 的發佈流程
- 不處理 GHCR 上既有的 `jsoncrack-bun` image 舊 tag
