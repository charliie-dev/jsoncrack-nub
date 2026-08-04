# nub Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite this fork's patch set from `upstream/main` into six clean commits, swapping the toolchain from bun to nub while preserving the three change categories (removals, containerisation/self-hosting, GitHub workflows).

**Architecture:** Start a fresh branch at `upstream/main` (`3c9af69e`) and build six commits forward. nub runs on stock Node and reads/writes `pnpm-lock.yaml` natively, so upstream's lockfile is kept and maintained rather than deleted — this is the main structural difference from the bun-era history. Docker builds on the official `ghcr.io/nubjs/nub:0.6.0-alpine` image and serves the static export from `dhi.io/nginx:1.31.3-alpine`.

**Tech Stack:** nub 0.6.0 (package manager + script runner + Node manager), Node 26.5.1, mise (tool install + Docker task runner), Next.js 16 static export, nginx, Docker Compose, GitHub Actions.

**Design doc:** `docs/superpowers/specs/2026-08-04-nub-migration-design.md` (commit `1e1c3ff7`)

## Global Constraints

- Base branch point: `upstream/main` at `3c9af69e`. Every commit in this plan stacks on it in order.
- `pnpm-lock.yaml` MUST exist and be tracked in every commit. It is never deleted at any point in the history.
- `bun.lock` MUST NOT be created at any point.
- `packageManager` is exactly `nub@0.6.0`.
- `devEngines.packageManager` version is exactly `0.6.0` (not a range).
- `devEngines.runtime` version is exactly `26.5.1` (not `^26` — a range would override `.node-version` in `setup-nub`'s resolution order).
- `.node-version` content is exactly `26.5.1`.
- Builder base image is exactly `ghcr.io/nubjs/nub:0.6.0-alpine`.
- Production base image is exactly `dhi.io/nginx:1.31.3-alpine`.
- GitHub Actions versions: `actions/checkout@v6`, `actions/cache@v5`, `nubjs/setup-nub@v0`. Never downgrade below these.
- Application source under `apps/www/src/` and `packages/jsoncrack-react/src/` MUST NOT be modified except for the specific edits named in Tasks 1 and 2 (Navbar, Footer, index.tsx, Landing deletions).
- Never run `bun` anything. Never add `pnpm-workspace.yaml` back.
- Commit messages follow Conventional Commits: `<type>(<scope>): <subject>`, subject lowercase, no trailing period, body wrapped at 100 columns.

---

## File Structure

**Deleted (Tasks 1–3):**
- `apps/vscode/` — entire directory (22 files)
- `apps/chrome-extension/` — entire directory (16 files)
- `.vscode/launch.json`, `.vscode/tasks.json` — IDE config
- `apps/www/src/layout/Landing/` — 7 landing-page section components
- `.npmrc`, `turbo.json`, `pnpm-workspace.yaml`

**Created:**
- `.node-version` — single source of the Node patch version for mise, `setup-nub`, and nub's in-container Node manager
- `mise.toml` — installs nub; wraps `nub run` shortcuts and Docker Compose lifecycle tasks
- `compose.yml` — the only Compose file; builds from `apps/www/Dockerfile`
- `.env.example` (root) — Compose interpolation variables
- `apps/www/.env.example` — app build/runtime variables
- `.dockerignore`, `apps/www/.dockerignore` — build-context exclusions
- `apps/www/Dockerfile` — three-stage build (deps → builder → production)
- `apps/www/nginx.conf` — static-export routing, IPv4 + IPv6
- `.github/workflows/image-publish.yml` — multi-arch GHCR publish with provenance
- `nub-experiments.md` — toolchain decisions and empirical findings

**Modified:**
- `package.json` — workspace declaration, nub identity, script rewrite
- `apps/www/package.json` — remove pnpm `packageManager` field
- `apps/www/src/layout/PageLayout/Navbar.tsx` — drop VS Code + Chrome buttons
- `apps/www/src/layout/PageLayout/Footer.tsx` — drop VS Code link + FAQ anchor
- `apps/www/src/pages/index.tsx` — re-export the editor instead of the landing page
- `apps/www/next.config.js` — disable production source maps
- `apps/www/next-sitemap.config.js` — read `SITE_URL` from the environment
- `.gitignore`, `apps/www/.gitignore`, `packages/jsoncrack-react/.gitignore` — drop turbo/pnpm entries
- `.github/workflows/deploy.yml`, `.github/workflows/pull-request.yml` — nub + `setup-nub`
- `.github/pull_request_template.md`, `CONTRIBUTING.md`, `README.md` — nub commands

---

## Task 0: Set up the rewrite branch

**Files:**
- No file edits. Git plumbing only.

**Interfaces:**
- Produces: branch `nub-migration` positioned at `3c9af69e`; backup refs `backup-bun-main` (at `f89c9db4`) and the pre-existing `backup-main-08373eb`; verification baseline ref `baseline-rebased-main`.

- [ ] **Step 1: Confirm the working tree is clean and record the current HEAD**

```bash
cd /Users/charles/Work/jsoncrack-bun
git status --short
git rev-parse --short HEAD
```

Expected: no output from `git status --short`; HEAD is `1e1c3ff7` (the spec commit).

If `git status --short` prints anything, stop and report — do not proceed with uncommitted changes.

- [ ] **Step 2: Create backup and baseline refs**

```bash
git branch backup-bun-main f89c9db4
git branch baseline-rebased-main f89c9db4
git branch --list 'backup*' 'baseline*'
```

Expected: `backup-bun-main`, `backup-main-08373eb`, and `baseline-rebased-main` all listed.

`f89c9db4` is the bun-era `main` already rebased onto `upstream/main`. It is the correct comparison baseline for Task 10 because it shares the same upstream base as the new history.

- [ ] **Step 3: Verify the spec commit is reachable from a backup**

```bash
git merge-base --is-ancestor 1e1c3ff7 backup-bun-main && echo "spec on backup" || echo "spec NOT on backup"
```

Expected: `spec NOT on backup` — the spec commit sits after `f89c9db4`, so cherry-pick it forward in Step 4 rather than losing it.

- [ ] **Step 4: Create the rewrite branch at the upstream base and carry the spec forward**

```bash
git fetch upstream --quiet
git switch --create nub-migration 3c9af69e
git cherry-pick 1e1c3ff7
git log --oneline -2
```

Expected: two commits — the cherry-picked `docs(spec): ...` on top of `3c9af69e feat: support shift wheel horizontal pan (#595)`.

- [ ] **Step 5: Confirm the baseline inventory**

```bash
git ls-files pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc
git ls-tree --name-only HEAD apps/
```

Expected: all four files listed; `apps/` contains `chrome-extension`, `vscode`, `www`.

This is the starting state every later task assumes: upstream's pnpm/turbo setup fully present.

- [ ] **Step 6: Commit**

Nothing to commit — Step 4 already produced the cherry-picked commit. Verify cleanliness:

```bash
git status --short
```

Expected: no output.

---

## Task 1: Remove the vscode and chrome-extension apps

**Files:**
- Delete: `apps/vscode/` (entire directory), `apps/chrome-extension/` (entire directory), `.vscode/launch.json`, `.vscode/tasks.json`
- Modify: `package.json` (remove 7 extension scripts), `apps/www/src/layout/PageLayout/Navbar.tsx`, `apps/www/src/layout/PageLayout/Footer.tsx`
- Regenerate: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: branch `nub-migration` from Task 0.
- Produces: a two-workspace repo (`apps/www`, `packages/jsoncrack-react`); `pnpm-lock.yaml` with exactly three `importers` keys (`.`, `apps/www`, `packages/jsoncrack-react`).

- [ ] **Step 1: Write the failing check**

This task's deliverable is structural, so the test is a shell assertion script rather than a unit test. Create `/tmp/check-task1.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "PASS: $1"
  else
    echo "FAIL: $1"
    fail=1
  fi
}

check "apps/vscode is gone"            '! test -e apps/vscode'
check "apps/chrome-extension is gone"  '! test -e apps/chrome-extension'
check ".vscode/launch.json is gone"    '! test -e .vscode/launch.json'
check ".vscode/tasks.json is gone"     '! test -e .vscode/tasks.json'
check "no vscode scripts in root pkg"  '! grep -q "vscode\|chrome" package.json'
check "Navbar has no VscVscode"        '! grep -q "VscVscode" apps/www/src/layout/PageLayout/Navbar.tsx'
check "Navbar has no FaChrome"         '! grep -q "FaChrome" apps/www/src/layout/PageLayout/Navbar.tsx'
check "Footer has no VS Code link"     '! grep -q "jsoncrack-vscode" apps/www/src/layout/PageLayout/Footer.tsx'
check "pnpm-lock.yaml still tracked"   'git ls-files --error-unmatch pnpm-lock.yaml'
check "lockfile has 3 importers"       'test "$(yq -r ".importers | keys | length" pnpm-lock.yaml)" = "3"'

