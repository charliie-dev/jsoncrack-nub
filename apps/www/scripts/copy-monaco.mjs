#!/usr/bin/env node
/**
 * Copies Monaco's prebuilt AMD bundle into public/monaco/vs so the editor loads from
 * this deployment instead of a CDN.
 *
 * Why this exists: @monaco-editor/react deliberately does not bundle Monaco (it is 24 MB)
 * and fetches it at runtime through an AMD loader. The default is a jsDelivr URL, and
 * this app used to hard-code `https://unpkg.com/monaco-editor@0.55.1/min/vs`. That made
 * the editor — the site root in this fork — depend on public CDN egress, so a self-hosted
 * instance on an intranet showed a loading overlay forever. The hard-coded version was
 * also invisible to the lockfile: it drifted to 0.55.1 while the installed package was
 * 0.56.0, so the types the bundle compiled against and the code the browser ran differed.
 *
 * Trimming uses a DENY list, not an allow list, on purpose. Monaco's filenames carry
 * content hashes (`editor-KLE6jdfb.js`), so an allow list silently loses files whenever a
 * hash changes and the editor breaks at runtime with no build error. A deny list fails the
 * other way: an unrecognised new file is copied, costing a little size and nothing else.
 */
import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Locate the installed package so the copied version always tracks the lockfile.
 *
 * Walking node_modules by hand rather than using require.resolve: monaco-editor's exports
 * map rewrites every subpath into esm/vs/, so both
 * `require.resolve("monaco-editor/package.json")` and
 * `require.resolve("monaco-editor/min/vs/loader.js")` resolve to paths that do not exist.
 * min/vs is real on disk but unreachable through the map.
 */
async function findPackageRoot(name) {
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    try {
      await stat(path.join(candidate, "package.json"));
      return candidate;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) {
        throw new Error(
          `copy-monaco: cannot find ${name} in any node_modules above ${process.cwd()}. Run 'nub install'.`
        );
      }
      dir = parent;
    }
  }
}

const packageRoot = await findPackageRoot("monaco-editor");
const srcDir = path.join(packageRoot, "min", "vs");
const destDir = path.resolve("public", "monaco", "vs");

/**
 * Paths under min/vs that this app never loads. The editor only ever opens JSON, YAML,
 * XML and CSV (see src/enums/file.enum.ts), and only JSON has a rich language service —
 * YAML and XML need syntax highlighting from basic-languages, which stays.
 *
 * Matched against the path relative to min/vs, with a trailing-glob style suffix match so
 * content hashes do not matter.
 */
const DENY = [
  "language/typescript", // 6.4 MB TypeScript language service
  "language/css",
  "language/html",
  "nls/lang", // UI translations; this deployment is English-only
];

/**
 * `ts.worker` used to be on the DENY list to save 6.7 MB, and it broke the editor.
 *
 * monaco 0.56's min/vs is a flat bundle whose editor.main.js declares every worker as an
 * AMD dependency up front, ts.worker included, regardless of which language services the
 * app actually uses. An AMD module whose dependency never resolves does not raise: the
 * loader simply waits, so the editor showed its loading spinner forever with a clean
 * console and a green build. The assertDependenciesResolvable check below is what makes
 * that failure mode loud, so a future attempt to trim a worker fails the build instead.
 */

/** Files that must exist afterwards, or the editor cannot load at all. */
const REQUIRED = ["loader.js", "editor", "basic-languages", "language/json", "assets"];

/**
 * Every module id listed in editor.main.js's `define(...)` dependency array must exist on
 * disk after the copy.
 *
 * Ids are relative to min/vs/editor. Those that already carry an extension are used
 * verbatim; the rest get `.js`, which is how the AMD loader resolves them.
 */
async function assertDependenciesResolvable(dest) {
  const entry = path.join(dest, "editor", "editor.main.js");
  const source = await readFile(entry, "utf8");
  const header = source.slice(0, source.indexOf("]"));
  const deps = [...header.matchAll(/"([^"]+)"/g)]
    .map(match => match[1])
    .filter(id => id.startsWith("../") || id.startsWith("./"));

  const unresolved = [];
  for (const id of deps) {
    const rel = id.endsWith(".js") ? id : `${id}.js`;
    try {
      await stat(path.resolve(dest, "editor", rel));
    } catch {
      unresolved.push(id);
    }
  }

  if (unresolved.length) {
    console.error(
      `copy-monaco: editor.main.js depends on modules missing from ${dest}: ${unresolved.join(", ")}.\n` +
        "An AMD dependency that never resolves leaves the editor spinning with no error. " +
        "Check the DENY list in apps/www/scripts/copy-monaco.mjs."
    );
    process.exit(1);
  }
}

const isDenied = rel => DENY.some(d => rel === d || rel.startsWith(`${d}/`) || rel.startsWith(`${d}-`));

async function copyFiltered(from, to, rel = "") {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (isDenied(relPath)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) await copyFiltered(src, dst, relPath);
    else await cp(src, dst);
  }
}

async function dirSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await stat(p)).size;
  }
  return total;
}

await rm(destDir, { recursive: true, force: true });
await copyFiltered(srcDir, destDir);

// Fail loudly rather than shipping a half-copied editor that only breaks in the browser.
const missing = [];
for (const req of REQUIRED) {
  try {
    await stat(path.join(destDir, req));
  } catch {
    missing.push(req);
  }
}
if (missing.length) {
  console.error(
    `copy-monaco: expected paths missing from ${destDir}: ${missing.join(", ")}.\n` +
      "Monaco's layout changed — review the DENY list in apps/www/scripts/copy-monaco.mjs."
  );
  process.exit(1);
}

await assertDependenciesResolvable(destDir);

const { version } = JSON.parse(
  await readFile(path.join(packageRoot, "package.json"), "utf8")
);
const mb = (await dirSize(destDir)) / 1024 / 1024;
console.log(`copy-monaco: monaco-editor@${version} -> public/monaco/vs (${mb.toFixed(1)} MB)`);
