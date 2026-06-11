import { detectMetricsChannel, isTeamAverageLabel } from "@/lib/agentMetricsImport";
import { DEFAULT_METRICS_POINT_SETTINGS } from "@/lib/agentMetricsPointSettings";
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
  emailPoints: 0.1,
  avgDuration: 0.1,
  unavailability: 0.1,
};

const WHATSAPP_WEIGHTS = {
  whatsappPerHour: 0.5,
  writtenWorkPoints: 0.3,
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

const TICKETS_HEADERS = new Set([
  "כמות טיקטים",
  "טיקטים",
  "מספר טיקטים",
  "טיפול בטיקטים",
  "tickets",
  "ticket count",
]);

const INCOMING_CALLS_HEADERS = new Set(["שיחות נכנסות", "incoming calls", "inbound calls"]);
const OUTGOING_CALLS_HEADERS = new Set(["שיחות יוצאות", "outgoing calls", "outbound calls"]);

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

function resolvePointSettings(pointSettings) {
  return { ...DEFAULT_METRICS_POINT_SETTINGS, ...(pointSettings || {}) };
}

export function findCallsPerHourColumn(columns = []) {
  for (const col of columns) {
    if (isWhatsappHeader(col)) continue;
    const norm = normalizeHeader(col);
    if (CALLS_PER_HOUR_HEADERS.has(norm)) return col;
    if (norm.includes("שיחות") && norm.includes("שעה") && !norm.includes("whatsapp")) return col;
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

export function findIncomingCallsColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (INCOMING_CALLS_HEADERS.has(norm)) return col;
    if (norm.includes("שיחות") && norm.includes("נכנס")) return col;
    if (norm.includes("incoming") || norm.includes("inbound")) return col;
  }
  return null;
}

export function findOutgoingCallsColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (OUTGOING_CALLS_HEADERS.has(norm)) return col;
    if (norm.includes("שיחות") && norm.includes("יוצא")) return col;
    if (norm.includes("outgoing") || norm.includes("outbound")) return col;
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

export function findTicketsColumn(columns = []) {
  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (TICKETS_HEADERS.has(norm)) return col;
    if (norm.includes("טיקט")) return col;
    if (norm.includes("ticket")) return col;
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

function metricNumber(row, col) {
  if (!col) return null;
  return metricValueForScoring(row.metrics?.[col], col);
}

/** ניקוד גולמי ממיילים (ואופציונלית טיקטים) */
export function computeEmailPoints(row, columns, pointSettings, { includeTickets = false } = {}) {
  const settings = resolvePointSettings(pointSettings);
  const emailCol = findEmailHandlingColumn(columns);
  const ticketCol = findTicketsColumn(columns);
  let total = 0;
  let hasValue = false;

  const emailCount = metricNumber(row, emailCol);
  if (emailCount !== null) {
    total += emailCount * settings.email;
    hasValue = true;
  }

  if (includeTickets) {
    const ticketCount = metricNumber(row, ticketCol);
    if (ticketCount !== null) {
      total += ticketCount * settings.ticket;
      hasValue = true;
    }
  }

  return hasValue ? total : null;
}

/** ניקוד שיחות לשעה לנציג טלפוני */
export function computePhoneCallPointsPerHour(row, columns, pointSettings) {
  const settings = resolvePointSettings(pointSettings);
  const callsCol = findCallsPerHourColumn(columns);
  const callsPerHour = metricNumber(row, callsCol);
  if (callsPerHour !== null) {
    return callsPerHour * settings.phoneCall;
  }

  const incoming = metricNumber(row, findIncomingCallsColumn(columns));
  const outgoing = metricNumber(row, findOutgoingCallsColumn(columns));
  if (incoming !== null || outgoing !== null) {
    return ((incoming ?? 0) + (outgoing ?? 0)) * settings.phoneCall;
  }

  return null;
}

/** ניקוד WhatsApp לשעה */
export function computeWhatsappPointsPerHour(row, columns, pointSettings) {
  const settings = resolvePointSettings(pointSettings);
  const waCol = findWhatsappPerHourColumn(columns);
  const perHour = metricNumber(row, waCol);
  if (perHour === null) return null;
  return perHour * settings.whatsappCall;
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
 * ציון מנורמל 0–100 מול הטוב ביותר בחודש.
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
  if (bestValue <= 0) return 0;
  return Math.min(100, (bestValue / value) * 100);
}

/** מפתחות מדדים שמושווים יחד בדירוג מאוחד (למשל ניקוד שיחות לשעה מכל הערוצים) */
const UNIFIED_NORMALIZATION_GROUPS = {
  callPointsPerHour: ["callsPerHour", "whatsappPerHour"],
  writtenWork: ["emailPoints", "writtenWorkPoints"],
  unavailability: ["unavailability"],
  documentation: ["documentation"],
  avgDuration: ["avgDuration"],
  handleTime: ["handleTime"],
};

const COMPONENT_NORMALIZATION_GROUP = {
  callsPerHour: "callPointsPerHour",
  whatsappPerHour: "callPointsPerHour",
  emailPoints: "writtenWork",
  writtenWorkPoints: "writtenWork",
  unavailability: "unavailability",
  documentation: "documentation",
  avgDuration: "avgDuration",
  handleTime: "handleTime",
};

function buildPhoneScoreComponents(metricColumns = [], pointSettings) {
  const docCol = findDocumentationColumn(metricColumns);
  const unavailCol = findUnavailabilityColumn(metricColumns);
  const durationCol = findAvgCallDurationColumn(metricColumns);

  return [
    {
      key: "callsPerHour",
      weight: PHONE_WEIGHTS.callsPerHour,
      higherIsBetter: true,
      getRaw: (row) => computePhoneCallPointsPerHour(row, metricColumns, pointSettings),
    },
    {
      key: "documentation",
      col: docCol,
      weight: PHONE_WEIGHTS.documentation,
      higherIsBetter: true,
      getRaw: (row) => metricNumber(row, docCol),
    },
    {
      key: "emailPoints",
      weight: PHONE_WEIGHTS.emailPoints,
      higherIsBetter: true,
      getRaw: (row) => computeEmailPoints(row, metricColumns, pointSettings, { includeTickets: false }),
    },
    {
      key: "avgDuration",
      col: durationCol,
      weight: PHONE_WEIGHTS.avgDuration,
      higherIsBetter: false,
      getRaw: (row) => metricNumber(row, durationCol),
    },
    {
      key: "unavailability",
      col: unavailCol,
      weight: PHONE_WEIGHTS.unavailability,
      higherIsBetter: false,
      getRaw: (row) => metricNumber(row, unavailCol),
    },
  ].filter((item) => item.getRaw || item.col);
}

function buildWhatsappScoreComponents(metricColumns = [], pointSettings) {
  const handleCol = findAvgHandleTimeColumn(metricColumns);
  const unavailCol = findUnavailabilityColumn(metricColumns);

  return [
    {
      key: "whatsappPerHour",
      weight: WHATSAPP_WEIGHTS.whatsappPerHour,
      higherIsBetter: true,
      getRaw: (row) => computeWhatsappPointsPerHour(row, metricColumns, pointSettings),
    },
    {
      key: "writtenWorkPoints",
      weight: WHATSAPP_WEIGHTS.writtenWorkPoints,
      higherIsBetter: true,
      getRaw: (row) => computeEmailPoints(row, metricColumns, pointSettings, { includeTickets: true }),
    },
    {
      key: "handleTime",
      col: handleCol,
      weight: WHATSAPP_WEIGHTS.handleTime,
      higherIsBetter: false,
      getRaw: (row) => metricNumber(row, handleCol),
    },
    {
      key: "unavailability",
      col: unavailCol,
      weight: WHATSAPP_WEIGHTS.unavailability,
      higherIsBetter: false,
      getRaw: (row) => metricNumber(row, unavailCol),
    },
  ].filter((item) => item.getRaw || item.col);
}

export function buildScoreComponents(metricColumns = [], channel = METRICS_CHANNEL.phone, pointSettings) {
  return channel === METRICS_CHANNEL.whatsapp
    ? buildWhatsappScoreComponents(metricColumns, pointSettings)
    : buildPhoneScoreComponents(metricColumns, pointSettings);
}

function scoreAgentRows(agentRows, metricColumns, channel, pointSettings) {
  const components = buildScoreComponents(metricColumns, channel, pointSettings).filter((c) => c.getRaw);
  if (!components.length) {
    return agentRows.map((row) => ({
      ...row,
      agent_name: row.agent_name || row.agentName,
      _compositeScore: 0,
      _channel: channel,
    }));
  }

  const metricScoresByComponent = components.map((comp) => {
    const rawValues = agentRows.map((row) => comp.getRaw(row));
    const best = pickBestValue(rawValues, comp.higherIsBetter);
    return rawValues.map((v) => relativeMetricScore(v, best, comp.higherIsBetter));
  });

  return agentRows.map((row, rowIndex) => {
    let compositeScore = 0;
    components.forEach((comp, compIndex) => {
      const normalized = metricScoresByComponent[compIndex][rowIndex] ?? 0;
      compositeScore += comp.weight * normalized;
    });

    return {
      ...row,
      agent_name: row.agent_name || row.agentName,
      _compositeScore: compositeScore,
      _channel: channel,
    };
  });
}

/**
 * @param {Array} rows
 * @param {string[]} columns
 * @param {'phone'|'whatsapp'} [channel]
 * @param {object} [pointSettings]
 */
export function rankMetricRows(rows = [], columns = [], channel, pointSettings) {
  const agentRows = rows.filter(
    (row) => !isTeamAverageLabel(row.agent_name || row.agentName)
  );
  if (!agentRows.length) return [];

  const metricColumns = columns.slice(1);
  const resolvedChannel = channel || detectMetricsChannel(columns) || METRICS_CHANNEL.phone;
  const scored = scoreAgentRows(agentRows, metricColumns, resolvedChannel, pointSettings);

  scored.sort((a, b) => b._compositeScore - a._compositeScore);
  scored.forEach((row, i) => {
    row._rank = i + 1;
  });

  return scored;
}

function scoreUnifiedAgentRows(phoneAgents, phoneColumns, waAgents, whatsappColumns, pointSettings) {
  const entries = [
    ...phoneAgents.map((row) => ({
      row,
      channel: METRICS_CHANNEL.phone,
      metricColumns: phoneColumns.slice(1),
    })),
    ...waAgents.map((row) => ({
      row,
      channel: METRICS_CHANNEL.whatsapp,
      metricColumns: whatsappColumns.slice(1),
    })),
  ];

  if (!entries.length) return [];

  const prepared = entries.map(({ row, channel, metricColumns }) => {
    const components = buildScoreComponents(metricColumns, channel, pointSettings).filter((c) => c.getRaw);
    const rawByKey = Object.fromEntries(components.map((comp) => [comp.key, comp.getRaw(row)]));
    return { row, channel, components, rawByKey };
  });

  const groupMeta = {};
  for (const groupName of Object.keys(UNIFIED_NORMALIZATION_GROUPS)) {
    const keys = UNIFIED_NORMALIZATION_GROUPS[groupName];
    const values = [];
    let higherIsBetter = true;

    prepared.forEach(({ components, rawByKey }) => {
      components.forEach((comp) => {
        if (!keys.includes(comp.key)) return;
        const value = rawByKey[comp.key];
        if (value !== null && Number.isFinite(value)) values.push(value);
        higherIsBetter = comp.higherIsBetter;
      });
    });

    groupMeta[groupName] = {
      best: pickBestValue(values, higherIsBetter),
      higherIsBetter,
    };
  }

  return prepared.map(({ row, channel, components, rawByKey }) => {
    let compositeScore = 0;

    components.forEach((comp) => {
      const groupName = COMPONENT_NORMALIZATION_GROUP[comp.key];
      const group = groupMeta[groupName];
      const normalized = relativeMetricScore(
        rawByKey[comp.key],
        group?.best ?? null,
        group?.higherIsBetter ?? comp.higherIsBetter
      );
      compositeScore += comp.weight * normalized;
    });

    return {
      ...row,
      agent_name: row.agent_name || row.agentName,
      _compositeScore: compositeScore,
      _channel: channel,
    };
  });
}

/** דירוג מאוחד — טלפון + WhatsApp בטבלה אחת; נרמול מדדים משותפים מול כל הנציגים */
export function rankUnifiedMetricRows({
  phoneRows = [],
  phoneColumns = [],
  whatsappRows = [],
  whatsappColumns = [],
  pointSettings,
} = {}) {
  const phoneAgents = phoneRows.filter((r) => !isTeamAverageLabel(r.agent_name || r.agentName));
  const waAgents = whatsappRows.filter((r) => !isTeamAverageLabel(r.agent_name || r.agentName));

  const merged = scoreUnifiedAgentRows(
    phoneAgents,
    phoneColumns,
    waAgents,
    whatsappColumns,
    pointSettings
  );

  merged.sort((a, b) => b._compositeScore - a._compositeScore);
  merged.forEach((row, i) => {
    row._rank = i + 1;
  });

  return merged;
}

export function mergeDisplayColumns(phoneColumns = [], whatsappColumns = []) {
  const agentCol = phoneColumns[0] || whatsappColumns[0] || "נציג";
  const metrics = [
    ...new Set([...phoneColumns.slice(1), ...whatsappColumns.slice(1)]),
  ];
  return [agentCol, ...metrics];
}

export function getUnifiedRankingNote(pointSettings) {
  const s = resolvePointSettings(pointSettings);
  return (
    `דירוג מאוחד (טלפון + WhatsApp): לכל מדד מחשבים ניקוד גולמי (שיחה טלפונית=${s.phoneCall} · WhatsApp=${s.whatsappCall} · מייל=${s.email} · טיקט=${s.ticket}), ` +
    `מנרמלים ל-0–100 מול הטוב ביותר בחודש מבין כל הנציגים (שיחות לשעה, מיילים ואי זמינות — ביחד), ומכפילים במשקל. ` +
    `טלפון: 50% שיחות/שעה · 20% תיעוד · 10% מיילים · 10% משך שיחה · 10% אי זמינות. ` +
    `WhatsApp: 50% שיחות/שעה · 30% מיילים+טיקטים · 10% זמן טיפול · 10% אי זמינות.`
  );
}

export function getMetricsRankingNote(columns = [], channel, pointSettings) {
  if (channel === "unified") {
    return getUnifiedRankingNote(pointSettings);
  }

  const metricColumns = columns.slice(1);
  const resolvedChannel = channel || detectMetricsChannel(columns) || METRICS_CHANNEL.phone;
  const s = resolvePointSettings(pointSettings);
  const components = buildScoreComponents(metricColumns, resolvedChannel, pointSettings);

  if (resolvedChannel === METRICS_CHANNEL.whatsapp) {
    const parts = [];
    if (components.find((c) => c.key === "whatsappPerHour")) {
      parts.push(`50% ניקוד WhatsApp לשעה (×${s.whatsappCall})`);
    }
    if (components.find((c) => c.key === "writtenWorkPoints")) {
      parts.push(`30% ניקוד מיילים+טיקטים (מייל ×${s.email}, טיקט ×${s.ticket})`);
    }
    if (components.find((c) => c.key === "handleTime")) parts.push("10% זמן טיפול");
    if (components.find((c) => c.key === "unavailability")) parts.push("10% אי זמינות");

    return parts.length
      ? `WhatsApp — ${parts.join(" · ")}. ניקוד גולמי → 0–100 → משקל.`
      : "הוסיפו עמודות WhatsApp לשעה, מיילים, זמן טיפול ואי זמינות.";
  }

  const parts = [];
  if (components.find((c) => c.key === "callsPerHour")) {
    parts.push(`50% ניקוד שיחות לשעה (×${s.phoneCall})`);
  }
  if (components.find((c) => c.key === "documentation")) parts.push("20% תיעוד");
  if (components.find((c) => c.key === "emailPoints")) {
    parts.push(`10% ניקוד מיילים (×${s.email})`);
  }
  if (components.find((c) => c.key === "avgDuration")) parts.push("10% משך שיחה");
  if (components.find((c) => c.key === "unavailability")) parts.push("10% אי זמינות");

  return parts.length
    ? `טלפון — ${parts.join(" · ")}. ניקוד גולמי → 0–100 → משקל.`
    : "הוסיפו עמודות שיחות לשעה, תיעוד, מיילים, משך שיחה ואי זמינות.";
}

export function getChannelLabel(channel) {
  return channel === METRICS_CHANNEL.whatsapp ? "WhatsApp" : "טלפון";
}

/** ציון משוקלל 0–100 להצגה */
export function formatCompositeScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return "—";
  const n = Number(score);
  const display = n <= 1 && n > 0 ? n * 100 : n;
  return `${Math.round(display)}`;
}