exit $fail
```

```bash
chmod +x /tmp/check-task1.sh
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
cd /Users/charles/Work/jsoncrack-bun && /tmp/check-task1.sh
```

Expected: FAIL lines for every check except `pnpm-lock.yaml still tracked`. Exit code 1.

- [ ] **Step 3: Delete the extension apps and IDE config**

```bash
git rm -r --quiet apps/vscode apps/chrome-extension
git rm --quiet .vscode/launch.json .vscode/tasks.json
git status --short | head -5
```

- [ ] **Step 4: Remove the extension scripts from the root package.json**

Replace the `scripts` and `devDependencies` blocks in `package.json`. The full file after this edit:

```json
{
  "name": "jsoncrack-monorepo",
  "private": true,
  "license": "Apache-2.0",
  "homepage": "https://jsoncrack.com",
  "author": {
    "name": "Aykut Saraç",
    "email": "aykutsarac0@gmail.com"
  },
  "bugs": {
    "url": "https://github.com/AykutSarac/jsoncrack.com/issues"
  },
  "scripts": {
    "dev": "turbo run dev",
    "dev:www": "turbo run dev --filter=www",
    "build": "turbo run build",
    "build:www": "turbo run build --filter=www",
    "start": "turbo run start",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "test": "turbo run test",
    "analyze": "turbo run analyze",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.8.20"
  },
  "engines": {
    "node": ">=24",
    "pnpm": ">=10"
  },
  "packageManager": "pnpm@10.20.0",
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild",
      "sharp",
      "unrs-resolver"
    ],
    "overrides": {
      "html-to-image": "1.11.11"
    }
  }
}
```

Note this commit still uses turbo and pnpm — Task 3 does the toolchain swap. Keeping the two concerns in separate commits is what makes each commit message honest. `@vscode/vsce-sign` and `keytar` are dropped from `onlyBuiltDependencies` because only the vscode extension needed them.

- [ ] **Step 5: Remove the VS Code and Chrome buttons from Navbar.tsx**

In `apps/www/src/layout/PageLayout/Navbar.tsx`, delete these two `<Button>` elements from inside `<Center>` (they are the first two children):

```tsx
          <Button
            component="a"
            href="https://marketplace.visualstudio.com/items?itemName=AykutSarac.jsoncrack-vscode"
            target="_blank"
            variant="subtle"
            color="black"
            size="md"
            radius="md"
            rel="noopener"
            leftSection={<VscVscode size={16} />}
          >
            VS Code
          </Button>
          <Button
            component="a"
            href="https://chromewebstore.google.com/detail/json-crack/hbaeglefdflnhodchjiaphmheaojikhh"
            target="_blank"
            variant="subtle"
            color="black"
            size="md"
            radius="md"
            rel="noopener"
            leftSection={<FaChrome size={16} />}
          >
            Chrome
          </Button>
```

After deletion, `<Center>` starts directly with the `Embed` button (`component={Link} ... href="/docs"`).

Then delete these two now-unused imports from the top of the file:

```tsx
import { FaChrome } from "react-icons/fa";
import { VscVscode } from "react-icons/vsc";
```

The import block afterwards is exactly:

```tsx
import React from "react";
import Link from "next/link";
import { Button } from "@mantine/core";
import styled from "styled-components";
import { JSONCrackLogo } from "../JSONCrackBrandLogo";
```

- [ ] **Step 6: Remove the VS Code link from Footer.tsx**

In `apps/www/src/layout/PageLayout/Footer.tsx`, delete this `<Anchor>` from the `Product` stack:

```tsx
            <Anchor
              fz="sm"
              c="gray.5"
              href="https://marketplace.visualstudio.com/items?itemName=AykutSarac.jsoncrack-vscode"
              rel="noopener"
            >
              VS Code
            </Anchor>
```

Leave the `/#faq` anchor alone — Task 2 removes that one, because it only becomes dead when the landing page goes.

- [ ] **Step 7: Regenerate the lockfile**

```bash
nub install --lockfile-only --no-frozen-lockfile
yq -r '.importers | keys' pnpm-lock.yaml
```

Expected: exactly three keys — `.`, `apps/www`, `packages/jsoncrack-react`.

`nub install` is safe to run here even though `package.json` still says `packageManager: pnpm@10.20.0`: nub detects the incumbent from the lockfile and writes pnpm v9 format back.

- [ ] **Step 8: Run the check to verify it passes**

```bash
/tmp/check-task1.sh
```

Expected: all 10 lines PASS. Exit code 0.

- [ ] **Step 9: Verify no dangling references to the deleted apps**

```bash
git grep -n -E 'apps/vscode|chrome-extension|jsoncrack-vscode' -- ':!pnpm-lock.yaml' ':!docs/' || echo "no dangling refs"
```

Expected: `no dangling refs`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: remove vscode and chrome-extension apps

Drop both browser/editor extension workspaces and the IDE launch config that only
served them. The www app keeps its VS Code and Chrome promo buttons out of the navbar
and footer since the extensions they linked to are no longer part of this fork."
```

---

## Task 2: Strip the landing page and route index to the editor

**Files:**
- Delete: `apps/www/src/layout/Landing/FAQ.tsx`, `Features.tsx`, `HeroPreview.tsx`, `HeroSection.tsx`, `Section1.tsx`, `Section2.tsx`, `Section3.tsx`, and `.npmrc`
- Modify: `apps/www/src/pages/index.tsx`, `apps/www/src/layout/PageLayout/Footer.tsx`

**Interfaces:**
- Consumes: the two-workspace repo from Task 1.
- Produces: `/` serves the editor; no `apps/www/src/layout/Landing/` directory.

- [ ] **Step 1: Write the failing check**

Create `/tmp/check-task2.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "PASS: $1"
  else
    echo "FAIL: $1"
    fail=1
  fi
}

check "Landing dir is gone"       '! test -e apps/www/src/layout/Landing'
check ".npmrc is gone"            '! test -e .npmrc'
check "index re-exports editor"   'grep -qx "export { default } from \"./editor\";" apps/www/src/pages/index.tsx'
check "Footer has no faq anchor"  '! grep -q "/#faq" apps/www/src/layout/PageLayout/Footer.tsx'
check "no Landing imports left"   '! git grep -q "layout/Landing" -- apps/www/src'
check "pnpm-lock.yaml tracked"    'git ls-files --error-unmatch pnpm-lock.yaml'

exit $fail
```

```bash
chmod +x /tmp/check-task2.sh
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
cd /Users/charles/Work/jsoncrack-bun && /tmp/check-task2.sh
```

Expected: FAIL for the first five checks, PASS for `pnpm-lock.yaml tracked`. Exit code 1.

- [ ] **Step 3: Replace index.tsx with an editor re-export**

Overwrite `apps/www/src/pages/index.tsx` with exactly one line:

```tsx
export { default } from "./editor";
```

This drops the `getStaticProps` that fetched the GitHub star count, so the build no longer makes a network call to `api.github.com`.

- [ ] **Step 4: Delete the landing page components and .npmrc**

```bash
git rm -r --quiet apps/www/src/layout/Landing
git rm --quiet .npmrc
```

`.npmrc` goes here rather than in Task 3 because it is upstream's pnpm-specific registry config with no nub equivalent, and removing it is part of shedding unused upstream scaffolding.

- [ ] **Step 5: Remove the FAQ anchor from Footer.tsx**

In `apps/www/src/layout/PageLayout/Footer.tsx`, delete this `<Anchor>` from the `Resources` stack:

```tsx
            <Anchor component={Link} prefetch={false} fz="sm" c="gray.5" href="/#faq">
              FAQ
            </Anchor>
