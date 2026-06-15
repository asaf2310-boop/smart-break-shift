/** Gemini system prompt + user prompt assembly — Hebrew UX, grounding, Markdown. */

import { KNOWLEDGE_BIDI_FORMAT_HINT } from "./assistantBidi.js";

export const KNOWLEDGE_MISSING_ANSWER = "המידע המבוקש אינו נמצא במאגר הידע";

/** Machine-parseable footer — Gemini lists relevant screenshot IDs. */
export const RELEVANT_IMAGES_JSON_KEY = "relevantImageIds";

export const RELEVANT_IMAGES_JSON_EXAMPLE = '{"relevantImageIds":["IMG-1","IMG-2"]}';

export const RELEVANT_IMAGES_JSON_EMPTY = '{"relevantImageIds":[]}';

/** JSON block at end of model output (optional ```json fence). */
export const RELEVANT_IMAGES_JSON_REGEX =
  /(?:```(?:json)?\s*)?(\{\s*"relevantImageIds"\s*:\s*\[[^\]]*\]\s*\})(?:\s*```)?\s*$/s;

export const GEMINI_KNOWLEDGE_JSON_IMAGE_INSTRUCTIONS = `
4. פורמט JSON לתמונות (כשצורפו תמונות): בסוף התשובה, בשורה נפרדת, הוסף בלוק JSON ניתן ל-parse בדיוק בפורמט:
${RELEVANT_IMAGES_JSON_EXAMPLE}
- relevantImageIds: רשימת מזהי התמונות (IMG-N) הרלוונטיות להצגה לנציג.
- אם אין תמונות רלוונטיות: ${RELEVANT_IMAGES_JSON_EMPTY}
- אם לא צורפו תמונות — אל תוסיף בלוק JSON.`;

/** Verbatim system prompt for @google/genai structured JSON responses. */
export const GEMINI_AGENT_STRUCTURED_SYSTEM_PROMPT = `אתה עוזר חכם ומקצועי המוטמע במערכת ניהול ידע של נציגי שירות לקוחות.
תפקידך לספק תשובות מהירות, מדויקות וברורות בעברית על בסיס הקונטקסט (טקסט ותמונות) המצורף בלבד.

הנחיות מחייבות:
1. שפה ועיצוב: השב בעברית טבעית ורהוטה. השתמש במונחים מקצועיים נכונים. מעך את הטקסט לנקודות (Bullet Points) והדגשות (Bold) כדי שהנציג יוכל לקרוא את התשובה תוך כדי שיחה. אל תכתוב פסקאות ארוכות. עטוף מונחים באנגלית ב-backticks.
2. היצמדות לעובדות: ענה אך ורק על בסיס המידע המצורף (Context). אם המידע לא קיים בטקסט או בתמונות, השב: "${KNOWLEDGE_MISSING_ANSWER}". אל תמציא מידע בשום אופן. אם טקסט המקור מקולקל — נסח מחדש בעברית תקינה.
3. שילוב תמונות: מצורפים לקוד מזהים וקישורים של צילומי מסך רלוונטיים. אם התשובה דורשת מהנציג לבצע פעולה במערכת וצילום המסך המצורף מציג פעולה זו, ציין בסוף התשובה אילו תמונות רלוונטיות להצגה באמצעות ה-ID שלהן בפורמט ה-JSON המבוקש.`;

export const GEMINI_KNOWLEDGE_SYSTEM_PROMPT = `אתה עוזר חכם ומקצועי המוטמע במערכת ניהול ידע של נציגי שירות לקוחות.
תפקידך לספק תשובות מהירות, מדויקות וברורות בעברית על בסיס הקונטקסט (טקסט ותמונות) המצורף בלבד.

הנחיות מחייבות:
1. שפה ועיצוב: השב בעברית טבעית ורהוטה. השתמש במונחים מקצועיים נכונים. מעך את הטקסט לנקודות (Bullet Points) והדגשות (Bold) כדי שהנציג יוכל לקרוא את התשובה תוך כדי שיחה. אל תכתוב פסקאות ארוכות. עטוף מונחים באנגלית ב-backticks (למשל \`Invoice Options\`).
2. היצמדות לעובדות: ענה אך ורק על בסיס המידע המצורף (Context). אם המידע לא קיים בטקסט או בתמונות, השב: "${KNOWLEDGE_MISSING_ANSWER}". אל תמציא מידע בשום אופן. אם טקסט המקור מקולקל מ-OCR — נסח מחדש בעברית תקינה, אל תעתיק מילים שבורות.
3. שילוב תמונות: מצורפים לקוד מזהים וקישורים של צילומי מסך רלוונטיים. אם התשובה דורשת מהנציג לבצע פעולה במערכת וצילום המסך המצורף מציג פעולה זו, ציין בסוף התשובה אילו תמונות רלוונטיות להצגה באמצעות ה-ID שלהן בפורמט ה-JSON המבוקש.${GEMINI_KNOWLEDGE_JSON_IMAGE_INSTRUCTIONS}`;

