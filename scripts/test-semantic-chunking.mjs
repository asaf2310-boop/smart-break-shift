import { readFileSync } from "fs";
import { splitIntoSemanticBlocks } from "../server/knowledge/chunkingService.js";

const sample = `1. מה זה 3DS?

3D Secure הוא פרוטוקול אימות נוסף בעת תשלום בכרטיס.
האחריות עוברת לבית העסק רק לאחר אימות מוצלח.

2. מתי נדרש אימות?

- בעסקאות מעל סכום מסוים
- בחנויות מקוונות

### הערות חשובות

יש להסביר ללקוח את תהליך ה-OTP.
`;

const blocks = splitIntoSemanticBlocks(sample);

console.log("block count:", blocks.length);
for (const [i, b] of blocks.entries()) {
  console.log(`\n--- block ${i + 1}: ${b.sectionTitle || "(no title)"} ---`);
  console.log(b.text.slice(0, 120) + (b.text.length > 120 ? "…" : ""));
}

const section1 = blocks.find((b) => b.text.includes("1. מה זה 3DS"));
const ok =
  blocks.length === 3 &&
  section1 &&
  section1.text.includes("3D Secure") &&
  section1.text.includes("האחריות עוברת") &&
  !section1.text.includes("2. מתי");

if (!ok) {
  console.error("FAIL: semantic chunking did not keep section 1 intact");
  process.exit(1);
}

console.log("\nPASS: section 1 is a single semantic chunk with preserved spaces");
