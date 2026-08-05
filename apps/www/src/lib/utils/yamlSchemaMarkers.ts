import Ajv, { type ErrorObject } from "ajv";
import { parseDocument, type Document } from "yaml";

/**
 * A schema violation located in the YAML source.
 *
 * Offsets are character indices into the document, which is what
 * `monaco.editor.ITextModel.getPositionAt` takes.
 */
export type YamlMarker = {
  startOffset: number;
  endOffset: number;
  message: string;
};

export type YamlMarkerResult =
  | { kind: "ok"; markers: YamlMarker[] }
  /** The schema could not be compiled, so nothing was checked. Never render this as a pass. */
  | { kind: "unavailable"; reason: string };

/**
 * Turn an ajv JSON Pointer into the path `Document.getIn` expects.
 *
 * Array indices have to become numbers: the YAML AST keys sequence items numerically, and
 * a string "0" would miss. Pointer escapes are unescaped per RFC 6901.
 */
const pointerToPath = (pointer: string): (string | number)[] =>
  pointer
    .split("/")
    .slice(1)
    .filter(segment => segment !== "")
    .map(segment => {
      const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      return /^\d+$/.test(key) ? Number(key) : key;
    });

/**
 * Find the source range for an error's path, walking up to the nearest ancestor that has
 * one.
 *
 * A "required property missing" error points at a node that by definition is not in the
 * document, so its own path resolves to nothing; the parent object is the closest thing
 * the user can be shown. Falling back to the whole document keeps every violation visible
 * rather than silently dropping the ones that cannot be placed.
 */
const rangeForPath = (doc: Document, path: (string | number)[]): [number, number] => {
  for (let end = path.length; end >= 0; end -= 1) {
    const node = end === 0 ? doc.contents : doc.getIn(path.slice(0, end), true);
    const range = (node as { range?: [number, number, number] } | null)?.range;

    if (range) return [range[0], range[1]];
  }

  return [0, 0];
};

const toMarker = (doc: Document, error: ErrorObject): YamlMarker => {
  const [startOffset, endOffset] = rangeForPath(doc, pointerToPath(error.instancePath));
  const property = error.instancePath || "/";

  return {
    startOffset,
    endOffset,
    message: `${property} ${error.message ?? "is invalid"}`,
  };
};

/**
 * Validate YAML against a JSON Schema and locate each violation in the source.
 *
 * Built on ajv plus the YAML AST rather than a language server. monaco-yaml, the obvious
 * choice, calls `monaco.editor.createWebWorker({ moduleId, label })`, an API monaco
 * dropped in 0.53 in favour of one where the caller supplies the Worker; its requests
 * therefore reach the generic editor worker and come back "Missing requestHandler". Going
 * through the AST needs no worker at all and keeps the whole thing a pure function.
 */
export const yamlSchemaMarkers = (text: string, schema: object | null): YamlMarkerResult => {
  if (!schema || !text.trim()) return { kind: "ok", markers: [] };

  let validate;
  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validate = ajv.compile(schema);
  } catch (error) {
    return {
      kind: "unavailable",
      reason: error instanceof Error ? error.message : "Schema could not be compiled",
    };
  }

  const doc = parseDocument(text);

  // A document that does not parse has its own syntax errors to report; a schema verdict
  // on half-read content would be noise on top of them.
  if (doc.errors.length > 0) return { kind: "ok", markers: [] };

  if (validate(doc.toJS())) return { kind: "ok", markers: [] };

  return { kind: "ok", markers: (validate.errors ?? []).map(error => toMarker(doc, error)) };
};
