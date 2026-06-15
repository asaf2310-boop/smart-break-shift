/**
 * Fix Gemini Hebrew tokenization artifacts (glued words, broken spacing).
 * Keep in sync with src/lib/knowledge/sanitizeHebrewText.js
 */

const HEBREW = "\u0590-\u05FF";

/** Longest keys first — 3DS document + extraction artifacts. */
const ULTIMATE_EXACT_FIXES = [
  ["לאלבית העסק", "לבית העסק"],
  ["האחריותע וברת", "האחריות עוברת"],
  ["האחריות ע וברת", "האחריות עוברת"],
  ["האחריותעוברת", "האחריות עוברת"],
  ["הגדרותהנתונים", "הגדרות הנתונים"],
  ["שהלקוחסולק", "שהלקוח סולק"],
  ["אימותש עברה", "אימות שעברה"],
  ["תיבותשל", "תיבות של"],
  ["בשלבזה", "בשלב זה"],
  ["לאלבית", "לא לבית"],
];

/** Longest keys first so partial replacements do not block full fixes. */
const COMMON_HEBREW_TOKEN_FIXES = [
  ["המערכת כתהעלה", "המערכת העלה"],
  ["המער כתהעלה", "המערכת העלה"],
  ["המערכתהעלה", "המערכת העלה"],
  ["לאלגוריתם", "אלגוריתם"],
  ["לאלג וריתם", "אלגוריתם"],
  ["אימותנוסף", "אימות נוסף"],
  ["הואראשי", "הוא ראשי"],
  ["רגולטוריות ויות", "רגולטוריות"],
  ["להטמעתועל", "להטמעה ועל"],
  ["הואפרוטוקול", "הוא פרוטוקול"],
  ["הואפרוט וקול", "הוא פרוטוקול"],
  ["שמוסיףשכבת", "שמוסיף שכבת"],
  ["מוסיףשכבת", "מוסיף שכבת"],
  ["שאלשאלה", "שאל שאלה"],
  ["תתבססעל", "תתבסס על"],
  ["רגולט וריות", "רגולטוריות"],
  ["פרוט וקול", "פרוטוקול"],
  ["נוספתבעת", "נוספת בעת"],
  ["זהותבעל", "זהות בעל"],
  ["בשמהמלא", "בשם המלא"],
  ["עלבסיס", "על בסיס"],
  ["בתיעסק", "בתי עסק"],
  ["שאלש", "שאלה"],
  ["הואפרוט", "הוא פרוט"],
];

const HEBREW_FINAL_LETTER = /[םןץךף]/u;
const FINAL_LETTER_GLUE = new RegExp(`([םןץךף])([${HEBREW}])`, "gu");

/** Gemini RAG / web-search response fixes — exact dictionary from product spec. */
const ADVANCED_HEBREW_SPLIT_DICTIONARY = {
  הואראשי: "הוא ראשי",
  תיבותשל: "תיבות של",
  אימותנוסף: "אימות נוסף",
  הלקוחנדרש: "הלקוח נדרש",
  בשלבזה: "בשלב זה",
  לאכל: "לא כל",
  לאלבית: "לא לבית",
  "האחריותע וברת": "האחריות עוברת",
  "האחריות ע וברת": "האחריות עוברת",
  "אימותש עברה": "אימות שעברה",
  הגדרותהנתונים: "הגדרות הנתונים",
  שהלקוחסולק: "שהלקוח סולק",
};

/**
 * Targeted Hebrew cleanup for Gemini answers (RAG + web search) before client delivery.
 * @param {string} text
 * @returns {string}
 */
export function advancedHebrewSanitizer(text) {
  if (!text) return text;
  let cleaned = text;

  cleaned = cleaned.replace(/([םןץךף])([א-ת])/gu, "$1 $2");

  for (const [bad, good] of Object.entries(ADVANCED_HEBREW_SPLIT_DICTIONARY)) {
    cleaned = cleaned.replace(new RegExp(bad, "g"), good);
  }

  cleaned = cleaned.replace(/\s*([).:])\s*(\*\*)/g, "$1$2");
  cleaned = cleaned.replace(/\)\.\:/g, ").:");

  return cleaned;
}
/** Broken syllable inside a word — e.g. "האחריותע וברת" → "האחריות עוברת" */
const BROKEN_INTERNAL_SPACE = new RegExp(
  `([${HEBREW}]{2,})([עבושל])\\s+([עובר][${HEBREW}]{1,4})`,
  "gu",
);

/**
 * Multi-layer Hebrew cleanup for extraction artifacts and broken OCR spacing.
 * @param {string} text
 * @returns {string}
 */
export function ultimateHebrewSanitizer(text) {
  if (!text) return text;

  let fixed = String(text);

  fixed = fixed.replace(FINAL_LETTER_GLUE, "$1 $2");

  for (const [bad, good] of ULTIMATE_EXACT_FIXES) {
    fixed = fixed.split(bad).join(good);
  }

  fixed = fixed.replace(BROKEN_INTERNAL_SPACE, "$1 $2$3");
  fixed = fixed.replace(/\s*([).:])\s*(\*\*)/g, "$1$2");

  return fixed;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function sanitizeHebrewText(text) {
  if (!text) return "";

  let fixedText = ultimateHebrewSanitizer(String(text).replace(/\r\n/g, "\n"));

  for (const [bad, good] of COMMON_HEBREW_TOKEN_FIXES) {
    fixedText = fixedText.split(bad).join(good);
  }

  fixedText = fixedText.replace(FINAL_LETTER_GLUE, "$1 $2");

  fixedText = fixedText.replace(/(ש[א-ת]{3,})([א-ת]{3,})/gu, (match, first, second) => {
    if (first.length >= 4 && second.length >= 3 && HEBREW_FINAL_LETTER.test(first.slice(-1)) === false) {
      return `${first} ${second}`;
    }
    return match;
  });

  fixedText = fixedText.replace(/\*\*\)\.\:/g, "**).:");
  fixedText = fixedText.replace(/\)\.\:/g, ").:");
  fixedText = fixedText.replace(/\)\:\./g, "):.");
  fixedText = fixedText.replace(/\s*([).:])\s*(\*\*)/g, "$1$2");

  return fixedText.replace(/[ \t]{2,}/g, " ");
}

/** Alias used in product docs — full sanitize pipeline. */
export const advancedHebrewPostProcess = sanitizeHebrewText;
