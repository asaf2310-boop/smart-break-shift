/** Strict Hebrew–English BiDi rules for knowledge assistant answers (display + prompts). */

export const KNOWLEDGE_BIDI_RULES_HE = `
כללי BiDi עברית–אנגלית (מחייבים):
1. לעולם אל תערבב עברית ואנגלית באותה שורה בלי עיצוב Markdown מתאים.
2. כל מונח טכני, שם שדה או אפשרות תצורה באנגלית (למשל Invoice Options, Yaad, Hyp invoice) — עטוף תמיד ב-backticks: \`Invoice Options\`. זה מונע היפוך מילים וסימני פיסוק בתצוגה.
3. טקסט מ-OCR/PDF: פלט עברית נקייה וטבעית בלבד. אל תעתיק מילים שבורות או מחוברות (כמו "מתקדסבשה"). אם קטע מקור מקולקל — נסח מחדש בעברית תקינה על בסיס ההקשר.
4. פיסוק: סימני קריאה וסוגריים בתוך ההקשר העברי — לדוגמה "שימו לב!" ולא "!שימו לב".`;

export const KNOWLEDGE_BIDI_FORMAT_HINT = `${KNOWLEDGE_BIDI_RULES_HE}
Markdown:
- Bullet points ו-**bold** לנקודות מפתח
- מונחים באנגלית: תמיד \`backticks\`
- שלבים ממוספרים לתהליכים
- אם צורפו תמונות: בסוף JSON relevantImageIds`;

const HEBREW_CHAR = /[\u0590-\u05FF]/u;
const LATIN_RUN = /[A-Za-z][A-Za-z0-9_.&'/-]*/g;
const URL_PATTERN = /https?:\/\/[^\s<>\])"]+/g;

/** Leading punctuation wrongly placed before Hebrew (RTL display bug). */
function fixRtlPunctuation(line) {
  let s = String(line || "");
  s = s.replace(/^([!?.…]+)([\u0590-\u05FF])/u, "$2$1");
  s = s.replace(/(\s)([!?.…]+)([\u0590-\u05FF])/gu, "$1$3$2");
  s = s.replace(/([\u0590-\u05FF])\s+([!?.…])(?=\s|$)/gu, "$1$2");
  return s;
}

/** Split abnormally long glued Hebrew tokens from OCR. */
function fixGluedOcrHebrew(line) {
  return String(line || "").replace(/[\u0590-\u05FF]{10,}/gu, (word) => {
    const split = word
      .replace(/(שה|וב|מה|בה|לה|וה|אם|עם|כי|גם)(?=[\u0590-\u05FF]{2})/gu, " $1")
      .replace(/([\u0590-\u05FF]{4,})(ב|ל|מ|כ|ו)(?=[\u0590-\u05FF]{3})/gu, "$1 $2");
    return split.trim().replace(/\s{2,}/g, " ");
  });
}

function protectSegments(line, pattern, store) {
  let i = 0;
  return String(line || "").replace(pattern, (match) => {
    const key = `\uE000${i++}\uE001`;
    store.set(key, match);
    return key;
  });
}

function restoreSegments(line, store) {
  let out = String(line || "");
  for (const [key, value] of store) {
    out = out.split(key).join(value);
  }
  return out;
}

/** Wrap Latin runs in backticks when the line also contains Hebrew. */
function wrapEnglishTermsInLine(line) {
  const raw = String(line || "");
  if (!HEBREW_CHAR.test(raw) || !/[A-Za-z]/.test(raw)) return raw;

  const store = new Map();
  let s = protectSegments(raw, /`[^`\n]+`/g, store);
  s = protectSegments(s, URL_PATTERN, store);
  s = protectSegments(s, /\*\*[^*\n]+\*\*/g, store);

  s = s.replace(LATIN_RUN, (match) => {
    if (match.length < 2) return match;
    if (/^(IMG|http|www)$/i.test(match)) return match;
    return `\`${match}\``;
  });

  s = restoreSegments(s, store);
  return s.replace(/``+/g, "`");
}

function formatLineForBidi(line) {
  let s = String(line || "").replace(/[ \t]+/g, " ").trim();
  if (!s) return "";
  s = fixGluedOcrHebrew(s);
  s = fixRtlPunctuation(s);
  s = wrapEnglishTermsInLine(s);
  return s;
}

/**
 * Sanitize assistant answer text: OCR cleanup, punctuation, English term isolation.
 * Preserves markdown structure (lists, bold, code).
 */
export function formatAssistantBidiText(text) {
  let s = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!s) return "";

  const lines = s.split("\n");
  const out = lines.map((line) => formatLineForBidi(line));
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Linkify bare URLs after BiDi formatting. */
export function formatAssistantDisplayMarkdown(text) {
  let s = formatAssistantBidiText(text);
  if (!s) return "";

  const urlStore = new Map();
  let i = 0;
  s = s.replace(URL_PATTERN, (url) => {
    const key = `\uE002${i++}\uE003`;
    urlStore.set(key, url);
    return key;
  });

  s = s.replace(
    /(?<!\]\()https?:\/\/[^\s<>\])"]+(?!\))/g,
    (url) => `[${url}](${url})`,
  );

  for (const [key, url] of urlStore) {
    const linked = `[${url}](${url})`;
    s = s.split(key).join(linked);
  }

  return s;
}