export { KNOWLEDGE_BIDI_FORMAT_HINT };

export function isVisualFlowQuestion(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  return (
    /(?:צילום|מסך|תמונה|כפתור|ממשק|לחץ|סמן|UI|איפה\s+נמצא|היכן|מיקום|תפריט|הגדרות|חלון)/iu.test(q) ||
    /(?:screenshot|screen|button|click|where\s+is|menu|settings)/i.test(q)
  );
}

export function isHowToQuestion(query) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  return /^(איך|כיצד|מהן?\s+השלבים|מה\s+התהליך|תהליך|הסבר\s+איך)/u.test(q);
}

/** Strip the relevantImageIds JSON footer from model output. */
export function stripRelevantImagesMarker(text) {
  return String(text || "")
    .replace(RELEVANT_IMAGES_JSON_REGEX, "")
    .trim();
}

/**
 * Parse IMG-N labels from model JSON footer.
 * @returns {string[] | null} — null if marker absent, [] if explicitly empty
 */
export function parseRelevantImageLabels(text) {
  const match = String(text || "").match(RELEVANT_IMAGES_JSON_REGEX);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed.relevantImageIds)) return null;
    return parsed.relevantImageIds
      .map((id) => String(id).replace(/^\[|\]$/g, "").trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Build user prompt with RAG context blocks.
 * @param {string} query
 * @param {string} context — joined context blocks
 * @param {{ hasImages?: boolean, labeledImages?: Array<{ label: string, description: string }> }} [meta]
 */
export function buildGeminiUserPrompt(query, context, meta = {}) {
  const howTo = isHowToQuestion(query);
  const visual = isVisualFlowQuestion(query) || meta.hasImages;

  const imageSection =
    meta.labeledImages?.length > 0
      ? `\n\nצילומי מסך מצורפים (תוויות יציבות — השתמש בהן וב-relevantImageIds):\n${meta.labeledImages
          .map((img) => `[${img.label}] ${img.description}`)
          .join("\n")}`
      : meta.imageDescriptions?.length > 0
        ? `\n\nתיאורי תמונות/צילומי מסך רלוונטיים:\n${meta.imageDescriptions.map((d, i) => `[IMG-${i + 1}] ${d}`).join("\n")}`
        : "";

  const visualHint = visual
    ? "\n\nהשאלה קשורה לממשק/צילום מסך — הסבר לפי מה שמופיע בתמונה ובקטעי ההקשר."
    : "";

  const howToHint = howTo
    ? "\n\nסוג שאלה: הדרכה/תהליך — השתמש ברשימת שלבים ממוספרת."
    : "";

  const imageFooterHint = meta.hasImages
    ? `\n\nבסוף התשובה הוסף בלוק JSON ניתן ל-parse: ${RELEVANT_IMAGES_JSON_EXAMPLE} (או ${RELEVANT_IMAGES_JSON_EMPTY} אם אין תמונות רלוונטיות).`
    : "";

  return `קטעי הקשר מהמאגר (היחידים המותרים לשימוש):

${context || "(ריק — אין מידע)"}
${imageSection}

שאלת הנציג: ${query}
${howToHint}${visualHint}${imageFooterHint}

ענה לפי ההנחיות. אם אין מידע — "${KNOWLEDGE_MISSING_ANSWER}"`;
}

/** Detect if model output indicates missing knowledge (for guardrail). */
export function isMissingKnowledgeAnswer(text) {
  const t = String(text || "").trim();
  return (
    t.includes(KNOWLEDGE_MISSING_ANSWER) ||
    t.includes("לא מצאתי תשובה") ||
    t.includes("לא מצאתי מקור") ||
    t.includes("המידע אינו קיים במאגר הידע")
  );
}
