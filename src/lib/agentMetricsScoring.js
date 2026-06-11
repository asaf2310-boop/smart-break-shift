import { detectMetricsChannel, isTeamAverageLabel } from "@/lib/agentMetricsImport";
import {
  isAvgCallDurationColumn,
  isAvgHandleTimeColumn,
  isHiddenMetricColumn,
  metricValueForScoring,
} from "@/lib/agentMetricsFormat";

export const METRICS_CHANNEL = {
  phone: "phone",
  whatsapp: "whatsapp",
};

const PHONE_WEIGHTS = {
  callsPerHour: 0.5,
  documentation: 0.2,
  emailHandling: 0.1,
  avgDuration: 0.1,
  unavailability: 0.1,
};

const WHATSAPP_WEIGHTS = {
  whatsappPerHour: 0.5,
  emailHandling: 0.3,
  handleTime: 0.1,
  unavailability: 0.1,
};

const CALLS_PER_HOUR_HEADERS = new Set([
  "שיחות ממוצע לשעה",
  "ממוצע שיחות לשעה",
  "ממוצע שיחות בשעה",
  "שיחות לשעה",
  "שיחות/שעה",
  "calls per hour",
  "cph",
  "avg calls per hour",
]);

const WHATSAPP_PER_HOUR_HEADERS = new Set([
  "ממוצע שיחות whatsapp לשעה",
  "ממוצע ווטסאפ לשעה",
  "שיחות whatsapp לשעה",
  "ווטסאפ לשעה",
  "whatsapp לשעה",
  "whatsapp per hour",
  "wa per hour",
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

const HANDLE_TIME_HEADERS = new Set([
  "ממוצע זמן טיפול",
  "זמן טיפול ממוצע",
  "ממוצע זמן טיפול (דק)",
  "average handle time",
  "avg treatment time",
  "handle time",
]);

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isWhatsappHeader(columnName) {
  const norm = normalizeHeader(columnName);
  return norm.includes("ווטסאפ") || norm.includes("whatsapp") || norm.includes("wa ");
}

export function findCallsPerHourColumn(columns = []) {
  for (const col of columns) {
    if (isWhatsappHeader(col)) continue;
    const norm = normalizeHeader(col);
    if (CALLS_PER_HOUR_HEADERS.has(norm)) return col;
    if (norm.includes("שיחות") && norm.includes("שעה")) return col;
    if (norm.includes("calls") && norm.includes("hour")) return col;
  }
  return null;
}

export function findWhatsappPerHourColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (WHATSAPP_PER_HOUR_HEADERS.has(norm)) return col;
    if (isWhatsappHeader(col) && norm.includes("שעה")) return col;
    if (norm.includes("whatsapp") && norm.includes("hour")) return col;
  }
  return null;
}

export function findDocumentationColumn(columns = []) {
  for (const col of columns) {
    if (isHiddenMetricColumn(col)) continue;
    const norm = normalizeHeader(col);
    if (DOCUMENTATION_HEADERS.has(norm)) return col;
    if (norm.includes("פניות מתועדות")) continue;
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
    if (isHiddenMetricColumn(col)) continue;
    if (isAvgHandleTimeColumn(col)) continue;
    if (isAvgCallDurationColumn(col)) return col;
    const norm = normalizeHeader(col);
    if (AVG_DURATION_HEADERS.has(norm)) return col;
  }
  return null;
}

export function findAvgHandleTimeColumn(columns = []) {
  for (const col of columns) {
    if (isHiddenMetricColumn(col)) continue;
    if (isAvgHandleTimeColumn(col)) return col;
    const norm = normalizeHeader(col);
    if (HANDLE_TIME_HEADERS.has(norm)) return col;
    if (norm.includes("זמן טיפול") && !norm.includes("שיחה")) return col;
  }
  return null;
}

function pickBestValue(values, higherIsBetter) {
  const present = values.filter((v) => v !== null && Number.isFinite(v));
  if (!present.length) return null;
  if (higherIsBetter) return Math.max(...present);
  const nonNegative = present.filter((v) => v >= 0);
  if (!nonNegative.length) return null;
  return Math.min(...nonNegative);
}

/**
 * ציון יחסי מול הערך הטוב ביותר בחודש (מקסימום 100).
 * @param {number|null} value
 * @param {number|null} bestValue
 * @param {boolean} higherIsBetter
 */
