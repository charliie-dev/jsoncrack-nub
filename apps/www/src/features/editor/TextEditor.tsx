import React, { useCallback } from "react";
import { LoadingOverlay } from "@mantine/core";
import styled from "styled-components";
import Editor, {
  type BeforeMount,
  type EditorProps,
  loader,
  type OnMount,
  useMonaco,
} from "@monaco-editor/react";
import type { MonacoYaml } from "monaco-yaml";
import { defineCatppuccinThemes, MONACO_THEME } from "../../lib/utils/monacoTheme";
import { installYamlWorker } from "../../lib/utils/monacoYamlWorker";
import useConfig from "../../store/useConfig";
import useFile from "../../store/useFile";

// Served from this deployment, not a CDN. Monaco is 24 MB, so @monaco-editor/react
// fetches it at runtime rather than bundling it; the assets are copied into
// public/monaco/vs by apps/www/scripts/copy-monaco.mjs, which runs before dev and build.
//
// This used to point at `https://unpkg.com/monaco-editor@0.55.1/min/vs`, which made the
// editor — the site root in this fork — depend on public CDN egress, so a self-hosted
// instance behind a firewall showed a loading overlay forever. The version was also a
// bare string no tool maintained: it had drifted to 0.55.1 while the installed package
// was 0.56.0. The copy script resolves the package, so the version now tracks the
// lockfile.
loader.config({
  paths: {
    vs: "/monaco/vs",
  },
});

/**
 * `configureMonacoYaml` returns a `MonacoYaml`, declared as `extends IDisposable` from
 * monaco-types. monaco-types@0.1.2 does not actually export `IDisposable`, so the
 * inherited `dispose` vanishes from the resolved type even though it exists at runtime.
 * monaco-yaml pins no version for monaco-types, so this is a version-pairing gap rather
 * than something wrong on our side.
 */
type DisposableMonacoYaml = MonacoYaml & { dispose: () => void };

const editorOptions: EditorProps["options"] = {
  tabSize: 2,
  formatOnType: true,
  minimap: { enabled: false },
  stickyScroll: { enabled: false },
  scrollBeyondLastLine: false,
  placeholder: "Start typing...",
};

const TextEditor = () => {
  const monaco = useMonaco();
  const contents = useFile(state => state.contents);
  const setContents = useFile(state => state.setContents);
  const setError = useFile(state => state.setError);
  const setMarkers = useFile(state => state.setMarkers);
  const setYamlValidatorError = useFile(state => state.setYamlValidatorError);
  const jsonSchema = useFile(state => state.jsonSchema);
  const getHasChanges = useFile(state => state.getHasChanges);
  const theme = useConfig(state =>
    state.darkmodeEnabled ? MONACO_THEME.dark : MONACO_THEME.light
  );
  const fileType = useFile(state => state.format);
  const jsonDefaults = (monaco?.languages as any)?.json?.jsonDefaults as
    { setDiagnosticsOptions: (options: unknown) => void } | undefined;

  React.useEffect(() => {
    if (!jsonDefaults) return;

    jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      enableSchemaRequest: true,
      ...(jsonSchema && {
        schemas: [
          {
            uri: "http://myserver/foo-schema.json",
            fileMatch: ["*"],
            schema: jsonSchema,
          },
        ],
      }),
    });
  }, [jsonDefaults, jsonSchema]);

  React.useEffect(() => {
    if (!monaco) return;

    let disposed = false;
    let handle: DisposableMonacoYaml | undefined;

    // monaco-yaml allows only one configured instance at a time, so the handle is disposed
    // and rebuilt when the schema changes rather than layering a second one. Dynamic import
    // keeps its worker out of the initial bundle for the sessions that never touch YAML.
    //
    // The catch is load-bearing, not defensive noise: without it a failure here becomes an
    // unhandled rejection in the console while the lamp goes on showing a green tick for a
    // YAML document nothing validated.
    void import("monaco-yaml")
      .then(({ configureMonacoYaml }) => {
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
        }) as DisposableMonacoYaml;

        setYamlValidatorError(null);
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setYamlValidatorError(
          error instanceof Error ? error.message : "The YAML validator failed to load"
        );
      });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [monaco, jsonSchema, setYamlValidatorError]);

  React.useEffect(() => {
    const beforeunload = (e: BeforeUnloadEvent) => {
      if (getHasChanges()) {
        const confirmationMessage =
          "Unsaved changes, if you leave before saving  your changes will be lost";

        (e || window.event).returnValue = confirmationMessage; //Gecko + IE
        return confirmationMessage;
      }
    };

    window.addEventListener("beforeunload", beforeunload);

    return () => {
      window.removeEventListener("beforeunload", beforeunload);
    };
  }, [getHasChanges]);

  const handleBeforeMount: BeforeMount = useCallback(monacoInstance => {
    defineCatppuccinThemes(monacoInstance);
    installYamlWorker();
  }, []);

  const handleMount: OnMount = useCallback(editor => {
    editor.onDidPaste(() => {
      editor.getAction("editor.action.formatDocument")?.run();
    });
  }, []);

  return (
    <StyledEditorWrapper>
      <StyledWrapper>
        <Editor
          height="100%"
          language={fileType}
          theme={theme}
          value={contents}
          options={editorOptions}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onValidate={markers => {
            // Monaco reports line and column rather than a JSON Pointer. The pane shows
            // that position verbatim: JSON and YAML violations are already underlined in
            // the editor, so this list is a count and a summary, not the way to find them.
            setMarkers(
              markers.map(marker => ({
                path: `${marker.startLineNumber}:${marker.startColumn}`,
                message: marker.message,
              }))
            );
            setError(markers[0]?.message || "");
          }}
          onChange={contents => setContents({ contents, skipUpdate: true })}
          loading={<LoadingOverlay visible />}
        />
      </StyledWrapper>
    </StyledEditorWrapper>
  );
};

export default TextEditor;

const StyledEditorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  user-select: none;
`;

const StyledWrapper = styled.div`
  display: grid;
  height: 100%;
  grid-template-columns: 100%;
  grid-template-rows: minmax(0, 1fr);
`;
