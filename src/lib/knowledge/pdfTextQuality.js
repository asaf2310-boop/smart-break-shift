/** Detect PDF text-layer output that is not usable for Hebrew/English RAG. */

export function isPdfExtractedTextReadable(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length < 2) return false;

  const hebrew = (s.match(/[\u0590-\u05FF]/g) || []).length;
  const letters = (s.match(/\p{L}/gu) || []).length;
  const digits = (s.match(/\d/g) || []).length;

  if (hebrew >= 4) return true;
  if (letters > 0 && hebrew / letters >= 0.18) return true;
  if (/[A-Za-z]{4,}/.test(s) && hebrew === 0) return true;

  const tokens = s.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;

  const singleChar = tokens.filter((t) => t.length === 1).length;
  if (hebrew === 0 && tokens.length >= 3 && singleChar / tokens.length >= 0.45) {
    return false;
  }

  if (hebrew === 0 && letters <= 20 && digits <= 6 && !/[A-Za-z]{4,}/.test(s)) {
    return false;
  }

  return hebrew > 0 || s.length >= 48;
}

export function cleanPdfPageText(text) {
  const s = String(text || "").trim();
  return isPdfExtractedTextReadable(s) ? s : "";
}
