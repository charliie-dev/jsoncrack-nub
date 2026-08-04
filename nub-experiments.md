# nub Toolchain Notes

Why this fork runs on [nub](https://nubjs.com/) instead of pnpm, and what had to be
discovered by experiment rather than read from the docs.

## What nub replaces

nub is not a runtime. It runs on stock Node and replaces pnpm, npx, corepack, and nvm.
The production container is unaffected — it was always nginx serving a static export.

## Lockfile: pnpm-lock.yaml, deliberately

nub reads and writes pnpm lockfile v9 natively, so this fork keeps upstream's
`pnpm-lock.yaml` rather than introducing a format of its own.

An earlier iteration of this fork deleted `pnpm-lock.yaml` and added `bun.lock`. That
produced a modify/delete conflict on every upstream sync, and worse, `bun.lock` never
conflicted while silently going stale — one sync pulled 65 upstream commits' worth of
dependency changes with the lockfile untouched, and nobody noticed until the next install.

Keeping upstream's format gives a fixed recipe instead: take upstream's version, then run
`nub install --no-frozen-lockfile`.

The lockfile still differs from upstream substantially, because removing `apps/vscode` and
`apps/chrome-extension` drops `importers` from five to three. It is a textual conflict now,
not a structural one.

## pnpm-workspace.yaml is silently ignored

Undocumented: under nub identity, `pnpm-workspace.yaml` is not read. nub prints

```
pnpm-workspace.yaml is not read under nub identity — migrate it (nub pm use nub),
delete it, or return to pnpm (nub pm use pnpm).
```

The file must be deleted and its `packages:` globs moved to `package.json#workspaces`.

## nub does not install optional peer dependencies

This one cost the most time. `nub run build` failed with a webpack internal error:

```
Cannot read properties of null (reading 'getExportsType')
../../node_modules/.store/zustand@5.0.14.../node_modules/zustand/esm/traditional.mjs
```

The message points at webpack, but webpack is not the problem. Importing the module from a
real file gives the actual cause:

```
Cannot find package 'use-sync-external-store' imported from
node_modules/.store/zustand@5.0.14.../node_modules/zustand/esm/traditional.mjs
```

`use-sync-external-store` is an **optional** peerDependency of zustand.
pnpm has installed optional peers by default since v8 (`auto-install-peers`), and
upstream's lockfile shows it resolved:
`zustand@5.0.12(...)(use-sync-external-store@1.6.0(react@19.2.4))` plus a
`use-sync-external-store@1.6.0` package entry. nub's regenerated lockfile carries only the
peer declaration — no package entry, nothing installed. `zustand/traditional` imports it
at runtime, so resolution fails.

`auto-install-peers=true` in `.npmrc` does not change this; nub ignores it.

The fix is to declare the package explicitly in `apps/www/package.json`, which is correct
under any package manager. Expect the same class of failure from other packages' optional
peers, presenting as an equally misleading webpack error.

Four hypotheses were tested and ruled out before finding it:

| Hypothesis | Test | Result |
|---|---|---|
| zustand version drift | pinned upstream's exact 5.0.12 | still failed |
| Node version | used upstream CI's 24.10.0 | still failed |
| isolated node_modules layout | `--node-linker hoisted`, `.npmrc` `node-linker=hoisted` | nub ignores both; `.store` created regardless |
| webpack-specific | built with turbopack instead | still failed |

Note that `nub install --node-linker hoisted` is accepted but has no effect — the
lockfile-derived layout wins. There appears to be no way to get a hoisted layout from a
pnpm lockfile.

## Regenerating the lockfile drifts every caret range

Regenerating moved 193 packages to new versions. Two consequences worth knowing:

- `prettier` went 3.8.1 → 3.9.6 within its existing `^3.8.1` range, which reformats an
  enum and a union type in two source files. Formatting only, no behaviour change.
- `esbuild` went 0.25.12 → 0.21.5. This is a **correct** downgrade: 0.25.12 came from
  `apps/vscode`'s direct dependency, and after removing that workspace only vite's
  transitive `^0.21.5` constraint remains.
- `@emnapi/core` resolved to `2.0.0-alpha.3` where upstream has stable `1.10.0`. It
  arrives via `@napi-rs/wasm-runtime`, a WASM fallback for the eslint resolver, and does
  not affect lint or build output.

## next-sitemap wrote to the wrong directory, one build behind

Unrelated to nub, but found while verifying that `SITE_URL` reaches the generated sitemap.

next-sitemap's default `outDir` is `public`. With `output: "export"`, `next build` copies
`public` into `out` and *then* runs `postbuild`. So the sitemap next-sitemap writes lands
in `public` after `out` has already been assembled: the deployed artifact carries the
*previous* build's sitemap, and a genuinely clean build produces an `out` with no sitemap
at all.

Upstream never noticed because it commits `public/robots.txt`, `public/sitemap.xml`, and
`public/sitemap-0.xml` to git. Those committed copies get picked up by the `public` → `out`
copy, which masks the ordering bug and also means the tree is dirty after every build.

Two changes fix it:

- `outDir: "out"` in `next-sitemap.config.js`, so postbuild writes straight into the export
  directory and one clean build produces correct output.
- `generateRobotsTxt: true`, replacing the static `public/robots.txt` that hardcoded
  `https://jsoncrack.com/sitemap.xml` and therefore ignored `SITE_URL` entirely.

The three generated files are now untracked and gitignored. Verified on a clean build with
`out`, `.next`, and the `public` artifacts all deleted first: `SITE_URL` reaches both
`out/sitemap.xml` and `out/robots.txt`, and `git status` stays clean afterwards.

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

Verified inside the built image: `node --version` reports 26.3.1 while `nub -e
"console.log(process.version)"` reports 26.5.1. Since the build runs through `nub run
build`, the pinned version is what compiles the app. This costs roughly 7 seconds on a
cold build and requires the build to reach nodejs.org. `.node-version` is copied in the
deps stage so `nub ci` and `nub run build` agree.

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
65532, and already exposing 8080, which matches the existing nginx config exactly. The
final image is 43.3 MB.

The surprise was that Docker Hardened Images' zero-CVE guarantee does not extend to `-dev`
variants. `dhi.io/node:26.5.1-debian` scans clean at 0/0/5; the `-dev` variant — which it
would have to be, since the runtime variant has neither npm nor root — carries 16 critical
findings, all in perl. Official `ghcr.io/nubjs/nub` images also expose SLSA provenance and
an SPDX SBOM, whereas `docker buildx imagetools inspect` returns an empty provenance object
for `dhi.io/node`.

The builder stage is discarded, so its CVEs never ship. It uses the official nub alpine
image: fewest findings, nub preinstalled, and no `dhi.io` credentials needed to build.

## A nub bug, for whoever tries DHI's node image next

Installing nub into `dhi.io/node:26.5.1-alpine-dev` yields:

```
@nubjs/nub: the @nubjs/nub-linux-arm64 package is not installed.
```

`isMusl()` in `@nubjs/nub/platform.js` tests `"glibcVersionRuntime" in header`. On musl
that key is absent entirely, so the primary signal is inconclusive and the function falls
through to an `ldd --version` probe. DHI images ship no `ldd`, `execSync` throws, and the
catch checks whether the error text contains `"musl"` — `ldd: not found` does not, so musl
reads as glibc and the launcher resolves a package npm's `libc` filter never installed.

Ordinary Alpine has busybox's `ldd`, which is why this only surfaces on DHI. Installing
`@nubjs/nub-linux-arm64-musl` by hand does not help; the launcher wants the glibc name.
The glibc `dhi.io/node:26.5.1-debian-dev` works.

Separately, DHI's node images block npm install-scripts, so nub's `postinstall` — which
sets the execute bit on the platform binary — never runs. It needs
`npm install -g --allow-scripts=@nubjs/nub @nubjs/nub`.

Neither problem exists on the official nub image, where the binary ships preinstalled.

## Docker Hardened Images: practical notes

- The namespace is the registry root: `dhi.io/nginx`, `dhi.io/node`. Not
  `dhi.io/<org>/<image>`, and `_catalog` returns 404, so repositories cannot be enumerated.
- Runtime images having no shell turned out not to apply to `dhi.io/nginx:1.31.3-alpine`.
  Inspecting its filesystem shows busybox's `bin/sh`, `bin/ash`, `usr/bin/wget`, and
  `usr/bin/nc`, so both the Dockerfile `HEALTHCHECK` and the Compose `CMD-SHELL`
  healthcheck work without the larger `-compat` variant (4 MB against 11 MB).
- **Its writable paths differ from nginxinc's.** `nginx -V` reports
  `--prefix=/var/lib/nginx`, temp paths under `/var/lib/nginx/tmp/`, and
  `--pid-path=/run/nginx/nginx.pid`. A compose file carried over from `nginx-unprivileged`
  will tmpfs-mount `/var/cache/nginx` and crash-loop with
  `mkdir() "/var/lib/nginx/tmp/client_body" failed (30: Read-only file system)`.
- The image pre-creates those directories owned by 65532, but a tmpfs mount is created
  root-owned and shadows them, turning the read-only error into
  `(13: Permission denied)`. Compose's tmpfs options cannot set an owner, so the mounts use
  `mode: 0777`. That is acceptable here: the container drops every capability, sets
  `no-new-privileges`, and runs a single process.
- `image-publish.yml` needs `DHI_USERNAME` and `DHI_TOKEN` repository secrets. Without them
  the container build cannot pull the production base image.
