import assert from "node:assert/strict";
import { normalizeExtractedDocumentText } from "../server/knowledge/textExtractionNormalize.js";

assert.equal(
  normalizeExtractedDocumentText("מילה\u000bאחת"),
  "מילה אחת",
  "vertical tab must become space, not glue words",
);

assert.equal(
  normalizeExtractedDocumentText("שורה\u2028ראשונה"),
  "שורה ראשונה",
  "line separator must become space",
);

assert.equal(
  normalizeExtractedDocumentText("פסקה\u000cשנייה"),
  "פסקה שנייה",
  "form feed must become space",
);

assert.equal(
  normalizeExtractedDocumentText("שורה א\r\nשורה ב"),
  "שורה א\nשורה ב",
  "CRLF preserved as paragraph break",
);

console.log("text extraction normalize: all tests passed");
