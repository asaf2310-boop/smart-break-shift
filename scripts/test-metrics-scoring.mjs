/**
 * Run: npx vite-node scripts/test-metrics-scoring.mjs
 * Verifies unified cross-channel ranking with channel-specific weights.
 */
import {
  findCallsPerHourColumn,
  rankUnifiedMetricRows,
  computePhoneCallPointsPerHour,
  debugUnifiedRankingBreakdown,
} from "../src/lib/agentMetricsScoring.js";

const settings = { phoneCall: 1, whatsappCall: 0.5, email: 0.75, ticket: 0.75 };

const phoneColumns = [
  "שם נציג",
  "שיחות לשעה",
  "ממוצע שיחה בשעה",
  "זמן התחברות",
  "אחוז תיעוד",
  "כמות טיפול במיילים",
  "ממוצע משך שיחה",
  "אחוז אי זמינות",
];

const waColumns = [
  "שם נציג",
  "ממוצע שיחות WhatsApp לשעה",
  "כמות טיפול במיילים",
  "ממוצע זמן טיפול",
  "אחוז אי זמינות",
];

const phoneRow = {
  agent_name: "נציג טלפון",
  metrics: {
    "ממוצע שיחה בשעה": 10,
    "אחוז תיעוד": 88,
    "כמות טיפול במיילים": 42,
    "ממוצע משך שיחה": "6:39",
    "אחוז אי זמינות": 21,
  },
};

const waRow = {
  agent_name: "נציגת ווטסאפ",
  metrics: {
    "ממוצע שיחות WhatsApp לשעה": 12,
    "כמות טיפול במיילים": 58,
    "ממוצע זמן טיפול": "4:35",
    "אחוז אי זמינות": 18,
  },
};

console.log("=== Column selection (multi-match) ===");
console.log("best phone CPH col:", findCallsPerHourColumn(phoneColumns.slice(1)));
console.log("phone raw points:", computePhoneCallPointsPerHour(phoneRow, phoneColumns.slice(1), settings));

const ranked = rankUnifiedMetricRows({
  phoneRows: [phoneRow],
  phoneColumns,
  whatsappRows: [waRow],
  whatsappColumns: waColumns,
  pointSettings: settings,
});

console.log("\n=== Unified ranking across channels ===");
for (const r of ranked) {
  console.log(`  #${r._rank} ${r.agent_name} (${r._channel}) → ${r._compositeScore.toFixed(2)}`);
}

const phoneRankOk = ranked.find((r) => r.agent_name === "נציג טלפון")?._rank === 1;
const waRankOk = ranked.find((r) => r.agent_name === "נציגת ווטסאפ")?._rank === 2;
console.log(
  phoneRankOk && waRankOk
    ? "\n✓ PASS: unified ranking orders channels together"
    : "\n✗ FAIL: unified ranking is incorrect"
);

const phoneThroughput = ranked.find((r) => r.agent_name === "נציג טלפון")?._scoreBreakdown?.find(
  (part) => part.key === "callsPerHour"
);
const waThroughput = ranked.find((r) => r.agent_name === "נציגת ווטסאפ")?._scoreBreakdown?.find(
  (part) => part.key === "whatsappPerHour"
);
const halfWeightApplied =
  phoneThroughput &&
  waThroughput &&
  waThroughput.weighted < phoneThroughput.weighted &&
  Math.round(waThroughput.weighted) === 30 &&
  Math.round(phoneThroughput.weighted) === 50;
console.log(
  halfWeightApplied
    ? "✓ PASS: WhatsApp throughput contributes less than phone throughput"
    : "✗ FAIL: WhatsApp throughput is not discounted by point settings"
);

const phoneRowBad = {
  agent_name: "טלפון עמודה ריקה קודמת",
  metrics: {
    "שיחות לשעה": "",
    "ממוצע שיחה בשעה": 10,
    "אחוז תיעוד": 88,
    "כמות טיפול במיילים": 42,
    "ממוצע משך שיחה": "6:39",
    "אחוז אי זמינות": 21,
  },
};

const rankedBad = rankUnifiedMetricRows({
  phoneRows: [phoneRowBad],
  phoneColumns,
  whatsappRows: [waRow],
  whatsappColumns: waColumns,
  pointSettings: settings,
});

console.log("\n=== Regression: empty «שיחות לשעה» before real column ===");
console.log(
  "phone raw:",
  computePhoneCallPointsPerHour(phoneRowBad, phoneColumns.slice(1), settings)
);
for (const r of rankedBad) {
  console.log(`  #${r._rank} ${r.agent_name} → ${r._compositeScore.toFixed(2)}`);
}
const fixedEmptyCol =
  rankedBad.find((r) => r.agent_name === "טלפון עמודה ריקה קודמת")?._rank === 1;
console.log(fixedEmptyCol ? "✓ PASS: uses ממוצע שיחה בשעה despite empty col first" : "✗ FAIL");

console.log("\n=== Breakdown sample ===");
console.log(
  JSON.stringify(
    debugUnifiedRankingBreakdown({
      phoneRows: [phoneRow],
      phoneColumns,
      whatsappRows: [waRow],
      whatsappColumns: waColumns,
      pointSettings: settings,
    }),
    null,
    2
  )
);

if (!phoneRankOk || !waRankOk || !halfWeightApplied || !fixedEmptyCol) process.exit(1);