```

The `Resources` stack afterwards contains only the `Docs` anchor. `Link` is still used by that anchor, so leave the `next/link` import in place.

- [ ] **Step 6: Run the check to verify it passes**

```bash
/tmp/check-task2.sh
```

Expected: all 6 lines PASS. Exit code 0.

- [ ] **Step 7: Verify nothing still imports the deleted components**

```bash
git grep -n -E 'FAQ|Features|HeroPreview|HeroSection|Section[123]' -- apps/www/src || echo "no dangling imports"
```

Expected: `no dangling imports`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: strip landing page and route index to editor

This fork is deployed as a self-hosted editor, so the marketing landing page and its
seven section components have no audience. The index route now re-exports the editor
directly, which also removes the build-time GitHub API call for the star count."
```

---

## Task 3: Adopt the nub toolchain

**Files:**
- Create: `.node-version`, `mise.toml`
- Delete: `turbo.json`, `pnpm-workspace.yaml`
- Modify: `package.json`, `apps/www/package.json`, `.gitignore`, `apps/www/.gitignore`, `packages/jsoncrack-react/.gitignore`, `CONTRIBUTING.md`, `.github/pull_request_template.md`

**Interfaces:**
- Consumes: the stripped repo from Task 2.
- Produces: root scripts `dev`, `build`, `start`, `lint`, `lint:fix`, `test`, `analyze`, `clean`, all driven by `nub run`; mise tasks of the same names plus `install`; `pnpm-lock.yaml` regenerated under nub identity.

- [ ] **Step 1: Write the failing check**

Create `/tmp/check-task3.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "PASS: $1"
  else
    echo "FAIL: $1"
    fail=1
  fi
}

check "turbo.json gone"            '! test -e turbo.json'
check "pnpm-workspace.yaml gone"   '! test -e pnpm-workspace.yaml'
check "no bun.lock"                '! test -e bun.lock'
check "pnpm-lock.yaml tracked"     'git ls-files --error-unmatch pnpm-lock.yaml'
check ".node-version is 26.5.1"    'test "$(cat .node-version)" = "26.5.1"'
check "packageManager is nub"      'test "$(jq -r .packageManager package.json)" = "nub@0.6.0"'
check "devEngines pm exact"        'test "$(jq -r .devEngines.packageManager.version package.json)" = "0.6.0"'
check "devEngines runtime exact"   'test "$(jq -r .devEngines.runtime.version package.json)" = "26.5.1"'
check "workspaces declared"        'test "$(jq -r ".workspaces | join(\",\")" package.json)" = "apps/*,packages/*"'
check "no turbo in scripts"        '! jq -r ".scripts | values[]" package.json | grep -q turbo'
check "no bun in scripts"          '! jq -r ".scripts | values[]" package.json | grep -q bun'
check "www pkg has no pnpm field"  '! jq -e .packageManager apps/www/package.json'
check "no .turbo in ignores"       '! git grep -q "\.turbo" -- "*.gitignore" "*.dockerignore"'
check "mise installs nub"          'grep -q "^nub = \"0.6.0\"" mise.toml'
check "no bun in mise"             '! grep -q bun mise.toml'

exit $fail
```

```bash
chmod +x /tmp/check-task3.sh
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
cd /Users/charles/Work/jsoncrack-bun && /tmp/check-task3.sh
```

Expected: FAIL for most checks; PASS for `no bun.lock`, `pnpm-lock.yaml tracked`, `www pkg has no pnpm field` is expected to FAIL (upstream sets it). Exit code 1.

- [ ] **Step 3: Create .node-version**

```bash
printf '26.5.1\n' > .node-version
cat .node-version
```

Expected: `26.5.1`.

This single file feeds three consumers: mise locally, `nubjs/setup-nub` in CI, and nub's Node manager inside the Docker build.

- [ ] **Step 4: Rewrite the root package.json**

Overwrite `package.json` with exactly:

```json
{
  "name": "jsoncrack-monorepo",
  "private": true,
  "license": "Apache-2.0",
  "homepage": "https://jsoncrack.com",
  "author": {
    "name": "Aykut Saraç",
    "email": "aykutsarac0@gmail.com"
  },
  "bugs": {
    "url": "https://github.com/AykutSarac/jsoncrack.com/issues"
  },
  "scripts": {
    "dev": "nub run --filter jsoncrack-react build && nub run --filter www dev",
    "build": "nub run -r build",
    "start": "nub run --filter www start",
    "lint": "nub run --filter jsoncrack-react build && nub run -r lint",
    "lint:fix": "nub run -r lint:fix",
    "test": "nub run -r --if-present test",
    "analyze": "nub run --filter jsoncrack-react build && ANALYZE=true nub run --filter www build",
    "clean": "nub run -r --if-present clean"
  },
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "nub@0.6.0",
  "devEngines": {
    "packageManager": { "name": "nub", "version": "0.6.0", "onFail": "ignore" },
    "runtime": { "name": "node", "version": "26.5.1" }
  },
  "overrides": {
    "html-to-image": "1.11.11"
  }
}
```

Four things to understand about these scripts:

1. `nub run -r build` needs no explicit ordering — `www` depends on `jsoncrack-react` via `workspace:*`, and `-r` sorts topologically.
2. `lint` still needs the explicit `--filter jsoncrack-react build` first, because `www`'s `tsc` reads `jsoncrack-react/dist` for types. Topological order governs the order `lint` runs in, not whether `build` ran at all.
3. `--if-present` is required on `test` and `clean` because `www` has neither script.
4. Flags go before the script name. `nub run` forwards everything after the script name to the script itself, so `nub run test -r` would pass `-r` to vitest.

`onlyBuiltDependencies` is dropped: it is a pnpm-specific key with no nub equivalent. `engines` is dropped in favour of `devEngines`.

- [ ] **Step 5: Remove the pnpm packageManager field from apps/www/package.json**

Delete this line from `apps/www/package.json` (it is the last property, so also remove the trailing comma from the line before it):

```json
  "packageManager": "pnpm@10.20.0"
```

The `devDependencies` block's closing `}` becomes the last entry before the file's final `}`.

- [ ] **Step 6: Delete turbo.json and pnpm-workspace.yaml**

```bash
git rm --quiet turbo.json pnpm-workspace.yaml
```

`pnpm-workspace.yaml` must go: under nub identity it is not read and nub prints
`pnpm-workspace.yaml is not read under nub identity — migrate it (nub pm use nub), delete it, or return to pnpm (nub pm use pnpm)`. Its `packages:` globs are now in `package.json#workspaces`.

- [ ] **Step 7: Remove turbo and pnpm entries from the three ignore files**

In `.gitignore`, delete these lines:

```
.pnpm-store/
pnpm-debug.log*
```

and this whole block:

```
# Turborepo
.turbo/
```

In `apps/www/.gitignore`, delete the `.turbo/` line and the `pnpm-lock.yaml` line. The `pnpm-lock.yaml` entry is actively harmful now — the root lockfile is tracked, and an ignore rule naming it invites confusion.

In `packages/jsoncrack-react/.gitignore`, delete the `.turbo/` line.

- [ ] **Step 8: Create mise.toml**

```toml
[tools]
nub = "0.6.0"

[tasks.install]
description = "Install dependencies"
run = "nub install"

[tasks.dev]
description = "Start development server"
run = "nub run dev"

[tasks.build]
description = "Build all packages"
run = "nub run build"

[tasks.start]
description = "Start production server"
run = "nub run start"

[tasks.lint]
description = "Run linting"
run = "nub run lint"

[tasks."lint:fix"]
description = "Fix lint issues"
run = "nub run lint:fix"

[tasks.test]
description = "Run tests"
run = "nub run test"

[tasks.analyze]
description = "Build with bundle analyzer"
run = "nub run analyze"

[tasks.clean]
description = "Clean build outputs"
run = "nub run clean"

[tasks."dc:validate"]
description = "Validate compose config"
run = '''
#!/usr/bin/env bash
set -euo pipefail
echo "Validating compose.yml..."
docker compose config --quiet
echo "Compose config OK"
'''

[tasks."dc:up"]
description = "Build from source and start"
run = '''
#!/usr/bin/env bash
set -euo pipefail
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi
docker compose up -d --build
'''

[tasks."dc:rec"]
description = "Rebuild and recreate containers"
run = "docker compose up -d --build --force-recreate --remove-orphans"

[tasks."dc:down"]
description = "Stop and remove containers"
run = "docker compose down -v --remove-orphans"

[tasks."dc:status"]
description = "Show container status"
run = 'docker compose ps --format "table {{.Name}}\t{{.Status}}"'

[tasks."dc:logs"]
description = "Tail container logs"
run = "docker compose logs -f"

[tasks."dc:prune"]
description = "Nuclear cleanup: containers, images"
run = '''
#!/usr/bin/env bash
set -euo pipefail
docker compose down -v --remove-orphans 2>/dev/null || true
docker compose down --rmi all 2>/dev/null || true
'''
```

