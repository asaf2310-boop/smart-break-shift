function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** עמודות מוסתרות ב-Excel — לא מוצגות בטבלה */
const HIDDEN_COLUMN_LABELS = new Set(["כמות פניות מתועדות"]);

export function isHiddenMetricColumn(columnName) {
  const trimmed = String(columnName ?? "").trim();
  if (!trimmed) return true;
  if (HIDDEN_COLUMN_LABELS.has(trimmed)) return true;
  const norm = normalizeHeader(trimmed);
  if (norm.includes("כמות פניות מתועדות")) return true;
  if (norm.includes("פניות מתועדות") && norm.includes("כמות")) return true;
  return false;
}

export function filterMetricsColumns(columns = []) {
  if (!Array.isArray(columns) || !columns.length) return [];
  const agentCol = columns[0];
  const metrics = columns.slice(1).filter((col) => !isHiddenMetricColumn(col));
  return agentCol ? [agentCol, ...metrics] : metrics;
}

export function parseMetricNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "")
    .trim()
    .replace(/%/g, "")
    .replace(/,/g, "");
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function isPercentColumn(columnName) {
  const norm = normalizeHeader(columnName);
  if (norm.includes("%")) return true;
  if (norm.includes("אחוז")) return true;
  if (norm.includes("תיעוד") && !norm.includes("פניות מתועדות")) return true;
  if (norm.includes("אי זמינות") || norm.includes("לא זמין")) return true;
  if (norm.includes("עמידה ביעד") || norm.includes("יעד")) return true;
  if (norm.includes("percent") || norm.includes("pct")) return true;
  if (norm.includes("unavail")) return true;
  return false;
}

export function isConnectionTimeColumn(columnName) {
  const norm = normalizeHeader(columnName);
  if (norm.includes("זמן התחברות")) return true;
  if (norm.includes("התחברות") && !norm.includes("משך")) return true;
  if (norm.includes("connection time") || norm.includes("login time")) return true;
  return false;
}

export function isAvgCallDurationColumn(columnName) {
  if (isConnectionTimeColumn(columnName)) return false;
  const norm = normalizeHeader(columnName);
  if (norm.includes("משך שיחה") || norm.includes("ממוצע משך")) return true;
  if (norm.includes("aht") || norm.includes("handle time")) return true;
  if (norm.includes("דק") && norm.includes("שיחה")) return true;
  return false;
}

export function isDurationMinutesColumn(columnName) {
  return isConnectionTimeColumn(columnName) || isAvgCallDurationColumn(columnName);
}

/** חילוץ שעות/דקות/שניות מ-Date, מחרוזת Excel או מספר */
export function extractTimeParts(value, columnName = "") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      hours: value.getHours(),
      minutes: value.getMinutes(),
      seconds: value.getSeconds(),
    };
  }

  const str = String(value ?? "").trim();
  if (!str) return null;

  const fromJsDate = str.match(
    /\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+(\d{1,2}):(\d{2}):(\d{2})/
  );
  if (fromJsDate) {
    return {
      hours: Number.parseInt(fromJsDate[1], 10),
      minutes: Number.parseInt(fromJsDate[2], 10),
      seconds: Number.parseInt(fromJsDate[3], 10),
    };
  }

  const hms = str.match(/^(\d{1,3}):(\d{1,2}):(\d{1,2})$/);
  if (hms) {
    return {
      hours: Number.parseInt(hms[1], 10),
      minutes: Number.parseInt(hms[2], 10),
      seconds: Number.parseInt(hms[3], 10),
    };
  }

  const ms = str.match(/^(\d{1,3}):(\d{1,2})$/);
  if (ms) {
    return {
      hours: 0,
      minutes: Number.parseInt(ms[1], 10),
      seconds: Number.parseInt(ms[2], 10),
    };
  }

  const n = parseMetricNumber(value);
  if (n === null) return null;

  let totalSeconds = 0;
  if (n > 0 && n < 1) {
    totalSeconds = Math.round(n * 24 * 60 * 60);
  } else if (
    (isConnectionTimeColumn(columnName) || isAvgCallDurationColumn(columnName)) &&
    n >= 60 &&
    n <= 7200 &&
    Math.abs(n - Math.round(n)) < 0.001
  ) {
    totalSeconds = Math.round(n);
  } else {
    totalSeconds = Math.round(n * 60);
  }

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** זמן התחברות — HH:MM:SS */
export function formatConnectionTime(value, columnName = "") {
  const parts = extractTimeParts(value, columnName);
  if (!parts) return "—";
  return `${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
}

/** ממוצע משך שיחה — MM:SS */
export function formatCallDuration(value, columnName = "") {
  const parts = extractTimeParts(value, columnName);
  if (!parts) return "—";
  const totalSeconds = parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${pad2(seconds)}`;
}

export function parseDurationToMinutes(value, columnName = "") {
  const parts = extractTimeParts(value, columnName);
  if (!parts) return null;
  return parts.hours * 60 + parts.minutes + parts.seconds / 60;
}

/** נרמול ערך מ-Excel לפני שמירה */
export function serializeMetricValue(value, columnName) {
  if (value === undefined || value === null || value === "") return null;

  if (isConnectionTimeColumn(columnName)) {
    return formatConnectionTime(value, columnName);
  }
  if (isAvgCallDurationColumn(columnName)) {
    return formatCallDuration(value, columnName);
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return formatConnectionTime(value, columnName);

  const str = String(value).trim();
  if (str.includes("GMT") && str.includes("Standard Time")) {
    if (isConnectionTimeColumn(columnName)) return formatConnectionTime(str, columnName);
    if (isAvgCallDurationColumn(columnName)) return formatCallDuration(str, columnName);
  }
  return str;
}

export function metricValueForScoring(value, columnName) {
  if (isPercentColumn(columnName)) {
    const n = parseMetricNumber(value);
    if (n === null) return null;
    if (n > 0 && n <= 1) return n * 100;
    return n;
  }
  if (isDurationMinutesColumn(columnName)) {
    return parseDurationToMinutes(value, columnName);
  }
  return parseMetricNumber(value);
}

function formatPercent(value) {
  const str = String(value).trim();
  if (str.includes("%")) {
    const n = parseMetricNumber(str);
    if (n === null) return str;
    const rounded =
      Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : Math.round(n * 10) / 10;
    return `${rounded}%`;
  }
  const n = parseMetricNumber(value);
  if (n === null) return str;
  let pct = n;
  if (pct > 0 && pct <= 1) pct *= 100;
  const rounded =
    Math.abs(pct - Math.round(pct)) < 0.05 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return `${rounded}%`;
}

export function formatMetricCell(value, columnName) {
  if (value === null || value === undefined || value === "") return "—";

  if (isPercentColumn(columnName)) {
    return formatPercent(value);
  }
  if (isConnectionTimeColumn(columnName)) {
    return formatConnectionTime(value, columnName);
  }
  if (isAvgCallDurationColumn(columnName)) {
    return formatCallDuration(value, columnName);
  }

  const n = parseMetricNumber(value);
  if (n !== null) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  const str = String(value).trim();
  if (str.includes("GMT") && (isConnectionTimeColumn(columnName) || isAvgCallDurationColumn(columnName))) {
    return isConnectionTimeColumn(columnName)
      ? formatConnectionTime(str, columnName)
      : formatCallDuration(str, columnName);
  }
  return str;
}
