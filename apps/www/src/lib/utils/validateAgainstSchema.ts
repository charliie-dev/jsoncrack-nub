import Ajv, { type ErrorObject } from "ajv";

/**
 * One problem with the current document.
 *
 * `path` is whatever locator the producing validator can offer: ajv gives a JSON Pointer
 * such as `/author/email`, while Monaco markers give `line:column`. The pane renders it
 * verbatim, so the two can share this shape.
 */
export type SchemaIssue = {
  path: string;
  message: string;
};

/**
 * Outcome of validating the current document against the user's schema.
 *
 * `unavailable` exists so the status lamp never shows a green tick for a document that was
 * not actually checked. A schema that fails to compile, or a draft ajv cannot read, lands
 * here rather than silently passing.
 */
export type SchemaValidation = {
  status: "off" | "valid" | "invalid" | "unavailable";
  issues: SchemaIssue[];
  reason?: string;
};

export const SCHEMA_OFF: SchemaValidation = { status: "off", issues: [] };

const formatIssue = (error: ErrorObject): SchemaIssue => ({
  path: error.instancePath || "/",
  message: error.message ?? "is invalid",
});

/**
 * Validate a parsed document against a JSON Schema.
 *
 * strict is off because real-world schemas carry keywords ajv would otherwise reject
 * outright, and this is a viewer: refusing to validate is worse than tolerating an unknown
 * keyword. allErrors is on because the pane lists every problem, not just the first.
 *
 * Only draft-07 is supported. A schema declaring draft-04 or 2020-12 makes ajv throw at
 * compile time, which surfaces as `unavailable` with ajv's own message.
 */
export const validateAgainstSchema = (data: unknown, schema: object | null): SchemaValidation => {
  if (!schema) return SCHEMA_OFF;

  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);

    if (validate(data)) return { status: "valid", issues: [] };

    return {
      status: "invalid",
      issues: (validate.errors ?? []).map(formatIssue),
    };
  } catch (error) {
    return {
      status: "unavailable",
      issues: [],
      reason: error instanceof Error ? error.message : "Schema could not be compiled",
    };
  }
};
