import * as monaco from "monaco-editor/editor/editor.api";
// Language contributions are side-effect imports. Only the four formats the editor offers
// are pulled in; importing basic-languages/monaco.contribution would register all ninety.
// CSV has no monaco language and falls back to plaintext, which is what it did before too.
import "monaco-editor/language/json/monaco.contribution";
import "monaco-editor/languages/definitions/xml/register";
import "monaco-editor/languages/definitions/yaml/register";

/**
 * Monaco, bundled by webpack rather than fetched at runtime.
 *
 * This replaces `loader.config({ paths: { vs: "/monaco/vs" } })`, which loaded monaco's
 * prebuilt AMD bundle from public/ and needed copy-monaco.mjs to keep that copy in step
 * with the lockfile. Bundling removes the script and lets webpack hash the worker chunks
 * like any other asset.
 *
 * Specifiers deliberately omit the `esm/vs/` prefix: monaco-editor's exports map rewrites
 * `./*.js` to `./esm/vs/*.js`, so spelling the prefix out produces a doubled path that
 * resolves to nothing.
 */
if (typeof window !== "undefined") {
  (globalThis as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      // No yaml entry: YAML schema validation runs on the main thread against the YAML AST
      // (see yamlSchemaMarkers) rather than through a language server worker.
      if (label === "json") {
        return new Worker(new URL("monaco-editor/language/json/json.worker.js", import.meta.url));
      }

      return new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url));
    },
  };
}

export { monaco };
