import { isTeamAverageLabel } from "@/lib/agentMetricsImport";
import {
  isDurationMinutesColumn,
  metricValueForScoring,
} from "@/lib/agentMetricsFormat";

const SCORE_WEIGHTS = {
  callsPerHour: 0.5,
  documentation: 0.2,
  unavailability: 0.1,
  emailHandling: 0.1,
  avgDuration: 0.1,
};

const CALLS_PER_HOUR_HEADERS = new Set([
  "שיחות ממוצע לשעה",
  "ממוצע שיחות לשעה",
  "שיחות לשעה",
  "שיחות/שעה",
  "calls per hour",
  "cph",
  "avg calls per hour",
]);

const DOCUMENTATION_HEADERS = new Set([
  "תיעוד",
  "תיעוד %",
  "אחוז תיעוד",
  "איכות תיעוד",
  "עמידה בתיעוד",
  "documentation",
  "doc rate",
  "documentation rate",
]);

const UNAVAILABILITY_HEADERS = new Set([
  "אי זמינות",
  "אי זמינות %",
  "אחוז אי זמינות",
  "לא זמין",
  "unavailability",
  "unavailable",
  "unavailable %",
]);

const EMAIL_HANDLING_HEADERS = new Set([
  "כמות טיפול במיילים",
  "טיפול במיילים",
  "מיילים",
  "כמות מיילים",
  "מספר מיילים",
  "email handling",
  "emails handled",
  "email count",
]);

const AVG_DURATION_HEADERS = new Set([
  "ממוצע משך שיחה (דק)",
  "ממוצע משך שיחה",
  "משך שיחה ממוצע",
  "avg handle time",
  "aht",
  "average handle time",
]);

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function findCallsPerHourColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (CALLS_PER_HOUR_HEADERS.has(norm)) return col;
    if (norm.includes("שיחות") && norm.includes("שעה")) return col;
    if (norm.includes("calls") && norm.includes("hour")) return col;
  }
  return null;
}

export function findDocumentationColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (DOCUMENTATION_HEADERS.has(norm)) return col;
    if (norm.includes("תיעוד")) return col;
    if (norm.includes("documentation") || norm.includes("doc rate")) return col;
  }
  return null;
}

export function findUnavailabilityColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (UNAVAILABILITY_HEADERS.has(norm)) return col;
    if (norm.includes("אי זמינות") || norm.includes("לא זמין")) return col;
    if (norm.includes("unavail")) return col;
  }
  return null;
}

export function findEmailHandlingColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (EMAIL_HANDLING_HEADERS.has(norm)) return col;
    if (norm.includes("מייל") && (norm.includes("טיפול") || norm.includes("כמות") || norm.includes("מספר"))) {
      return col;
    }
    if (norm.includes("email") && (norm.includes("handl") || norm.includes("count"))) return col;
  }
  return null;
}

export function findAvgCallDurationColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (AVG_DURATION_HEADERS.has(norm)) return col;
    if (
      (norm.includes("משך") || norm.includes("aht") || norm.includes("handle")) &&
      (norm.includes("שיחה") || norm.includes("call") || norm.includes("ממוצע") || norm.includes("avg"))
    ) {
      return col;
    }
  }
  for (const col of columns) {
    if (isDurationMinutesColumn(col)) return col;
  }
  return null;
}

function normalizeSeries(values, { higherIsBetter = true } = {}) {
  const nums = values.map((v) => (v === null ? null : v));
  const present = nums.filter((v) => v !== null);
  if (!present.length) return nums.map(() => 0);
  const min = Math.min(...present);
  const max = Math.max(...present);
  if (max === min) return nums.map((v) => (v === null ? 0 : 1));
  return nums.map((v) => {
    if (v === null) return 0;
    const ratio = (v - min) / (max - min);
    return higherIsBetter ? ratio : 1 - ratio;
  });
}

