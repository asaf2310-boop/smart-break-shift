/** Gemini system prompt + user prompt assembly — Hebrew UX, grounding, Markdown. */

import { KNOWLEDGE_BIDI_FORMAT_HINT } from "./assistantBidi.js";

export const KNOWLEDGE_MISSING_ANSWER = "המידע המבוקש אינו נמצא במאגר הידע הארגוני.";

export const GEMINI_STRICT_GROUNDING_RULE = `אם קטעי ההקשר לא עונים ישירות על השאלה, השב במדויק: "${KNOWLEDGE_MISSING_ANSWER}" אל תנסה לנחש, לאחות מילים שבורות, ולא לטעון שהשירות עמוס.`;

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
3. שילוב תמונות: מצורפים לקוד מזהים וקישורים של צילומי מסך רלוונטיים. אם התשובה דורשת מהנציג לבצע פעולה במערכת וצילום המסך המצורף מציג פעולה זו, ציין בסוף התשובה אילו תמונות רלוונטיות להצגה באמצעות ה-ID שלהן בפורמט ה-JSON המבוקש.
4. CRITICAL: כתוב תמיד רווח נפרד בין כל מילה עברית. ודא שמילים לא נדבקות (למשל "מוסיףשכבת" שגוי — נכון: "מוסיף שכבת").
5. ${GEMINI_STRICT_GROUNDING_RULE}`;

/** Step 1 — Google Search grounding; factual answer in English only. */
export const GEMINI_WEB_SEARCH_ENGLISH_SYSTEM_PROMPT = `Search the web and provide a comprehensive, factual answer to the user's query.
The user may write in Hebrew — understand the intent and search accordingly.
Output the response completely in English.
Use clear paragraphs or short bullet points. Stick to facts supported by search results.
Do not output Hebrew. Do not invent URLs or statistics.`;

/** Step 2 — translate English web-search draft into premium Hebrew Markdown. */
export const GEMINI_WEB_SEARCH_HEBREW_LOCALIZE_SYSTEM_PROMPT = `You are a professional technical translator for customer-support agents.
Translate the provided English text into flawless, natural, business-level Hebrew.

Strict rules:
1. Break the text into clean bullet points and **bold** highlights for key terms.
2. CRITICAL: explicit space characters between every single Hebrew word. Never concatenate words (wrong: "אימותנוסף" — correct: "אימות נוסף").
3. Wrap all English acronyms, numbers, or technical terms (like \`3D Secure\`, \`SMS\`, \`API\`) in backticks.
4. Keep the meaning faithful to the English source. Do not add new facts.
5. Short, scannable answer suitable for reading during a live call.`;

/** Legacy single-step Hebrew web search (replaced by two-step pipeline). */
export const GEMINI_WEB_SEARCH_SYSTEM_PROMPT = `אתה עוזר חכם ומקצועי לנציגי שירות לקוחות במערכת ניהול ידע.
הנציג ביקש חיפוש ברשת — אין לך כרגע קונטקסט ממאגר המסמכים הארגוני.

הנחיות מחייבות:
1. שפה ועיצוב: השב בעברית טבעית ורהוטה. השתמש בנקודות (Bullet Points) ו-**הדגשות** — לא פסקאות ארוכות. עטוף מונחים טכניים באנגלית ב-backticks (למשל \`3D Secure\`, \`API\`).
2. מקורות: הסתמך על תוצאות Google Search שסופקו לך ועל ידע כללי מעודכן. אם אינך בטוח — ציין זאת במפורש. אל תמציא קישורים, מספרים או מדיניות פנימית של החברה.
3. הפרדה ממאגר הידע: אל תטען שהמידע מגיע ממסמכי החברה. זו תשובה מחיפוש ברשת לצורך השלמה כשאין מידע במאגר.
4. סגנון לשיחה: תשובה קצרה ומעשית שהנציג יכול לקרוא תוך כדי שיחה עם לקוח.
5. CRITICAL: כתוב תמיד רווח נפרד בין כל מילה עברית. ודא שמילים לא נדבקות (למשל "מוסיףשכבת" שגוי — נכון: "מוסיף שכבת").`;

export const GEMINI_KNOWLEDGE_SYSTEM_PROMPT = `אתה עוזר חכם ומקצועי המוטמע במערכת ניהול ידע של נציגי שירות לקוחות.
תפקידך לספק תשובות מהירות, מדויקות וברורות בעברית על בסיס הקונטקסט (טקסט ותמונות) המצורף בלבד.

הנחיות מחייבות:
1. שפה ועיצוב: השב בעברית טבעית ורהוטה. השתמש במונחים מקצועיים נכונים. מעך את הטקסט לנקודות (Bullet Points) והדגשות (Bold) כדי שהנציג יוכל לקרוא את התשובה תוך כדי שיחה. אל תכתוב פסקאות ארוכות. עטוף מונחים באנגלית ב-backticks (למשל \`Invoice Options\`).
2. היצמדות לעובדות: ענה אך ורק על בסיס המידע המצורף (Context). אם המידע לא קיים בטקסט או בתמונות, השב: "${KNOWLEDGE_MISSING_ANSWER}". אל תמציא מידע בשום אופן. אם טקסט המקור מקולקל מ-OCR — נסח מחדש בעברית תקינה, אל תעתיק מילים שבורות.
3. שילוב תמונות: מצורפים לקוד מזהים וקישורים של צילומי מסך רלוונטיים. אם התשובה דורשת מהנציג לבצע פעולה במערכת וצילום המסך המצורף מציג פעולה זו, ציין בסוף התשובה אילו תמונות רלוונטיות להצגה באמצעות ה-ID שלהן בפורמט ה-JSON המבוקש.${GEMINI_KNOWLEDGE_JSON_IMAGE_INSTRUCTIONS}
4. CRITICAL: כתוב תמיד רווח נפרד בין כל מילה עברית. ודא שמילים לא נדבקות (למשל "מוסיףשכבת" שגוי — נכון: "מוסיף שכבת").
5. ${GEMINI_STRICT_GROUNDING_RULE}`;

/** Short welcome line for knowledge chat — simple Hebrew only (tokenization-safe). */
export const GEMINI_KNOWLEDGE_WELCOME_SYSTEM_PROMPT = `אתה כותב הודעת פתיחה קצרה לצ'אט ידע של נציגי שירות.

הנחיות מחייבות:
1. עברית פשוטה בלבד — מילים קצרות ונפוצות. משפטים ישירים. בלי ניסוח סביל ובלי מבנה מורכב.
2. CRITICAL: רווח נפרד בין כל מילה. אסור לחבר מילים (שגוי: "שאלשאלה", "עלבסיס", "המערכתהעלה").
3. שני משפטים לכל היותר. בלי Markdown, בלי רשימות, בלי כוכביות.
4. תוכן: ברכה קצרה + הסבר שניתן לשאול על מסמכי החברה + שהתשובה תכלול מקור.

דוגמה לסגנון (אל תעתיק מילה במילה): "שלום! שאלו כאן שאלות על המסמכים. כל תשובה תציין את המקור."`;

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

ענה לפי ההנחיות. ${GEMINI_STRICT_GROUNDING_RULE}`;
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
