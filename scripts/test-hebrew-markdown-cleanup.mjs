import { cleanHebrewMarkdownArtifacts } from "../server/knowledge/assistantBidi.js";
import {
  sanitizeHebrewText,
  ultimateHebrewSanitizer,
  advancedHebrewSanitizer,
} from "../server/knowledge/sanitizeHebrewText.js";

const advancedCases = [
  { in: "הלקוחנדרש להזין פרטים", want: "הלקוח נדרש להזין פרטים" },
  { in: "לאכל הלקוחות", want: "לא כל הלקוחות" },
  { in: "הואראשי בתהליך", want: "הוא ראשי בתהליך" },
  { in: "כרטיס הונאות**).", want: "כרטיס הונאות**)." },
];

const ultimateCases = [
  { in: "בשלבזה מתבצע", want: "בשלב זה מתבצע" },
  { in: "תיבותשל הנתונים", want: "תיבות של הנתונים" },
  { in: "האחריותע וברת לבנק", want: "האחריות עוברת לבנק" },
  { in: "אימותש עברה בהצלחה", want: "אימות שעברה בהצלחה" },
  { in: "הגדרותהנתונים במערכת", want: "הגדרות הנתונים במערכת" },
  { in: "שהלקוחסולק את העסקה", want: "שהלקוח סולק את העסקה" },
  { in: "לאלבית העסק", want: "לבית העסק" },
];

const sanitizeCases = [
  { in: "הואראשי בתהליך", want: "הוא ראשי בתהליך" },
  { in: "אימותנוסף בעת תשלום", want: "אימות נוסף בעת תשלום" },
  { in: "לאלג וריתם מאובטח", want: "אלגוריתם מאובטח" },
  { in: "שאלשאלה עלבסיס המסמכים", want: "שאל שאלה על בסיס המסמכים" },
  { in: "המערכתהעלה מסמכים", want: "המערכת העלה מסמכים" },
  { in: "התשובה תתבססעל קטעים", want: "התשובה תתבסס על קטעים" },
  { in: "בתיעסק מקבלים תשלום", want: "בתי עסק מקבלים תשלום" },
  { in: "הואפרוט וקול מאובטח", want: "הוא פרוטוקול מאובטח" },
  { in: "שמוסיףשכבת אבטחה", want: "שמוסיף שכבת אבטחה" },
  { in: "רגולט וריות חשובות", want: "רגולטוריות חשובות" },
  { in: "נוספתבעת הרשמה", want: "נוספת בעת הרשמה" },
  { in: "יש להזין בשמהמלא של הלקוח", want: "יש להזין בשם המלא של הלקוח" },
  { in: "כרטיס הונאות**).", want: "כרטיס הונאות**)." },
  { in: "**הפחתת הונאות**).", want: "**הפחתת הונאות**)." },
  { in: "אימות `3DS` נוסף בעת תשלום", want: "אימות `3DS` נוסף בעת תשלום" },
  { in: "אחד,שניים", want: "אחד,שניים" },
];

const markdownCases = [
  {
    in: "נוספתבעת הרשמה",
    want: "נוספת בעת הרשמה",
  },
  {
    in: "יש להזין בשמהמלא של הלקוח",
    want: "יש להזין בשם המלא של הלקוח",
  },
  {
    in: "כרטיס הונאות**).",
    want: "(**כרטיס הונאות**).",
  },
  {
    in: "**הפחתת הונאות**).",
    want: "(**הפחתת הונאות**).",
  },
  {
    in: "אימות `3DS` נוסף בעת תשלום",
    want: "אימות `3DS` נוסף בעת תשלום",
  },
  {
    in: "אחד,שניים",
    want: "אחד, שניים",
  },
];

let failed = 0;

for (const { in: input, want } of advancedCases) {
  const got = advancedHebrewSanitizer(input);
  const ok = got === want;
  if (!ok) {
    failed += 1;
    console.error("advanced FAIL:", { input, want, got });
  } else {
    console.log("advanced OK:", input);
  }
}

for (const { in: input, want } of ultimateCases) {
  const got = ultimateHebrewSanitizer(input);
  const ok = got === want;
  if (!ok) {
    failed += 1;
    console.error("ultimate FAIL:", { input, want, got });
  } else {
    console.log("ultimate OK:", input);
  }
}

for (const { in: input, want } of sanitizeCases) {
  const got = sanitizeHebrewText(input);
  const ok = got === want;
  if (!ok) {
    failed += 1;
    console.error("sanitize FAIL:", { input, want, got });
  } else {
    console.log("sanitize OK:", input);
  }
}

for (const { in: input, want } of markdownCases) {
  const got = cleanHebrewMarkdownArtifacts(sanitizeHebrewText(input));
  const ok = got === want;
  if (!ok) {
    failed += 1;
    console.error("markdown FAIL:", { input, want, got });
  } else {
    console.log("markdown OK:", input);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`All ${advancedCases.length + ultimateCases.length + sanitizeCases.length + markdownCases.length} cases passed.`);