`[tools]` lists only nub — mise reads `.node-version` for Node on its own, so declaring node here would duplicate the pin. The `dc:build:*` variants from the bun era are gone: there is now a single `compose.yml` that builds from source, so `dc:up` covers what `dc:build:up` used to.

- [ ] **Step 9: Update CONTRIBUTING.md**

Replace the prerequisites and setup command references. Find every `pnpm` or `Bun` mention and convert:

| Old | New |
|---|---|
| `- Bun (>=1.2)` or `- Node.js` / `- pnpm` prerequisite lines | `- [mise](https://mise.jdx.dev/) (recommended) — installs the pinned nub and Node versions`<br>`- Or [nub](https://nubjs.com/) >= 0.6 and Node.js 26.5.1 installed manually` |
| `pnpm install` | `nub install` |
| `pnpm dev` / `bun run dev` | `nub run dev` |
| `pnpm lint` / `bun run lint` | `nub run lint` |
| `pnpm build` / `bun run build` | `nub run build` |

Verify no stale references remain:

```bash
grep -n -i -E 'pnpm|bun|turbo' CONTRIBUTING.md || echo "clean"
```

Expected: `clean`.

- [ ] **Step 10: Update the pull request template**

In `.github/pull_request_template.md`, change the testing checklist line:

```diff
-- [ ] Tested locally with `pnpm dev`
+- [ ] Tested locally with `nub run dev`
```

- [ ] **Step 11: Regenerate the lockfile under nub identity**

```bash
nub install --no-frozen-lockfile 2>&1 | tail -5
head -1 pnpm-lock.yaml
yq -r '.importers | keys' pnpm-lock.yaml
```

Expected: `lockfileVersion: '9.0'`; three importers. No `pnpm-workspace.yaml is not read` warning, because Step 6 deleted it.

- [ ] **Step 12: Run the check to verify it passes**

```bash
/tmp/check-task3.sh
```

Expected: all 15 lines PASS. Exit code 0.

- [ ] **Step 13: Verify the toolchain actually works**

```bash
nub run -r --if-present test 2>&1 | tail -8
```

Expected: `Test Files  3 passed (3)` and `Tests  52 passed (52)`.

```bash
nub run lint 2>&1 | tail -6
```

Expected: prettier reports `All matched files use Prettier code style!` for both workspaces, exit 0.

```bash
nub run build 2>&1 | tail -6
```

Expected: the Next.js static export completes and `next-sitemap` reports `Generation completed`.

This is the first time this repo's build has run on Node rather than bun. If any of the three fails, stop and report the failure output rather than working around it.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "build: adopt nub toolchain

Replace pnpm and Turborepo with nub, which runs on stock Node and reads and writes
pnpm-lock.yaml natively. Keeping upstream's lockfile format means future upstream syncs
can merge the lockfile instead of hitting a modify/delete conflict on every pull.

Workspace globs move from pnpm-workspace.yaml into package.json#workspaces because nub
does not read the former under its own identity. Recursive scripts rely on nub's
topological ordering rather than the hand-written parallelism the bun setup needed.
Both devEngines.runtime and .node-version pin 26.5.1 exactly, since setup-nub resolves
devEngines first and a range there would silently override the .node-version pin."
```

---

## Task 4: Add the container build and Compose stack

**Files:**
- Create: `apps/www/Dockerfile`, `apps/www/nginx.conf`, `compose.yml`, `.dockerignore`, `apps/www/.dockerignore`, `.env.example`, `apps/www/.env.example`
- Modify: `apps/www/.env`, `apps/www/next.config.js`, `apps/www/next-sitemap.config.js`
- Delete: `apps/www/.env.development`

**Interfaces:**
- Consumes: the working nub toolchain from Task 3.
- Produces: `docker compose up -d --build` serves the editor on `${PORT:-8080}`; `SITE_URL` build arg flows into sitemap generation.

- [ ] **Step 1: Write the failing check**

Create `/tmp/check-task4.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "PASS: $1"
  else
    echo "FAIL: $1"
    fail=1
  fi
}

check "Dockerfile exists"          'test -f apps/www/Dockerfile'
check "nginx.conf exists"          'test -f apps/www/nginx.conf'
check "root compose.yml exists"    'test -f compose.yml'
check "no apps/www/compose.yml"    '! test -e apps/www/compose.yml'
check "no docker-compose.yml"      '! test -e apps/www/docker-compose.yml'
check "builder is official nub"    'grep -q "^FROM --platform=\$BUILDPLATFORM ghcr.io/nubjs/nub:0.6.0-alpine AS base$" apps/www/Dockerfile'
check "production is dhi nginx"    'grep -q "^FROM dhi.io/nginx:1.31.3-alpine AS production$" apps/www/Dockerfile'
check "deps copies .node-version"  'grep -q "COPY --chown=node:node .node-version package.json pnpm-lock.yaml" apps/www/Dockerfile'
check "uses nub ci"                'grep -q "RUN nub ci" apps/www/Dockerfile'
check "no bun in Dockerfile"       '! grep -q -i bun apps/www/Dockerfile'
check "Dockerfile has HEALTHCHECK" 'grep -q "^HEALTHCHECK" apps/www/Dockerfile'
check "compose builds locally"     'test "$(yq -r ".services.jsoncrack.build.dockerfile" compose.yml)" = "apps/www/Dockerfile"'
check "compose has no image key"   '! yq -e ".services.jsoncrack.image" compose.yml'
check "compose is read_only"       'test "$(yq -r ".services.jsoncrack.read_only" compose.yml)" = "true"'
check "compose drops all caps"     'test "$(yq -r ".services.jsoncrack.cap_drop[0]" compose.yml)" = "ALL"'
check "dockerignore excludes env"  'grep -qx ".env" .dockerignore && grep -qx ".env" apps/www/.dockerignore'
check "nginx listens on ipv6"      'grep -q "listen \[::\]:8080;" apps/www/nginx.conf'
check "sitemap reads SITE_URL"     'grep -q "process.env.SITE_URL" apps/www/next-sitemap.config.js'
check "compose config valid"       'docker compose config --quiet'

exit $fail
```

```bash
chmod +x /tmp/check-task4.sh
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
cd /Users/charles/Work/jsoncrack-bun && /tmp/check-task4.sh
```

Expected: FAIL for nearly everything. Exit code 1.

- [ ] **Step 3: Create apps/www/Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.6

FROM --platform=$BUILDPLATFORM ghcr.io/nubjs/nub:0.6.0-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
COPY --chown=node:node .node-version package.json pnpm-lock.yaml ./
COPY --chown=node:node apps/www/package.json ./apps/www/package.json
COPY --chown=node:node packages/jsoncrack-react/package.json ./packages/jsoncrack-react/package.json
RUN nub ci

# Stage 2: Build the static export
FROM base AS builder
ARG SITE_URL=https://jsoncrack.com
ENV SITE_URL=$SITE_URL
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/apps/www/node_modules ./apps/www/node_modules
COPY --from=deps --chown=node:node /app/packages/jsoncrack-react/node_modules ./packages/jsoncrack-react/node_modules
COPY --chown=node:node . .
RUN nub run build

# Stage 3: Production image
FROM dhi.io/nginx:1.31.3-alpine AS production
COPY --from=builder --chown=65532:65532 /app/apps/www/out /app
COPY apps/www/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://localhost:8080/ || exit 1
```

Five things that are deliberate here:

1. No `WORKDIR` — the nub image sets `/app` and the nginx image sets `/`.
2. No `USER` — the nub image already runs as `node`; `dhi.io/nginx` already runs as uid 65532.
3. `.node-version` is copied in the deps stage so `nub ci` and `nub run build` agree on the Node version. The nub image bakes 26.3.1; nub's Node manager resolves 26.5.1 from this file and downloads it, adding roughly 7 seconds on a cold build.
4. `nub ci` rather than `nub install` — `ci` produces self-contained dependencies that survive being copied between stages.
5. The `HEALTHCHECK` uses `wget`, which `dhi.io/nginx:1.31.3-alpine` provides via busybox. Verified by inspecting the image filesystem: it ships `bin/sh`, `bin/ash`, `usr/bin/wget`, `usr/bin/nc`.

- [ ] **Step 4: Create apps/www/nginx.conf**

