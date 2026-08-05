import debounce from "lodash.debounce";
import { event as gaEvent } from "nextjs-google-analytics";
import { toast } from "react-hot-toast";
import { create } from "zustand";
import { FileFormat } from "../enums/file.enum";
import { isIframe } from "../lib/utils/helpers";
import { contentToJson, jsonToContent } from "../lib/utils/jsonAdapter";
import {
  SCHEMA_OFF,
  validateAgainstSchema,
  type SchemaIssue,
  type SchemaValidation,
} from "../lib/utils/validateAgainstSchema";
import useConfig from "./useConfig";
import useJson from "./useJson";

type SetContents = {
  contents?: string;
  hasChanges?: boolean;
  skipUpdate?: boolean;
  format?: FileFormat;
};

type Query = string | string[] | undefined;

interface JsonActions {
  getContents: () => string;
  getFormat: () => FileFormat;
  getHasChanges: () => boolean;
  setError: (error: string | null) => void;
  setHasChanges: (hasChanges: boolean) => void;
  setContents: (data: SetContents) => void;
  fetchUrl: (url: string) => void;
  setFormat: (format: FileFormat) => void;
  clear: () => void;
  setFile: (fileData: File) => void;
  setJsonSchema: (jsonSchema: object | null) => void;
  setMarkers: (markers: SchemaIssue[]) => void;
  setYamlValidatorError: (reason: string | null) => void;
  checkEditorSession: (url: Query, widget?: boolean) => void;
}

export type File = {
  id: string;
  views: number;
  owner_email: string;
  name: string;
  content: string;
  private: boolean;
  format: FileFormat;
  created_at: string;
  updated_at: string;
};

const initialStates = {
  fileData: null as File | null,
  format: FileFormat.JSON,
  // Empty until checkEditorSession restores a session or the user picks a format.
  contents: "",
  error: null as any,
  hasChanges: false,
  jsonSchema: null as object | null,
  /** Result of the ajv pass. Only XML and CSV use it; JSON and YAML produce Monaco markers. */
  schemaValidation: SCHEMA_OFF as SchemaValidation,
  /** Monaco's current diagnostics, kept in full so the pane can show a count. */
  markers: [] as SchemaIssue[],
  /**
   * Why the YAML validator is not running, or null when it is.
   *
   * Separate from schemaValidation because that field carries the ajv verdict and is reset
   * to "off" on every keystroke in a non-ajv format. Without this, a YAML document whose
   * validator failed to load would show a green tick, which is exactly the lie the
   * four-state lamp exists to prevent.
   */
  yamlValidatorError: null as string | null,
};

export type FileStates = typeof initialStates;

const isURL = (value: string) => {
  return /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi.test(
    value
  );
};

const debouncedUpdateJson = debounce((value: unknown) => {
  useJson.getState().setJson(JSON.stringify(value, null, 2));
}, 400);

const useFile = create<FileStates & JsonActions>()((set, get) => ({
  ...initialStates,
  clear: () => {
    set({ contents: "" });
    useJson.getState().clear();
  },
  // Re-run immediately: waiting for the next keystroke would leave the lamp showing the
  // previous schema's verdict.
  setJsonSchema: jsonSchema => {
    set({ jsonSchema });
    get().setContents({ hasChanges: false, skipUpdate: true });
  },
  setMarkers: markers => set({ markers }),
  setYamlValidatorError: yamlValidatorError => set({ yamlValidatorError }),
  setFile: fileData => {
    set({ fileData, format: fileData.format || FileFormat.JSON });
    get().setContents({ contents: fileData.content, hasChanges: false });
    gaEvent("set_content", { label: fileData.format });
  },
  getContents: () => get().contents,
  getFormat: () => get().format,
  getHasChanges: () => get().hasChanges,
  setFormat: async format => {
    try {
      const prevFormat = get().format;

      set({ format });
      const contentJson = await contentToJson(get().contents, prevFormat);
      const jsonContent = await jsonToContent(JSON.stringify(contentJson, null, 2), format);

      get().setContents({ contents: jsonContent });
    } catch {
      get().clear();
      console.warn("The content was unable to be converted, so it was cleared instead.");
    }
  },
  setContents: async ({ contents, hasChanges = true, skipUpdate = false, format }) => {
    try {
      set({
        // Compared against undefined, not truthiness: an empty string is a real value
        // here, and treating it as "no change" would make the editor impossible to clear.
        ...(contents !== undefined && { contents }),
        error: null,
        hasChanges,
        format: format ?? get().format,
      });

      const isFetchURL = window.location.href.includes("?");
      const json = await contentToJson(get().contents, get().format);

      // JSON is validated inline by Monaco and YAML by yamlSchemaMarkers, so running ajv
      // over them here as well would report every violation twice.
      const usesAjv = get().format === FileFormat.XML || get().format === FileFormat.CSV;
      set({
        schemaValidation: usesAjv ? validateAgainstSchema(json, get().jsonSchema) : SCHEMA_OFF,
      });

      if (!useConfig.getState().liveTransformEnabled && skipUpdate) return;

      if (get().hasChanges && contents && contents.length < 80_000 && !isIframe() && !isFetchURL) {
        sessionStorage.setItem("content", contents);
        sessionStorage.setItem("format", get().format);
        set({ hasChanges: true });
      }

      debouncedUpdateJson(json);
    } catch (error: any) {
      // The document did not parse, so the previous verdict describes text that no longer
      // exists. Clearing it stops the lamp reporting a stale pass.
      set({ schemaValidation: SCHEMA_OFF });
      if (error?.mark?.snippet) return set({ error: error.mark.snippet });
      if (error?.message) set({ error: error.message });
      useJson.setState({ loading: false });
    }
  },
  setError: error => set({ error }),
  setHasChanges: hasChanges => set({ hasChanges }),
  fetchUrl: async url => {
    try {
      const res = await fetch(url);
      const json = await res.json();
      const jsonStr = JSON.stringify(json, null, 2);

      get().setContents({ contents: jsonStr });
      return useJson.setState({ json: jsonStr, loading: false });
    } catch {
      get().clear();
      toast.error("Failed to fetch document from URL!");
    }
  },
  checkEditorSession: (url, widget) => {
    if (url && typeof url === "string" && isURL(url)) {
      return get().fetchUrl(url);
    }

    const sessionContent = sessionStorage.getItem("content") as string | null;
    const format = sessionStorage.getItem("format") as FileFormat | null;

    if (format) set({ format });

    // Deliberately empty when there is nothing to restore. The canvas shows a format
    // picker instead of a preloaded example, so a new user's first screen is a choice
    // rather than somebody else's data.
    get().setContents({ contents: widget ? "" : (sessionContent ?? ""), hasChanges: false });
  },
}));

export default useFile;
