/**
 * Join PDF/DOCX text runs and paragraphs without gluing words.
 * Keep in sync with src/lib/knowledge/documentTextAssembly.js
 */

const WHITESPACE = /\s/u;

/**
 * @param {string} existing
 * @param {string} segment
 * @param {" " | "\n"} [separator]
 */
export function appendTextSegment(existing, segment, separator = " ") {
  const piece = String(segment ?? "");
  if (!piece) return String(existing ?? "");

  let out = String(existing ?? "");
  if (!out) return piece;

  const prev = out[out.length - 1];
  const next = piece[0];
  if (WHITESPACE.test(prev) || WHITESPACE.test(next)) {
    return out + piece;
  }

  const sep = separator === "\n" ? "\n" : " ";
  if (sep === "\n") {
    if (!out.endsWith("\n")) out += "\n";
    return out + piece;
  }

  if (!out.endsWith("\n")) out += " ";
  return out + piece;
}

/**
 * @param {string[]} paragraphs
 */
export function joinTextParagraphs(paragraphs) {
  let out = "";
  for (const para of paragraphs || []) {
    const piece = String(para ?? "").trim();
    if (!piece) continue;
    out = appendTextSegment(out, piece, "\n");
  }
  return out;
}

/**
 * @param {string[]} runs
 */
export function joinInlineTextRuns(runs) {
  let out = "";
  for (const run of runs || []) {
    const piece = String(run ?? "");
    if (!piece) continue;
    out = appendTextSegment(out, piece, " ");
  }
  return out;
}