```nginx
server {
    listen 8080;
    listen [::]:8080;
    root  /app;
    include /etc/nginx/mime.types;

    location /editor {
        try_files $uri /editor.html;
    }

    location /widget {
        try_files $uri /widget.html;
    }

    location /docs {
        try_files $uri /docs.html;
    }
}
```

- [ ] **Step 5: Create compose.yml**

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

The healthcheck target stays hard-coded at `localhost:8080` — that is the in-container port, which never changes. `${PORT}` only maps the host side.

- [ ] **Step 6: Create the two .dockerignore files**

Both `.dockerignore` and `apps/www/.dockerignore` get identical content:

```
# Secrets
.env
.env.*
*.pem
*.key

# Git history
.git
.gitignore

# Dependencies
node_modules
**/node_modules

# Build outputs and caches
.next
**/.next
out
**/out
npm-debug.log

# Agent tooling
.claude
.agents
.codex

# Editor and CI config
.vscode
.github

# Docs
*.md
```

`.env` and `.env.*` matter most: without them a developer's local `.env` would be baked into the build context.

- [ ] **Step 7: Create the two .env.example files**

Root `.env.example` (Compose interpolation only):

```bash
# Host port exposed by Docker Compose
PORT=8080

# Base URL for sitemap generation (passed as a build arg)
SITE_URL=https://jsoncrack.com
```

`apps/www/.env.example` (app variables):

```bash
# Maximum number of nodes to render in the graph
NEXT_PUBLIC_NODE_LIMIT=10000

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1

# Disable external mode dialog
NEXT_PUBLIC_DISABLE_EXTERNAL_MODE=true

# Google Analytics measurement ID (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=

# Base URL for sitemap generation (build-time only)
SITE_URL=https://jsoncrack.com
```

- [ ] **Step 8: Update apps/www/.env and delete .env.development**

Overwrite `apps/www/.env`:

```bash
NEXT_PUBLIC_NODE_LIMIT=10000
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_DISABLE_EXTERNAL_MODE=true
```

```bash
git rm --quiet apps/www/.env.development
```

- [ ] **Step 9: Disable production source maps**

In `apps/www/next.config.js`:

```diff
-  productionBrowserSourceMaps: true,
+  productionBrowserSourceMaps: false,
```

Self-hosted deployments have no use for shipping source maps to every visitor.

- [ ] **Step 10: Make the sitemap read SITE_URL**

In `apps/www/next-sitemap.config.js`:

```diff
-  siteUrl: "https://jsoncrack.com",
+  siteUrl: process.env.SITE_URL || "https://jsoncrack.com",
```

Without this, a self-hosted instance generates a sitemap pointing at jsoncrack.com.

- [ ] **Step 11: Run the check to verify it passes**

```bash
/tmp/check-task4.sh
```

Expected: all 19 lines PASS. Exit code 0.

- [ ] **Step 12: Build the image**

```bash
docker build -f apps/www/Dockerfile -t jsoncrack-nub:test . 2>&1 | tail -20
```

Expected: all three stages complete; exit 0.

Watch for `Using Node.js 26.5.1 (resolved from .node-version)` in the deps stage output — that confirms the Node pin reached the container.

If the builder stage fails on missing modules, the isolated `node_modules` symlink layout did not survive the cross-stage copy. Fall back to `RUN nub install --frozen-lockfile --layout hoisted` in the deps stage, and record what happened in Task 6's `nub-experiments.md`.

- [ ] **Step 13: Run the container and verify it actually serves the editor**

```bash
docker compose up -d --build
sleep 5
docker compose ps --format "table {{.Name}}\t{{.Status}}"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8080/
curl -sS http://localhost:8080/ | grep -c -i 'json' 
```

Expected: status shows `healthy` or `running`; `HTTP 200`; the grep count is greater than zero.

```bash
docker compose logs jsoncrack --tail=20
docker compose down -v --remove-orphans
```

Expected: no error lines in the logs.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(container): add self-hostable image and compose stack

Build the static export with the official nub image and serve it from Docker's hardened
nginx, which runs as uid 65532 and already exposes 8080. A trivy scan put that image at
zero CVEs across every severity, against two critical and thirty-one high for
nginx-unprivileged.

A single root compose.yml builds from source with read_only, cap_drop ALL,
no-new-privileges, tmpfs mounts, a healthcheck, and log rotation. The sitemap now reads
SITE_URL so a self-hosted instance stops advertising jsoncrack.com, and nginx listens on
IPv6 as well as IPv4."
```

---

## Task 5: Rebuild the GitHub workflows on nub

**Files:**
- Create: `.github/workflows/image-publish.yml`
- Modify: `.github/workflows/deploy.yml`, `.github/workflows/pull-request.yml`

**Interfaces:**
- Consumes: the container build from Task 4 and the nub scripts from Task 3.
- Produces: CI installs with `nub ci` and builds with `nub run build`; releases publish multi-arch images to GHCR.

- [ ] **Step 1: Write the failing check**

Create `/tmp/check-task5.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "PASS: $1"
  else
    echo "FAIL: $1"
    fail=1
  fi
}

W=.github/workflows

check "no pnpm in workflows"       '! grep -rq pnpm $W'
check "no bun in workflows"        '! grep -rq -i bun $W'
check "no mise-action"             '! grep -rq "jdx/mise-action" $W'
check "checkout is v6 everywhere"  '! grep -rq "actions/checkout@v[1-5]" $W'
check "cache is v5 everywhere"     '! grep -rq "actions/cache@v[1-4]" $W'
check "deploy uses setup-nub"      'grep -q "nubjs/setup-nub@v0" $W/deploy.yml'
check "pr uses setup-nub"          'grep -q "nubjs/setup-nub@v0" $W/pull-request.yml'
check "deploy installs with ci"    'grep -q "run: nub ci" $W/deploy.yml'
check "pr installs with ci"        'grep -q "run: nub ci" $W/pull-request.yml'
check "cache keyed on pnpm lock"   'grep -q "hashFiles(.pnpm-lock.yaml.)" $W/deploy.yml'
check "image-publish exists"       'test -f $W/image-publish.yml'
check "image-publish logs in dhi"  'grep -q "registry: dhi.io" $W/image-publish.yml'
check "all workflows parse"        'for f in $W/*.yml; do yq -e . "$f" >/dev/null || exit 1; done'

exit $fail
```

```bash
chmod +x /tmp/check-task5.sh
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
cd /Users/charles/Work/jsoncrack-bun && /tmp/check-task5.sh
```

Expected: FAIL for the setup-nub, `nub ci`, cache key, and image-publish checks. Exit code 1.

- [ ] **Step 3: Rewrite deploy.yml**

Overwrite `.github/workflows/deploy.yml`:

```yaml
name: Deploy Next.js site to Pages

on:
  push:
    branches: ["main"]

  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up nub
        uses: nubjs/setup-nub@v0
        with:
          cache: true

      - name: Restore Next.js cache
        uses: actions/cache@v5
        with:
          path: apps/www/.next/cache
          key: ${{ runner.os }}-next-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('apps/www/**.[jt]s', 'apps/www/**.[jt]sx', 'packages/**.[jt]s', 'packages/**.[jt]sx') }}
          restore-keys: |
            ${{ runner.os }}-next-${{ hashFiles('pnpm-lock.yaml') }}-

      - name: Install dependencies
        run: nub ci

      - name: Build
        run: nub run build
        env:
          NEXT_PUBLIC_GA_MEASUREMENT_ID: ${{ vars.NEXT_PUBLIC_GA_MEASUREMENT_ID }}

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: './apps/www/out'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

The dependency cache that used to be hand-rolled with `actions/cache` is gone — `setup-nub`'s `cache: true` handles it. The `.next/cache` block stays because that is a build artifact cache, not a dependency cache.

- [ ] **Step 4: Rewrite pull-request.yml**

Overwrite `.github/workflows/pull-request.yml`:

```yaml
name: Verify Pull Request

on:
  pull_request:
    branches: ["main"]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up nub
        uses: nubjs/setup-nub@v0
        with:
          cache: true

      - name: Install dependencies
        run: nub ci

      - name: Lint
        run: nub run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up nub
        uses: nubjs/setup-nub@v0
        with:
          cache: true

      - name: Install dependencies
        run: nub ci

      - name: Test
        run: nub run test

  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up nub
        uses: nubjs/setup-nub@v0
        with:
          cache: true

      - name: Restore Next.js cache
        uses: actions/cache@v5
        with:
          path: apps/www/.next/cache
          key: ${{ runner.os }}-next-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('apps/www/**.[jt]s', 'apps/www/**.[jt]sx', 'packages/**.[jt]s', 'packages/**.[jt]sx') }}
          restore-keys: |
            ${{ runner.os }}-next-${{ hashFiles('pnpm-lock.yaml') }}-

      - name: Install dependencies
        run: nub ci

      - name: Build
        run: nub run build
```

