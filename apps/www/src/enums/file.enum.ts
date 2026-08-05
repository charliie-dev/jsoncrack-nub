export enum FileFormat {
  JSON = "json",
  YAML = "yaml",
  XML = "xml",
  CSV = "csv",
}

/**
 * `accent` names a Catppuccin colour, resolved against the active flavour where the format
 * is rendered. Each format keeps the same hue everywhere it appears so the dropdown, the
 * empty-state cards and the bar all agree.
 */
export const formats = [
  { value: FileFormat.JSON, label: "JSON", accent: "blue" as const },
  { value: FileFormat.YAML, label: "YAML", accent: "green" as const },
  { value: FileFormat.XML, label: "XML", accent: "peach" as const },
  { value: FileFormat.CSV, label: "CSV", accent: "mauve" as const },
];

export enum TypeLanguage {
  TypeScript = "typescript",
  TypeScript_Combined = "typescript/typealias",
  Go = "go",
  JSON_SCHEMA = "json_schema",
  Kotlin = "kotlin",
  Rust = "rust",
}

export const typeOptions = [
  {
    label: "TypeScript",
    value: TypeLanguage.TypeScript,
    lang: "typescript",
  },
  {
    label: "TypeScript (merged)",
    value: TypeLanguage.TypeScript_Combined,
    lang: "typescript",
  },
  {
    label: "Go",
    value: TypeLanguage.Go,
    lang: "go",
  },
  {
    label: "JSON Schema",
    value: TypeLanguage.JSON_SCHEMA,
    lang: "json",
  },
  {
    label: "Kotlin",
    value: TypeLanguage.Kotlin,
    lang: "kotlin",
  },
  {
    label: "Rust",
    value: TypeLanguage.Rust,
    lang: "rust",
  },
];
