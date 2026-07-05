/**
 * Sanitize OpenAI JSON Schema for Gemini functionDeclarations (OpenAPI subset).
 * Gemini rejects `additionalProperties` and free-form object maps without `properties`.
 */

const STRIP_KEYS = new Set(["additionalProperties"]);

/**
 * @param {unknown} prop
 * @returns {Record<string, unknown>}
 */
export function sanitizeGeminiSchemaProperty(prop) {
  if (!prop || typeof prop !== "object" || Array.isArray(prop)) {
    return { type: "string" };
  }

  /** @type {Record<string, unknown>} */
  const src = /** @type {Record<string, unknown>} */ (prop);

  if (src.type === "object" && src.additionalProperties === true) {
    const desc = String(src.description || "").trim();
    return {
      type: "string",
      description: desc
        ? `${desc} — העבירו JSON, לדוגמה: {"status":"active"}`
        : 'מסננים כ-JSON, לדוגמה: {"status":"active"}',
    };
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (STRIP_KEYS.has(key)) continue;
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      /** @type {Record<string, unknown>} */
      const props = {};
      for (const [pk, pv] of Object.entries(value)) {
        props[pk] = sanitizeGeminiSchemaProperty(pv);
      }
      out.properties = props;
      continue;
    }
    if (key === "items") {
      out.items = sanitizeGeminiSchemaProperty(value);
      continue;
    }
    out[key] = value;
  }

  if (!out.type) out.type = "object";
  return out;
}

/**
 * @param {Record<string, unknown> | undefined} parameters
 */
export function sanitizeGeminiFunctionParameters(parameters) {
  if (!parameters || typeof parameters !== "object") {
    return { type: "object", properties: {} };
  }
  return sanitizeGeminiSchemaProperty(parameters);
}
