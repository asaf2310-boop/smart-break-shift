import assert from "node:assert/strict";
import {
  appendTextSegment,
  joinInlineTextRuns,
  joinTextParagraphs,
} from "../src/lib/knowledge/documentTextAssembly.js";

assert.equal(appendTextSegment("", "שלום"), "שלום");
assert.equal(appendTextSegment("שלום", "עולם"), "שלום עולם");
assert.equal(appendTextSegment("שלום", "עולם", "\n"), "שלום\nעולם");
assert.equal(appendTextSegment("שורה\n", "הבאה", "\n"), "שורה\nהבאה");
assert.equal(appendTextSegment("להגדיר", "את"), "להגדיר את");

const pdfLike = [
  { str: "להגדיר", transform: [12, 0, 0, 12, 100, 700], hasEOL: false },
  { str: "את", transform: [12, 0, 0, 12, 60, 700], hasEOL: true },
  { str: "המערכת", transform: [12, 0, 0, 12, 100, 680], hasEOL: false },
];
let text = "";
let lastY = null;
for (const item of pdfLike) {
  const y = item.transform[5];
  const sameLine = lastY !== null && Math.abs(y - lastY) <= 4;
  const separator = !text.length ? null : sameLine ? " " : "\n";
  text = separator ? appendTextSegment(text, item.str, separator) : item.str;
  if (item.hasEOL && !text.endsWith("\n")) text += "\n";
  lastY = y;
}
assert.equal(text, "להגדיר את\nהמערכת");

assert.equal(
  joinTextParagraphs(["פסקה ראשונה", "פסקה שנייה"]),
  "פסקה ראשונה\nפסקה שנייה",
);
assert.equal(joinInlineTextRuns(["3DS", "Secure"]), "3DS Secure");

console.log("document text assembly: all tests passed");