A `test` job is added: upstream ships 52 vitest tests in `jsoncrack-react` and the bun-era workflow never ran them.

- [ ] **Step 5: Create image-publish.yml**

```yaml
name: Image Building and Publishing

on:
  release:
    types: [created]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      attestations: write
      id-token: write

    steps:
      - name: Derive container package name
        id: vars
        run: |
          echo "pkg_lc=$(echo "${GITHUB_REPOSITORY#*/}" | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_OUTPUT"

      - name: Check if GHCR package exists
        id: pkg
        env:
          OWNER: ${{ github.repository_owner }}
          PKG: ${{ steps.vars.outputs.pkg_lc }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if gh api -H "Accept: application/vnd.github+json" \
            "/orgs/$OWNER/packages/container/$PKG" >/dev/null 2>&1 ||
            gh api -H "Accept: application/vnd.github+json" \
            "/users/$OWNER/packages/container/$PKG" >/dev/null 2>&1; then
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Cleanup untagged images
        uses: actions/delete-package-versions@v5
        if: steps.pkg.outputs.exists == 'true'
        with:
          package-name: ${{ steps.vars.outputs.pkg_lc }}
          package-type: "container"
          delete-only-untagged-versions: true
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Checkout
        uses: actions/checkout@v6

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hardened Images
        uses: docker/login-action@v3
        with:
          registry: dhi.io
          username: ${{ secrets.DHI_USERNAME }}
          password: ${{ secrets.DHI_TOKEN }}

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata (tags, labels) for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{raw}},enable=${{ github.event_name == 'release' }}
            type=semver,pattern=v{{major}}.{{minor}},enable=${{ github.event_name == 'release' }}
            type=semver,pattern=v{{major}},enable=${{ github.event_name == 'release' }}
            type=sha,enable=${{ github.event_name == 'workflow_dispatch' }}
          flavor: |
            latest=auto

      - name: Build and push Docker image
        id: build-and-push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/www/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Generate artifact attestation
        id: attest
        uses: actions/attest-build-provenance@v2
        with:
          subject-name: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          subject-digest: ${{ steps.build-and-push.outputs.digest }}
```

Two things worth knowing:

1. `IMAGE_NAME` derives from `github.repository`, so the rename to `jsoncrack-nub` propagates with no edit here.
2. The `dhi.io` login step is new and required — the production stage pulls `dhi.io/nginx`. It needs two repository secrets, `DHI_USERNAME` and `DHI_TOKEN`. Without them this workflow fails at the build step. Note this in the handoff; the user must add them in GitHub settings.

The `GH_TOKEN` env var on the package-existence step is also new: `gh api` needs it, and the bun-era version relied on it being present ambiently.

- [ ] **Step 6: Run the check to verify it passes**

```bash
/tmp/check-task5.sh
```

Expected: all 13 lines PASS. Exit code 0.

- [ ] **Step 7: Lint the workflow files with actionlint if available**

```bash
if command -v actionlint >/dev/null 2>&1; then
  actionlint .github/workflows/*.yml && echo "actionlint clean"
else
  echo "actionlint not installed, skipping"
fi
```

Expected: `actionlint clean`, or the skip message.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "ci: rebuild workflows on nub and add image publishing

Swap mise-action plus two hand-rolled dependency caches for the official
nubjs/setup-nub, whose cache input covers the same ground in one line. Cache keys move
from bun.lock to pnpm-lock.yaml, and every action is brought up to the versions upstream
now uses instead of the v4 pins that were current when this fork's CI was written.

Pull requests gain a test job: upstream ships fifty-two vitest tests that the previous
workflow never ran. Image publishing builds multi-arch to GHCR with build provenance,
and logs in to dhi.io because the production stage pulls Docker's hardened nginx."
```

---

## Task 6: Document the nub toolchain and self-hosting

**Files:**
- Create: `nub-experiments.md`
- Modify: `README.md`
- Delete: `bun-experiments.md` (never created in this history — verify absence only)

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: a README whose commands all work as written.

- [ ] **Step 1: Write the failing check**

Create `/tmp/check-task6.sh`:

```bash
#!/usr/bin/env bash
set -uo pipefail
fail=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    echo "PASS: $1"
  else
    echo "FAIL: $1"
    fail=1
  fi
}

check "nub-experiments.md exists"   'test -f nub-experiments.md'
check "no bun-experiments.md"       '! test -e bun-experiments.md'
check "README has no pnpm"          '! grep -q -i pnpm README.md'
check "README has no bun"           '! grep -q -i "\bbun\b" README.md'
check "README has no turbo"         '! grep -q -i turbo README.md'
check "README mentions nub install" 'grep -q "nub install" README.md'
check "README has no vscode links"  '! grep -q "jsoncrack-vscode" README.md'
check "README has no chrome ext"    '! grep -q "chromewebstore" README.md'
check "README documents SITE_URL"   'grep -q "SITE_URL" README.md'
check "README has compose up"       'grep -q "docker compose up -d --build" README.md'

exit $fail
```

```bash
chmod +x /tmp/check-task6.sh
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
cd /Users/charles/Work/jsoncrack-bun && /tmp/check-task6.sh
```

Expected: FAIL for `nub-experiments.md exists` and the README content checks. Exit code 1.

- [ ] **Step 3: Update the README header links**

In `README.md`, in the header paragraph, delete the VS Code and Chrome entries along with the `·` separator that precedes them:

```html
    <a href="https://github.com/AykutSarac/jsoncrack.com/issues">Issues</a>
    ·
    <a href="https://marketplace.visualstudio.com/items?itemName=AykutSarac.jsoncrack-vscode">VS Code</a>
    ·
    <a href="https://chromewebstore.google.com/detail/hbaeglefdflnhodchjiaphmheaojikhh">Chrome</a>
```

becomes:

```html
    <a href="https://github.com/AykutSarac/jsoncrack.com/issues">Issues</a>
```

- [ ] **Step 4: Update the README Integrations section**

Replace the Integrations list so only the npm package remains:

```markdown
## Integrations