function buildScoreComponents(metricColumns = []) {
  const callsCol = findCallsPerHourColumn(metricColumns);
  const docCol = findDocumentationColumn(metricColumns);
  const unavailCol = findUnavailabilityColumn(metricColumns);
  const emailCol = findEmailHandlingColumn(metricColumns);
  const durationCol = findAvgCallDurationColumn(metricColumns);

  return [
    { key: "callsPerHour", col: callsCol, weight: SCORE_WEIGHTS.callsPerHour, higherIsBetter: true },
    { key: "documentation", col: docCol, weight: SCORE_WEIGHTS.documentation, higherIsBetter: true },
    {
      key: "unavailability",
      col: unavailCol,
      weight: SCORE_WEIGHTS.unavailability,
      higherIsBetter: false,
    },
    { key: "emailHandling", col: emailCol, weight: SCORE_WEIGHTS.emailHandling, higherIsBetter: true },
    { key: "avgDuration", col: durationCol, weight: SCORE_WEIGHTS.avgDuration, higherIsBetter: false },
  ].filter((item) => item.col);
}

/**
 * ציון משוקלל: 50% שיחות/שעה · 20% תיעוד · 10% אי זמינות · 10% מיילים · 10% ממוצע משך שיחה.
 * @param {Array<{ agent_name?: string, agentName?: string, metrics: Record<string, unknown>, id?: string }>} rows
 * @param {string[]} columns
 */
export function rankMetricRows(rows = [], columns = []) {
  const agentRows = rows.filter(
    (row) => !isTeamAverageLabel(row.agent_name || row.agentName)
  );
  if (!agentRows.length) return [];

  const metricColumns = columns.slice(1);
  const components = buildScoreComponents(metricColumns);
  const activeWeight = components.reduce((sum, item) => sum + item.weight, 0);

  const normByComponent = components.map(({ col, higherIsBetter }) => {
    const vals = agentRows.map((r) => metricValueForScoring(r.metrics?.[col], col));
    return normalizeSeries(vals, { higherIsBetter });
  });

  const scored = agentRows.map((row, index) => {
    let compositeScore = 0;
    if (activeWeight > 0) {
      components.forEach((comp, compIndex) => {
        const share = comp.weight / activeWeight;
        compositeScore += share * (normByComponent[compIndex][index] ?? 0);
      });
    }

    return {
      ...row,
      agent_name: row.agent_name || row.agentName,
      _compositeScore: compositeScore,
      _rank: 0,
    };
  });

  scored.sort((a, b) => b._compositeScore - a._compositeScore);
  scored.forEach((row, i) => {
    row._rank = i + 1;
  });

  return scored;
}

export function getMetricsRankingNote(columns = []) {
  const metricColumns = columns.slice(1);
  const components = buildScoreComponents(metricColumns);
  const parts = [];

  if (components.find((c) => c.key === "callsPerHour")) {
    parts.push("50% שיחות ממוצע לשעה");
  }
  if (components.find((c) => c.key === "documentation")) {
    parts.push("20% תיעוד");
  }
  if (components.find((c) => c.key === "unavailability")) {
    parts.push("10% אי זמינות (פחות = טוב יותר)");
  }
  if (components.find((c) => c.key === "emailHandling")) {
    parts.push("10% כמות טיפול במיילים");
  }
  if (components.find((c) => c.key === "avgDuration")) {
    parts.push("10% ממוצע משך שיחה (קצר יותר = טוב יותר)");
  }

  if (!parts.length) {
    return "ציון משוקלל: הוסיפו לקובץ עמודות שיחות ממוצע לשעה, תיעוד, אי זמינות, כמות טיפול במיילים וממוצע משך שיחה.";
  }

  const missing = [];
  if (!components.find((c) => c.key === "callsPerHour")) missing.push("שיחות ממוצע לשעה (50%)");
  if (!components.find((c) => c.key === "documentation")) missing.push("תיעוד (20%)");
  if (!components.find((c) => c.key === "unavailability")) missing.push("אי זמינות (10%)");
  if (!components.find((c) => c.key === "emailHandling")) missing.push("כמות טיפול במיילים (10%)");
  if (!components.find((c) => c.key === "avgDuration")) missing.push("ממוצע משך שיחה (10%)");

  let note = `ציון משוקלל: ${parts.join(" · ")}. הציון מוצג בסולם 0–100 (השוואה לשאר הנציגים באותה תקופה).`;
  if (missing.length) {
    note += ` חסר בקובץ: ${missing.join(", ")} — השקלול מחושב מחדש לפי העמודות שנמצאו.`;
  }
  return note;
}

/** ציון משוקלל 0–100 להצגה */
export function formatCompositeScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return "—";
  return `${Math.round(Number(score) * 100)}`;
}
