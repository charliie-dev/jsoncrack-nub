type WorkerEnvironment = {
  getWorker?: (moduleId: string, label: string) => Worker;
  getWorkerUrl?: (moduleId: string, label: string) => string;
};

// Deliberately not intersected with globalThis: monaco-editor ships an ambient
// MonacoEnvironment declaration whose getWorker may also return a Promise, and satisfying
// both signatures at once buys nothing here.
const scope = globalThis as unknown as {
  MonacoEnvironment?: WorkerEnvironment;
};

let installed = false;

/**
 * Teach Monaco where the YAML worker lives, without disturbing how it finds the others.
 *
 * Monaco is loaded as an AMD bundle from /monaco/vs, so its own workers resolve through
 * whatever the loader put on `MonacoEnvironment`. monaco-yaml ships as an npm package
 * whose worker webpack has to emit, so the two use different mechanisms and must coexist:
 * only the `yaml` label is answered here and every other label is delegated back to
 * whatever was already installed.
 *
 * Call this from an editor's `beforeMount`, not at module scope. The AMD loader installs
 * its own environment while it boots, which happens after module evaluation, so wrapping
 * too early would capture nothing and then be overwritten.
 */
export const installYamlWorker = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const previous = scope.MonacoEnvironment;

  scope.MonacoEnvironment = {
    ...previous,
    getWorker: (moduleId, label) => {
      if (label === "yaml") {
        // Extension spelled out: monaco-yaml is `type: module` with no exports map, and
        // Next.js rejects the extensionless specifier as an ESM external it cannot inline.
        return new Worker(new URL("monaco-yaml/yaml.worker.js", import.meta.url));
      }

      if (previous?.getWorker) return previous.getWorker(moduleId, label);
      if (previous?.getWorkerUrl) return new Worker(previous.getWorkerUrl(moduleId, label));

      throw new Error(`monaco: no worker factory for label "${label}"`);
    },
  };
};
