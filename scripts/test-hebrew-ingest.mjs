import { readFileSync } from "fs";

function stripBrokenMarkdownLinks(s) {
  let out = String(s || "");
  out = out.replace(/\[([^\]\n]{1,160})\]\([^)\n]{0,240}\)/g, "$1");
  out = out.replace(/\[[^\]\n]{1,160}\]\([^)\n]*$/g, "$1");
  out = out.replace(/\)\s*[-–—]\s*\[[^\]\n]{0,160}(?:\]|$)/g, "");
  out = out.replace(/\(\s*#?[^\s)\]]{1,100}(?:[.,;:]|\s*\))?/g, "");
  out = out.replace(/\(#[^\s)\]]{1,80}/g, "");
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  return out;
}

function stripAggressiveMarkdownFormatting(s) {
  let out = String(s || "");
  out = out.replace(/#{1,6}(?=\s|[\u0590-\u05FF])/g, " ");
  out = out.replace(/^#{1,6}\s*/gm, "");
  out = out.replace(/^\s*[-*+]\s+/gm, "");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/\*{2,}/g, "");
  out = out.replace(/_{2,}/g, "");
  out = out.replace(/`([^`\n]+)`/g, "$1");
  out = out.replace(/`+/g, "");
  out = out.replace(/<\/?[a-z][^>]*>/gi, " ");
  out = out.replace(/(?:^|\s)[-*•]\s+/gm, " ");
  return out;
}

function separateHebrewLatinGlue(s) {
  return String(s || "")
    .replace(/([\u0590-\u05FF])([A-Za-z0-9])/g, "$1 $2")
    .replace(/([A-Za-z0-9])([\u0590-\u05FF])/g, "$1 $2");
}

const HEBREW_CHAR = /[\u0590-\u05FF]/u;

function rejoinShortSingleLetterRuns(text) {
  const full = String(text || "");
  return full.replace(/(?:[\u0590-\u05FF](?:\s+[\u0590-\u05FF]){1,5})/gu, (run, offset) => {
    const parts = run.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 6 || !parts.every((p) => p.length === 1)) {
      return run;
    }
    const before = full[offset - 1];
    const after = full[offset + run.length];
    if (before && HEBREW_CHAR.test(before)) return run;
    if (after && HEBREW_CHAR.test(after)) return run;
    return parts.join("");
  });
}

function normalizeHebrewTextSingleLine(text) {
  let s = String(text || "")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!s) return "";
  s = s.replace(/[ \t]+([,.;:!?…])/g, "$1");
  s = s.replace(/([,.;:!?…])(?=[\u0590-\u05FF])/g, "$1 ");
  s = rejoinShortSingleLetterRuns(s);
  return s.replace(/[ \t]+/g, " ").trim();
}

function normalizeHebrewText(text, options = {}) {
  if (options.preserveLines === true) {
    return String(text || "")
      .split("\n")
      .map((line) => normalizeHebrewTextSingleLine(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return normalizeHebrewTextSingleLine(String(text || "").replace(/\s+/g, " ").trim());
}

function sanitizeChunkText(text, options = {}) {
  const preserveLines = options.preserveLines === true;
  const keepMarkdown = options.keepMarkdown === true;
  let s = String(text || "");
  s = stripBrokenMarkdownLinks(s);
  if (!keepMarkdown) s = stripAggressiveMarkdownFormatting(s);
  s = separateHebrewLatinGlue(s);
  return normalizeHebrewText(s, { preserveLines });
}

const raw = readFileSync("c:/Users/asafar/Downloads/s/hyp-pay-api-he.md", "utf8");
const line = raw.split("\n").find((l) => l.includes("Hyp Pay הוא"));
const md = sanitizeChunkText(raw.slice(0, 3000), { preserveLines: true, keepMarkdown: true });
const mig = sanitizeChunkText(raw.slice(0, 3000));
const hasWordSpaces = (s) => /שער [\u0590-\u05FF]/.test(s) || /הוא שער/.test(s);
const gluedRuns = (s) => (s.match(/[\u0590-\u05FF]{25,}/g) || []).slice(0, 2);

console.log("source line:", line?.slice(0, 80));
console.log("md ingest spaces ok:", hasWordSpaces(md));
console.log("migration spaces ok:", hasWordSpaces(mig));
console.log("md glued runs:", gluedRuns(md));
console.log("migration glued runs:", gluedRuns(mig));
console.log("md sample:", md.split("\n").find((l) => l.includes("Hyp Pay"))?.slice(0, 100));

const tocLine = "- [סקירת Hyp Pay](#סקירת-hyp-pay)";
let s = tocLine;
s = stripBrokenMarkdownLinks(s);
console.log("toc after links:", JSON.stringify(s));
s = separateHebrewLatinGlue(s);
console.log("toc after glue:", JSON.stringify(s));
s = normalizeHebrewText(s, { preserveLines: true });
console.log("toc after norm:", JSON.stringify(s));

const bodyLine =
  'Hyp Pay הוא שער תשלומים ישראלי מוביל. בשמו הקודם "YaadPay", הוא מספק דרך מאובטחת';
s = stripBrokenMarkdownLinks(bodyLine);
console.log("body after links:", JSON.stringify(s));
s = separateHebrewLatinGlue(s);
console.log("body after he-lat:", JSON.stringify(s));
s = normalizeHebrewTextSingleLine(s);
console.log("body after norm1:", JSON.stringify(s));
console.log("body glued?", /[\u0590-\u05FF]{15,}/.test(s));

// isolate rejoin
const afterGlue = separateHebrewLatinGlue(stripBrokenMarkdownLinks(bodyLine));
console.log("rejoin only:", JSON.stringify(rejoinShortSingleLetterRuns(afterGlue)));

const ok =
  hasWordSpaces(md) &&
  !gluedRuns(md).length &&
  hasWordSpaces(sanitizeChunkText(bodyLine, { preserveLines: true, keepMarkdown: true }));
console.log(ok ? "PASS: Hebrew word spaces preserved" : "FAIL: ingest still glues Hebrew");
process.exit(ok ? 0 : 1);
