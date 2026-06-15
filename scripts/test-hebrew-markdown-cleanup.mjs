import { cleanHebrewMarkdownArtifacts } from "../server/knowledge/assistantBidi.js";

const cases = [
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
for (const { in: input, want } of cases) {
  const got = cleanHebrewMarkdownArtifacts(input);
  const ok = got === want;
  if (!ok) {
    failed += 1;
    console.error("FAIL:", { input, want, got });
  } else {
    console.log("OK:", input);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`All ${cases.length} cases passed.`);
