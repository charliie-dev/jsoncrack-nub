import { latte, mocha } from "jsoncrack-react/palette";

/** The image formats the export offers, and the extension each is saved under. */
export const IMAGE_FORMATS = ["png", "jpeg", "svg"] as const;

export type ImageFormat = (typeof IMAGE_FORMATS)[number];

/** Data formats a loaded document may be named after, longest first so `.yaml` beats `.yml`. */
const DATA_EXTENSIONS = ["json", "yaml", "yml", "xml", "csv", "toml"];

const FALLBACK_NAME = "diagram";

/**
 * Characters a filesystem is entitled to object to.
 *
 * Spaces and dashes are not among them and are left alone: a document called
 * `my report.json` should export as `my report.png` rather than have its name run
 * together.
 */
const UNSAFE = /[\\/:*?"<>|]/g;

/**
 * What to call the image, given the document that produced it and nothing else.
 *
 * The document name is whatever the file was called when it was imported, so it usually
 * still carries its data extension. Appending the image one to that gives
 * `package.json.png`, which reads as a JSON file to anything sorting by suffix, so the
 * data extension is dropped — but only if it is one we recognise, since a name like
 * `v1.2` has a dot that means something else.
 */
export const exportBaseName = (documentName: string | null): string => {
  const trimmed = (documentName ?? "").replace(UNSAFE, "").trim();
  if (trimmed.length === 0) return FALLBACK_NAME;

  const lastDot = trimmed.lastIndexOf(".");
  const suffix = lastDot > 0 ? trimmed.slice(lastDot + 1).toLowerCase() : "";
  const base = DATA_EXTENSIONS.includes(suffix) ? trimmed.slice(0, lastDot) : trimmed;

  return base.length > 0 ? base : FALLBACK_NAME;
};

/** The base name with the chosen format's extension on it. */
export const exportFileName = (documentName: string | null, format: ImageFormat): string =>
  `${exportBaseName(documentName)}.${format}`;

/**
 * Background colours offered in the export dialog.
 *
 * Both flavours are listed rather than only the active one: which background an exported
 * image wants depends on where it is going to be pasted, not on how the editor happens to
 * be themed. Transparent leads because it is the one choice that defers the question.
 */
export const EXPORT_SWATCHES = [
  "transparent",
  mocha.crust,
  mocha.base,
  mocha.surface0,
  latte.crust,
  latte.base,
  latte.surface0,
  "#ffffff",
];

/**
 * Background the export starts on: the one the canvas is currently drawn on, so the image
 * matches what is on screen unless the user says otherwise.
 */
export const defaultExportBackground = (isDark: boolean): string =>
  isDark ? mocha.crust : latte.crust;