export function relativeMetricScore(value, bestValue, higherIsBetter = true) {
  if (value === null || bestValue === null || !Number.isFinite(value) || !Number.isFinite(bestValue)) {
    return 0;
  }

  if (higherIsBetter) {
    if (bestValue <= 0) return value > 0 ? 100 : 0;
    if (value <= 0) return 0;
    return Math.min(100, (value / bestValue) * 100);
  }

  if (value <= 0) return 100;
  if (bestValue <= 0) return 100;
  return Math.min(100, (bestValue / value) * 100);
}

function buildPhoneScoreComponents(metricColumns = []) {
  const callsCol = findCallsPerHourColumn(metricColumns);
  const docCol = findDocumentationColumn(metricColumns);
  const unavailCol = findUnavailabilityColumn(metricColumns);
  const emailCol = findEmailHandlingColumn(metricColumns);
  const durationCol = findAvgCallDurationColumn(metricColumns);

  return [
    { key: "callsPerHour", col: callsCol, weight: PHONE_WEIGHTS.callsPerHour, higherIsBetter: true },
    { key: "documentation", col: docCol, weight: PHONE_WEIGHTS.documentation, higherIsBetter: true },
    { key: "emailHandling", col: emailCol, weight: PHONE_WEIGHTS.emailHandling, higherIsBetter: true },
    { key: "avgDuration", col: durationCol, weight: PHONE_WEIGHTS.avgDuration, higherIsBetter: false },
    {
      key: "unavailability",
      col: unavailCol,
      weight: PHONE_WEIGHTS.unavailability,
      higherIsBetter: false,
    },
  ].filter((item) => item.col);
}

function buildWhatsappScoreComponents(metricColumns = []) {
  const waCol = findWhatsappPerHourColumn(metricColumns);
  const emailCol = findEmailHandlingColumn(metricColumns);
  const handleCol = findAvgHandleTimeColumn(metricColumns);
  const unavailCol = findUnavailabilityColumn(metricColumns);

  return [
    {
      key: "whatsappPerHour",
      col: waCol,
      weight: WHATSAPP_WEIGHTS.whatsappPerHour,
      higherIsBetter: true,
    },
    { key: "emailHandling", col: emailCol, weight: WHATSAPP_WEIGHTS.emailHandling, higherIsBetter: true },
    { key: "handleTime", col: handleCol, weight: WHATSAPP_WEIGHTS.handleTime, higherIsBetter: false },
    {
      key: "unavailability",
      col: unavailCol,
      weight: WHATSAPP_WEIGHTS.unavailability,
      higherIsBetter: false,
    },
  ].filter((item) => item.col);
}

export function buildScoreComponents(metricColumns = [], channel = METRICS_CHANNEL.phone) {
  return channel === METRICS_CHANNEL.whatsapp
    ? buildWhatsappScoreComponents(metricColumns)
    : buildPhoneScoreComponents(metricColumns);
}

/**
 * @param {Array<{ agent_name?: string, agentName?: string, metrics: Record<string, unknown>, id?: string }>} rows
 * @param {string[]} columns
 * @param {'phone'|'whatsapp'} [channel]
 */
export function rankMetricRows(rows = [], columns = [], channel) {
  const agentRows = rows.filter(
    (row) => !isTeamAverageLabel(row.agent_name || row.agentName)
  );
  if (!agentRows.length) return [];

  const metricColumns = columns.slice(1);
  const resolvedChannel = channel || detectMetricsChannel(columns) || METRICS_CHANNEL.phone;
  const components = buildScoreComponents(metricColumns, resolvedChannel);
  if (!components.length) {
    return agentRows.map((row, index) => ({
      ...row,
      agent_name: row.agent_name || row.agentName,
      _compositeScore: 0,
      _rank: index + 1,
      _channel: resolvedChannel,
    }));
  }

  const metricScoresByComponent = components.map(({ col, higherIsBetter }) => {
    const values = agentRows.map((r) => metricValueForScoring(r.metrics?.[col], col));
    const best = pickBestValue(values, higherIsBetter);
    return values.map((v) => relativeMetricScore(v, best, higherIsBetter));
  });

  const scored = agentRows.map((row, rowIndex) => {
    let compositeScore = 0;
    components.forEach((comp, compIndex) => {
      compositeScore += comp.weight * (metricScoresByComponent[compIndex][rowIndex] ?? 0);
    });

    return {
      ...row,
      agent_name: row.agent_name || row.agentName,
      _compositeScore: compositeScore,
      _rank: 0,
      _channel: resolvedChannel,
    };
  });

  scored.sort((a, b) => b._compositeScore - a._compositeScore);
  scored.forEach((row, i) => {
    row._rank = i + 1;
  });

  return scored;
}

