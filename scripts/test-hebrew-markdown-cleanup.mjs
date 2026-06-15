import { cleanHebrewMarkdownArtifacts } from "../server/knowledge/assistantBidi.js";
import { sanitizeHebrewText } from "../server/knowledge/sanitizeHebrewText.js";

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
console.log(`All ${sanitizeCases.length + markdownCases.length} cases passed.`);
