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
import { FileFormat } from "../../enums/file.enum";
import { monaco as bundledMonaco } from "../../lib/utils/monacoSetup";
import { defineCatppuccinThemes, MONACO_THEME } from "../../lib/utils/monacoTheme";
import { yamlSchemaMarkers } from "../../lib/utils/yamlSchemaMarkers";
import useConfig from "../../store/useConfig";
import useFile from "../../store/useFile";

// Bundled by webpack, not fetched at runtime.
//
// This used to point at `https://unpkg.com/monaco-editor@0.55.1/min/vs` and then at a copy
// of monaco's AMD bundle under public/monaco/vs, which needed copy-monaco.mjs to keep the
// copy in step with the lockfile. Bundling drops that script and lets webpack hash the
// worker chunks like any other asset.
//
// The component is loaded through next/dynamic with ssr: false (see pages/editor.tsx), so
// importing monaco at module scope is safe.
loader.config({ monaco: bundledMonaco });

/** Marker owner, kept distinct so monaco's own diagnostics are never overwritten. */
const YAML_SCHEMA_MARKER_OWNER = "yaml-schema";

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

  /**
   * YAML schema validation.
   *
   * Runs in the main thread against the YAML AST instead of a language server worker. The
   * markers are owned by "yaml-schema" so they sit alongside, and never clobber, whatever
   * monaco's own languages report.
   */
  React.useEffect(() => {
    if (!monaco || fileType !== FileFormat.YAML) return;

    const model = monaco.editor.getModels().find(m => m.getLanguageId() === "yaml");
    if (!model) return;

    const result = yamlSchemaMarkers(contents, jsonSchema);

    if (result.kind === "unavailable") {
      setYamlValidatorError(result.reason);
      monaco.editor.setModelMarkers(model, YAML_SCHEMA_MARKER_OWNER, []);
      return;
    }

    setYamlValidatorError(null);
    monaco.editor.setModelMarkers(
      model,
      YAML_SCHEMA_MARKER_OWNER,
      result.markers.map(marker => {
        const start = model.getPositionAt(marker.startOffset);
        const end = model.getPositionAt(marker.endOffset);

        return {
          severity: monaco.MarkerSeverity.Error,
          message: marker.message,
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        };
      })
    );
  }, [monaco, fileType, contents, jsonSchema, setYamlValidatorError]);

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