export function getMetricsRankingNote(columns = [], channel) {
  const metricColumns = columns.slice(1);
  const resolvedChannel = channel || detectMetricsChannel(columns) || METRICS_CHANNEL.phone;
  const components = buildScoreComponents(metricColumns, resolvedChannel);

  if (resolvedChannel === METRICS_CHANNEL.whatsapp) {
    const parts = [];
    if (components.find((c) => c.key === "whatsappPerHour")) parts.push("50% ממוצע WhatsApp לשעה");
    if (components.find((c) => c.key === "emailHandling")) parts.push("30% כמות טיפול במיילים");
    if (components.find((c) => c.key === "handleTime")) parts.push("10% ממוצע זמן טיפול (קצר = טוב)");
    if (components.find((c) => c.key === "unavailability")) parts.push("10% אחוז אי זמינות (נמוך = טוב)");

    if (!parts.length) {
      return "ציון WhatsApp: הוסיפו עמודות ממוצע WhatsApp לשעה, כמות טיפול במיילים, ממוצע זמן טיפול ואחוז אי זמינות.";
    }

    const missing = [];
    if (!components.find((c) => c.key === "whatsappPerHour")) missing.push("WhatsApp לשעה (50%)");
    if (!components.find((c) => c.key === "emailHandling")) missing.push("מיילים (30%)");
    if (!components.find((c) => c.key === "handleTime")) missing.push("זמן טיפול (10%)");
    if (!components.find((c) => c.key === "unavailability")) missing.push("אי זמינות (10%)");

    let note = `נציגי WhatsApp/טיקטים — ${parts.join(" · ")}. כל מדד מושווה לנציג הטוב ביותר באותו חודש (מקסימום 100).`;
    if (missing.length) {
      note += ` חסר בקובץ: ${missing.join(", ")}.`;
    }
    return note;
  }

  const parts = [];
  if (components.find((c) => c.key === "callsPerHour")) parts.push("50% ממוצע שיחות לשעה");
  if (components.find((c) => c.key === "documentation")) parts.push("20% אחוז תיעוד");
  if (components.find((c) => c.key === "emailHandling")) parts.push("10% כמות טיפול במיילים");
  if (components.find((c) => c.key === "avgDuration")) parts.push("10% ממוצע משך שיחה (קצר = טוב)");
  if (components.find((c) => c.key === "unavailability")) parts.push("10% אחוז אי זמינות (נמוך = טוב)");

  if (!parts.length) {
    return "ציון טלפון: הוסיפו עמודות שיחות לשעה, תיעוד, מיילים, משך שיחה ואי זמינות.";
  }

  const missing = [];
  if (!components.find((c) => c.key === "callsPerHour")) missing.push("שיחות לשעה (50%)");
  if (!components.find((c) => c.key === "documentation")) missing.push("תיעוד (20%)");
  if (!components.find((c) => c.key === "emailHandling")) missing.push("מיילים (10%)");
  if (!components.find((c) => c.key === "avgDuration")) missing.push("משך שיחה (10%)");
  if (!components.find((c) => c.key === "unavailability")) missing.push("אי זמינות (10%)");

  let note = `נציגי טלפון — ${parts.join(" · ")}. כל מדד מושווה לנציג הטוב ביותר באותו חודש (מקסימום 100).`;
  if (missing.length) {
    note += ` חסר בקובץ: ${missing.join(", ")}.`;
  }
  return note;
}

export function getChannelLabel(channel) {
  return channel === METRICS_CHANNEL.whatsapp ? "WhatsApp / טיקטים" : "טלפון";
}

/** ציון משוקלל 0–100 להצגה */
export function formatCompositeScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return "—";
  const n = Number(score);
  const display = n <= 1 && n > 0 ? n * 100 : n;
  return `${Math.round(display)}`;
}