- [npm Package (`jsoncrack-react`)](https://www.npmjs.com/package/jsoncrack-react)
```

- [ ] **Step 5: Rewrite the README Getting Started section**

Replace the prerequisites, setup, and scripts content with:

````markdown
## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev/) (recommended) — installs the pinned nub version automatically
- Or [nub](https://nubjs.com/) >= 0.6 and Node.js 26.5.1 installed manually

### Setup

1. Clone the repo:

   ```sh
   git clone https://github.com/charliie-dev/jsoncrack-nub.git
   cd jsoncrack-nub
   ```

2. Install dependencies:

   ```sh
   nub install
   ```

3. Copy the example env file and adjust as needed:

   ```sh
   cp apps/www/.env.example apps/www/.env
   ```

4. Start the dev server:

   ```sh
   nub run dev
   ```

   The editor is available at http://localhost:3000.

### Scripts

```sh
nub run dev        # Start the dev server
nub run build      # Build the static export
nub run start      # Serve the production build
nub run lint       # Typecheck, lint, and check formatting
nub run lint:fix   # Fix lint and formatting issues
nub run test       # Run the test suite
nub run analyze    # Build with the bundle analyzer
nub run clean      # Remove build outputs
```

With mise installed, `mise run <task>` wraps each of these, plus the `dc:*` Docker tasks
below.

### Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_NODE_LIMIT` | `10000` | Maximum number of nodes rendered in the graph |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |
| `NEXT_PUBLIC_DISABLE_EXTERNAL_MODE` | `true` | Disable the external mode dialog |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | _(empty)_ | Google Analytics measurement ID (optional) |
| `SITE_URL` | `https://jsoncrack.com` | Base URL used for sitemap generation (build-time) |
| `PORT` | `8080` | Host port published by Docker Compose |

### Docker

The root `compose.yml` builds the image from source and serves the static export through
nginx:

```sh
cp .env.example .env
docker compose up -d --build

# The editor is available at http://localhost:8080
```

To run on a different port:

```sh
PORT=3000 docker compose up -d --build
```

To set the sitemap base URL for a self-hosted instance:

```sh
SITE_URL=https://json.example.com docker compose up -d --build
```

Pre-built multi-arch images are published to GHCR on each release:

```sh
docker pull ghcr.io/charliie-dev/jsoncrack-nub:latest
```

With mise:

```sh
mise run dc:up         # Build and start
mise run dc:status     # Show container status
mise run dc:logs       # Tail logs
mise run dc:down       # Stop and remove
mise run dc:validate   # Validate the compose config
```
````

Note the dev server port is 3000 (Next.js default) while Docker publishes 8080 (nginx). Do not conflate them.

- [ ] **Step 6: Create nub-experiments.md**

```markdown
# nub Toolchain Notes

Why this fork runs on [nub](https://nubjs.com/) instead of pnpm, and what had to be
discovered empirically rather than read from the docs.

## What nub replaces

nub is not a runtime. It runs on stock Node and replaces pnpm, npx, corepack, and nvm.
The production container is unaffected — it was always nginx serving a static export.

## Lockfile: pnpm-lock.yaml, deliberately

nub reads and writes pnpm lockfile v9 natively, so this fork keeps upstream's
`pnpm-lock.yaml` rather than introducing a format of its own.

The bun era deleted `pnpm-lock.yaml` and added `bun.lock`. That produced a
modify/delete conflict on every upstream sync, and worse, `bun.lock` never conflicted
while silently going stale — one sync pulled 65 upstream commits' worth of dependency
changes with the lockfile untouched and nobody noticed until the next install.

Keeping upstream's format gives a fixed recipe instead: take upstream's version, then
run `nub install --no-frozen-lockfile`.

The lockfile still differs from upstream by roughly 4871 lines, because removing
`apps/vscode` and `apps/chrome-extension` drops `importers` from five to three. It is a
textual conflict now, not a structural one.

## pnpm-workspace.yaml is silently ignored

Undocumented: under nub identity, `pnpm-workspace.yaml` is not read. nub prints

```
pnpm-workspace.yaml is not read under nub identity — migrate it (nub pm use nub),
delete it, or return to pnpm (nub pm use pnpm).
```

The file must be deleted and its `packages:` globs moved to `package.json#workspaces`.

## Topological ordering replaces hand-written parallelism

`nub run -r` sorts workspaces topologically by default. Because `www` depends on
`jsoncrack-react` through `workspace:*`, `nub run -r build` builds the package before the
app with no explicit sequencing. The bun scripts needed
`build && (a & b & wait)`; that is gone.

Two constraints found the hard way:

- `lint` still needs an explicit `nub run --filter jsoncrack-react build` first. `www`'s
  `tsc` reads `jsoncrack-react/dist` for types, and topological order governs the order
  `lint` runs in, not whether `build` ran at all.
- Flags belong before the script name. `nub run` forwards everything after the script
  name to the script, so `nub run test -r` passes `-r` to vitest.

## Node version: one file, three consumers

`.node-version` pins `26.5.1` and is read by mise locally, `nubjs/setup-nub` in CI, and
nub's own Node manager inside the Docker build.

`devEngines.runtime` must pin the same exact version, not `^26`. `setup-nub` resolves
`devEngines.runtime` before `.node-version`, so a range there silently overrides the pin.

The builder image bakes Node 26.3.1, but nub upgrades itself in place:

```
Using Node.js 26.5.1 (resolved from .node-version)
Installing from nodejs.org...
Installed in 7.0s
```

That costs about 7 seconds on a cold build and requires the build to reach nodejs.org.
`.node-version` is copied in the deps stage so `nub ci` and `nub run build` agree.

## Base images were chosen by scanning, not by reputation

trivy results for the candidates:

| image | CRITICAL | HIGH | MEDIUM |
|---|---|---|---|
| `dhi.io/nginx:1.31.3-alpine` | 0 | 0 | 0 |
| `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` | 2 | 31 | 46 |
| `ghcr.io/nubjs/nub:0.6.0-alpine` | 1 | 6 | 10 |
| `ghcr.io/nubjs/nub:0.6.0-slim` | 5 | 24 | 65 |
| `dhi.io/node:26.5.1-debian-dev` | 16 | 28 | 75 |

Production uses `dhi.io/nginx:1.31.3-alpine`: zero CVEs at every severity, natively uid
65532, and already exposing 8080, which matches the existing nginx config exactly.

The surprise was that Docker Hardened Images' zero-CVE guarantee does not extend to
`-dev` variants. `dhi.io/node:26.5.1-debian` scans clean at 0/0/5; the `-dev` variant it
would have to be, since the runtime variant has neither npm nor root, carries 16 critical
findings, all in perl. Official `ghcr.io/nubjs/nub` images also expose SLSA provenance
and an SPDX SBOM, whereas `docker buildx imagetools inspect` returns an empty provenance
object for `dhi.io/node`.

The builder stage is discarded, so its CVEs never ship. It uses the official nub alpine
image: fewest findings, nub preinstalled, and no `dhi.io` credentials needed to build.

## A nub bug, for whoever tries DHI's node image next

Installing nub into `dhi.io/node:26.5.1-alpine-dev` yields:

```
@nubjs/nub: the @nubjs/nub-linux-arm64 package is not installed.
```

`isMusl()` in `@nubjs/nub/platform.js` tests
`"glibcVersionRuntime" in header`. On musl that key is absent entirely, so the primary
signal is inconclusive and the function falls through to an `ldd --version` probe. DHI
images ship no `ldd`, `execSync` throws, and the catch checks whether the error text
contains `"musl"` — `ldd: not found` does not, so musl reads as glibc and the launcher
resolves a package npm's `libc` filter never installed.

Ordinary Alpine has busybox's `ldd`, which is why this only surfaces on DHI. Installing
`@nubjs/nub-linux-arm64-musl` by hand does not help; the launcher wants the glibc name.
The glibc `dhi.io/node:26.5.1-debian-dev` works.

Separately, DHI's node images block npm install-scripts, so nub's `postinstall` — which
sets the execute bit on the platform binary — never runs. It needs
`npm install -g --allow-scripts=@nubjs/nub @nubjs/nub`.

Neither problem exists on the official nub image, where the binary ships preinstalled.

## Docker Hardened Images: practical notes

- The namespace is the registry root: `dhi.io/nginx`, `dhi.io/node`. Not
  `dhi.io/<org>/<image>`, and `_catalog` returns 404, so repositories cannot be
  enumerated.
- Runtime images having no shell turned out not to apply to `dhi.io/nginx:1.31.3-alpine`.
  Inspecting its filesystem shows busybox's `bin/sh`, `bin/ash`, `usr/bin/wget`, and
  `usr/bin/nc`, so both the Dockerfile `HEALTHCHECK` and the Compose `CMD-SHELL`
  healthcheck work without the larger `-compat` variant (4 MB against 11 MB).
- `image-publish.yml` needs `DHI_USERNAME` and `DHI_TOKEN` repository secrets. Without
  them the container build cannot pull the production base image.
```

- [ ] **Step 7: Run the check to verify it passes**

```bash
/tmp/check-task6.sh
```

Expected: all 10 lines PASS. Exit code 0.

- [ ] **Step 8: Verify every README command is real**

```bash
for s in dev build start lint lint:fix test analyze clean; do
  jq -e --arg s "$s" '.scripts[$s]' package.json >/dev/null || echo "MISSING script: $s"
done
for t in dc:up dc:status dc:logs dc:down dc:validate; do
  grep -q "\[tasks.\"$t\"\]" mise.toml || echo "MISSING mise task: $t"
done
echo "command audit done"
```

Expected: only `command audit done` — no MISSING lines.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "docs: document nub toolchain and self-hosting

Rewrite the README around nub and a single compose file, and drop the extension links
whose apps this fork no longer ships. Add nub-experiments.md recording what had to be
found by experiment: pnpm-workspace.yaml is silently ignored under nub identity,
devEngines.runtime silently overrides .node-version when it holds a range, and base
images were picked from trivy output rather than reputation."
```

---

## Task 7: Verify the rewritten history end to end

**Files:**
- No file edits. Verification only.

**Interfaces:**
- Consumes: all six commits from Tasks 1–6.
- Produces: evidence for every acceptance criterion in the design doc, or a specific failure to report.

- [ ] **Step 1: Confirm the commit topology**

```bash
git log --oneline 3c9af69e..HEAD | cat
git rev-list --count 3c9af69e..HEAD
```

Expected: 7 commits — the cherry-picked spec plus the six from Tasks 1–6. Each message matches the intent of its task.

- [ ] **Step 2: Confirm pnpm-lock.yaml was never deleted anywhere in the history**

```bash
git log --oneline --diff-filter=D 3c9af69e..HEAD -- pnpm-lock.yaml | cat
echo "---"
git log --oneline 3c9af69e..HEAD -- bun.lock | cat
echo "--- both empty above means PASS ---"
```

Expected: both listings empty. This is the structural property the whole rewrite exists to establish.

- [ ] **Step 3: Confirm no bun or turbo references survive**

```bash
git grep -n -i -E '\bbun\b|turbo' -- ':!pnpm-lock.yaml' ':!docs/' ':!nub-experiments.md' \
  ':!apps/www/next.config.js' ':!apps/www/tsconfig.json' ':!packages/jsoncrack-react/tsconfig.build.json' \
  || echo "no bun/turbo references"
```

Expected: `no bun/turbo references`.

The exclusions are legitimate: `next.config.js` has `withBundleAnalyzer` and `turbopack`, the two tsconfigs have `moduleResolution: bundler`, and `nub-experiments.md` discusses the bun era on purpose.

- [ ] **Step 4: Verify application source is byte-identical to the baseline**

```bash
git diff --stat baseline-rebased-main HEAD -- \
  apps/www/src/features apps/www/src/store apps/www/src/lib apps/www/src/hooks \
  apps/www/src/constants apps/www/src/enums apps/www/src/types apps/www/src/assets \
  packages/jsoncrack-react/src
echo "--- empty above means PASS ---"
```

Expected: no output.

`apps/www/src/layout` and `apps/www/src/pages` are excluded from this comparison because Tasks 1 and 2 intentionally modify them. Verify those separately:

```bash
git diff --stat baseline-rebased-main HEAD -- apps/www/src/layout apps/www/src/pages
```

Expected: differences confined to `PageLayout/Navbar.tsx`, `PageLayout/Footer.tsx`, and `pages/index.tsx`. Any other file appearing here is a mistake to investigate.

- [ ] **Step 5: Run a clean install from the committed lockfile**

```bash
rm -rf node_modules apps/www/node_modules packages/jsoncrack-react/node_modules
nub ci 2>&1 | tail -5
```

Expected: completes with no drift error. A drift error means the committed lockfile does not match `package.json`.

- [ ] **Step 6: Run the test suite**

```bash
nub run test 2>&1 | tail -8
```

Expected: `Test Files  3 passed (3)`, `Tests  52 passed (52)`.

- [ ] **Step 7: Run lint**

```bash
nub run lint 2>&1 | tail -6
echo "exit: $?"
```

Expected: prettier clean for both workspaces, exit 0.

- [ ] **Step 8: Run the build**

```bash
nub run build 2>&1 | tail -8
```

Expected: static export completes; `next-sitemap` reports `Generation completed`.

- [ ] **Step 9: Confirm the sitemap honours SITE_URL**

```bash
SITE_URL=https://json.example.com nub run build 2>&1 | tail -3
grep -o 'https://[a-z.]*' apps/www/out/sitemap.xml | sort -u
```

Expected: `https://json.example.com` appears; `https://jsoncrack.com` does not.

```bash
nub run build >/dev/null 2>&1
```

Rebuild with the default so the working tree is not left holding an example-domain sitemap.

- [ ] **Step 10: Build and run the container**

```bash
docker compose build 2>&1 | tail -10
docker compose up -d
sleep 5
docker compose ps --format "table {{.Name}}\t{{.Status}}"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8080/
```

Expected: `HTTP 200`; container status `healthy` or `running`.

- [ ] **Step 11: Confirm the container runs unprivileged and read-only**

```bash
docker compose exec jsoncrack id 2>&1 || docker inspect jsoncrack --format 'User={{.Config.User}}'
docker inspect jsoncrack --format 'ReadOnly={{.HostConfig.ReadonlyRootfs}} CapDrop={{.HostConfig.CapDrop}}'
```

Expected: user is 65532 (not 0); `ReadOnly=true`; `CapDrop=[ALL]`.

- [ ] **Step 12: Scan the final image**

```bash
docker compose down -v --remove-orphans
IMG=$(yq -r '.services.jsoncrack.image // "jsoncrack-bun-jsoncrack"' compose.yml)
docker images --format '{{.Repository}}:{{.Tag}}' | grep -i jsoncrack | head -3
```

Then scan whichever local tag the build produced:

```bash
trivy image --quiet --scanners vuln --severity CRITICAL,HIGH <tag-from-above> 2>&1 | tail -12
```

Expected: no CRITICAL or HIGH findings introduced by this change. The base is `dhi.io/nginx:1.31.3-alpine`, which scanned clean, so any finding here comes from the copied static export and warrants investigation.

- [ ] **Step 13: Validate the compose config through mise**

```bash
mise run dc:validate
```

Expected: `Compose config OK`.

- [ ] **Step 14: Record the verification results**

Write the actual observed output for every step above into the handoff summary. Do not claim a step passed without its output. If any step failed, stop and report the failure rather than continuing to Task 8.

- [ ] **Step 15: Commit any incidental fixes**

If Steps 1–13 required fixes, amend them into the relevant commit from Tasks 1–6 rather than adding a new commit, so the six-commit topology holds:

```bash
git status --short
```

Expected: no output. If there is output, decide which commit it belongs to and `git commit --fixup=<sha>` then `git rebase -i --autosquash 3c9af69e`.

---

## Task 8: Hand off for review

**Files:**
- No file edits.

**Interfaces:**
- Consumes: the verified history from Task 7.
- Produces: a decision point for the user on force-pushing.

- [ ] **Step 1: Produce the final comparison against the bun-era history**

```bash
git diff --stat backup-bun-main HEAD | tail -5
echo "=== files only in the new history ==="
git diff --name-status backup-bun-main HEAD | rg '^A' | head -20
echo "=== files only in the old history ==="
git diff --name-status backup-bun-main HEAD | rg '^D' | head -20
```

- [ ] **Step 2: Confirm the branch is ready but unpushed**

```bash
git log --oneline --graph 3c9af69e..HEAD | cat
git status --short --branch | head -2
```

Expected: seven commits, clean tree, and no upstream tracking push yet.

- [ ] **Step 3: Report to the user and stop**

Summarise: the commit topology, every verification result with its actual output, the two secrets they must add in GitHub settings (`DHI_USERNAME`, `DHI_TOKEN`), and the fact that `main` is untouched — the work is on `nub-migration`.

Do not force-push. Moving `main` and rewriting the remote is the user's call, and it requires explicit approval in a later turn. When they approve, the sequence is:

```bash
git switch main
git reset --hard nub-migration
git push --force-with-lease origin main
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Commit 1: remove vscode/chrome-extension | Task 1 |
| Commit 2: strip landing page | Task 2 |
| Commit 3: adopt nub toolchain | Task 3 |
| Commit 4: container and compose | Task 4 |
| Commit 5: CI | Task 5 |
| Commit 6: docs | Task 6 |
| Verification items 1–9 | Task 7 steps 5–12 |
| Backup refs before rewriting | Task 0 step 2 |
| `pnpm-lock.yaml` never deleted | Task 7 step 2 |
| App source untouched | Task 7 step 4 |
| dhi.io CI credentials risk | Task 5 step 5, Task 8 step 3 |
| Force-push requires approval | Task 8 step 3 |

No gaps.

**Naming consistency:** script names (`dev`, `build`, `start`, `lint`, `lint:fix`, `test`, `analyze`, `clean`) are identical across `package.json` in Task 3 step 4, `mise.toml` in Task 3 step 8, the README in Task 6 step 5, and the audit in Task 6 step 8. Image references (`ghcr.io/nubjs/nub:0.6.0-alpine`, `dhi.io/nginx:1.31.3-alpine`) are identical in Task 4 step 3, its check script, and Task 6's notes. Branch and ref names (`nub-migration`, `backup-bun-main`, `baseline-rebased-main`) are used consistently in Tasks 0, 7, and 8.

**Known limitations carried from the spec:** nub is pre-1.0; the build now runs on Node for the first time in this fork's history (Task 3 step 13 is where that surfaces); the Docker build needs network access to nodejs.org; container builds need `dhi.io` credentials.
