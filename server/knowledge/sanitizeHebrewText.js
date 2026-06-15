/**
 * Fix Gemini Hebrew tokenization artifacts (glued words, broken spacing).
 * Keep in sync with src/lib/knowledge/sanitizeHebrewText.js
 */

/** Longest keys first so partial replacements do not block full fixes. */
const COMMON_HEBREW_TOKEN_FIXES = [
  ["רגולטוריות ויות", "רגולטוריות"],
  ["להטמעתועל", "להטמעה ועל"],
  ["הואפרוטוקול", "הוא פרוטוקול"],
  ["הואפרוט וקול", "הוא פרוטוקול"],
  ["שמוסיףשכבת", "שמוסיף שכבת"],
  ["מוסיףשכבת", "מוסיף שכבת"],
  ["רגולט וריות", "רגולטוריות"],
  ["פרוט וקול", "פרוטוקול"],
  ["נוספתבעת", "נוספת בעת"],
  ["זהותבעל", "זהות בעל"],
  ["בשמהמלא", "בשם המלא"],
  ["בתיעסק", "בתי עסק"],
  ["הואפרוט", "הוא פרוט"],
];

const HEBREW_FINAL_LETTER = /[םןץךף]/u;

/**
 * @param {string} text
 * @returns {string}
 */
export function sanitizeHebrewText(text) {
  if (!text) return "";

  let fixedText = String(text).replace(/\r\n/g, "\n");

  for (const [bad, good] of COMMON_HEBREW_TOKEN_FIXES) {
    fixedText = fixedText.split(bad).join(good);
  }

  // Final letter immediately followed by another Hebrew letter → two glued words.
  fixedText = fixedText.replace(/([םןץךף])([א-ת])/gu, "$1 $2");

  // Common glued prefix chains (e.g. שמוסיףשכבת).
  fixedText = fixedText.replace(/(ש[א-ת]{3,})([א-ת]{3,})/gu, (match, first, second) => {
    if (first.length >= 4 && second.length >= 3 && HEBREW_FINAL_LETTER.test(first.slice(-1)) === false) {
      return `${first} ${second}`;
    }
    return match;
  });

  // Broken trailing markdown punctuation (e.g. Shift).: or **).:
  fixedText = fixedText.replace(/\*\*\)\.\:/g, "**).:");
  fixedText = fixedText.replace(/\)\.\:/g, ").:");
  fixedText = fixedText.replace(/\)\:\./g, "):.");

  return fixedText.replace(/[ \t]{2,}/g, " ");
}
