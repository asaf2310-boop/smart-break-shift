import * as XLSX from "xlsx";
import {
  filterMetricsColumns,
  isHiddenMetricColumn,
  serializeMetricValue,
} from "@/lib/agentMetricsFormat";

const AGENT_NAME_HEADERS = new Set([
  "שם נציג",
  "נציג",
  "שם",
  "agent",
  "agent name",
  "display_name",
  "display name",
  "שם מלא",
]);

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

const ENGLISH_MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeSheetName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** הקשר חודש נוכחי — לבחירת גיליון בקובץ Excel מרובה חוצצים */
export function getCurrentMonthSheetContext(referenceDate = new Date()) {
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const monthIndex = date.getMonth();
  return {
    monthIndex,
    hebrewMonth: HEBREW_MONTHS[monthIndex],
    englishMonth: ENGLISH_MONTHS[monthIndex],
    year: date.getFullYear(),
    periodLabel: `${HEBREW_MONTHS[monthIndex]} ${date.getFullYear()}`,
  };
}

/**
 * בוחר גיליון לפי שם החודש הנוכחי (למשל «יוני»).
 * @param {string[]} sheetNames
 * @param {Date} [referenceDate]
 * @returns {string|null}
 */
export function findMetricsSheetName(sheetNames = [], referenceDate = new Date()) {
  const names = (sheetNames || []).map((n) => String(n || "").trim()).filter(Boolean);
  if (!names.length) return null;
  if (names.length === 1) return names[0];

  const ctx = getCurrentMonthSheetContext(referenceDate);
  const hebrew = normalizeSheetName(ctx.hebrewMonth);
  const english = ctx.englishMonth;
  const yearStr = String(ctx.year);
  const monthNum = String(ctx.monthIndex + 1);
  const monthNumPadded = monthNum.padStart(2, "0");

  const scored = names.map((name) => {
    const norm = normalizeSheetName(name);
    let score = 0;

    if (norm === hebrew) score = 100;
    else if (norm === `${hebrew} ${yearStr}`) score = 98;
    else if (norm.startsWith(`${hebrew} `) && norm.includes(yearStr)) score = 95;
    else if (norm.startsWith(hebrew) || norm.endsWith(` ${hebrew}`) || norm.includes(` ${hebrew} `)) {
      score = 85;
    } else if (norm.includes(hebrew)) score = 75;
    else if (norm === english || norm.startsWith(`${english} `) || norm.includes(` ${english}`)) score = 65;
    else if (
      (norm === monthNum || norm === monthNumPadded || norm.startsWith(`${monthNumPadded}-`) || norm.startsWith(`${monthNum}-`)) &&
      (norm.includes(hebrew) || norm.includes(english))
    ) {
      score = 55;
    }

    return { name, score };
  });

  const best = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score)[0];
  return best?.name ?? null;
}

function periodLabelFromSheet(sheetName, referenceDate = new Date()) {
  const trimmed = String(sheetName || "").trim();
  const ctx = getCurrentMonthSheetContext(referenceDate);
  if (!trimmed) return ctx.periodLabel;
  const norm = normalizeSheetName(trimmed);
  if (norm.includes(String(ctx.year))) return trimmed;
  if (HEBREW_MONTHS.some((m) => norm === normalizeSheetName(m) || norm.startsWith(normalizeSheetName(m)))) {
    return `${trimmed} ${ctx.year}`;
  }
  return ctx.periodLabel;
}

function findAgentNameKey(keys) {
  for (const key of keys) {
    if (AGENT_NAME_HEADERS.has(normalizeHeader(key))) return key;
  }
  return keys[0] || null;
}

function normalizeAgentName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/** שורת סיכום צוות ב-Excel — לא נכללת בדירוג נציגים */
export function isTeamAverageLabel(name) {
  const norm = normalizeAgentName(name).toLowerCase();
  if (!norm) return false;
  if (norm === "ממוצע צוות" || norm === "ממוצע" || norm === "צוות") return true;
  if (norm.includes("ממוצע") && norm.includes("צוות")) return true;
  if (norm === "team average" || norm === "team avg" || norm === "team") return true;
  if (norm.includes("team") && norm.includes("average")) return true;
  return false;
}

export function partitionMetricsRows(rows = []) {
  const agentRows = [];
  let teamSummary = null;

  for (const row of rows) {
    const name = row.agentName || row.agent_name || "";
    if (isTeamAverageLabel(name)) {
      teamSummary = {
        label: normalizeAgentName(name) || "ממוצע צוות",
        metrics: row.metrics || {},
      };
      continue;
    }
    agentRows.push(row);
  }

  return { agentRows, teamSummary };
}

/**
 * @param {Record<string, unknown>[]} sheetRows — from XLSX sheet_to_json
 */
export function parseMetricsSheetRows(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
    return { columns: [], rows: [], errors: ["הקובץ ריק או ללא שורות נתונים"] };
  }

  const keys = Object.keys(sheetRows[0] || {}).filter(
    (k) => k && String(k).trim() && !isHiddenMetricColumn(k)
  );
  if (!keys.length) {
    return { columns: [], rows: [], errors: ["לא נמצאו עמודות בקובץ"] };
  }

  const agentKey = findAgentNameKey(keys);
  if (!agentKey) {
    return { columns: [], rows: [], errors: ["לא נמצאה עמודת שם נציג"] };
  }

  const metricKeys = keys.filter((k) => k !== agentKey && !isHiddenMetricColumn(k));
  const columns = filterMetricsColumns([agentKey, ...metricKeys]);
  const parsedRows = [];
  const errors = [];

  sheetRows.forEach((raw, index) => {
    const agentName = normalizeAgentName(raw[agentKey]);
    if (!agentName) return;

    const metrics = {};
    for (const key of metricKeys) {
      if (isHiddenMetricColumn(key)) continue;
      const val = raw[key];
      if (val === undefined || val === null || val === "") continue;
      const serialized = serializeMetricValue(val, key);
      if (serialized !== null && serialized !== "") {
        metrics[key] = serialized;
      }
    }

    if (Object.keys(metrics).length === 0) {
      if (!isTeamAverageLabel(agentName)) {
        errors.push(`שורה ${index + 2}: אין מדדים עבור ${agentName}`);
      }
      return;
    }

    parsedRows.push({ agentName, metrics });
  });

  const { agentRows, teamSummary } = partitionMetricsRows(parsedRows);

  if (!agentRows.length && !teamSummary) {
    errors.push("לא נמצאו שורות תקינות עם שם נציג ומדדים");
  }

  return { columns, rows: agentRows, teamSummary, errors, agentColumn: agentKey };
}

/**
 * @param {File} file
 * @param {{ referenceDate?: Date }} [options]
 */
export async function parseMetricsFile(file, options = {}) {
  if (!file) throw new Error("לא נבחר קובץ");

  const referenceDate = options.referenceDate || new Date();
  const name = String(file.name || "").toLowerCase();
  let sheetRows = [];
  let sheetName = null;
  let availableSheets = [];

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: "string" });
    availableSheets = workbook.SheetNames || [];
    sheetName = availableSheets[0] || null;
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    sheetRows = sheet
      ? XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true, cellDates: true })
      : [];
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
    availableSheets = workbook.SheetNames || [];

    sheetName = findMetricsSheetName(availableSheets, referenceDate);
    if (!sheetName) {
      const ctx = getCurrentMonthSheetContext(referenceDate);
      return {
        columns: [],
        rows: [],
        errors: [
          `לא נמצא גיליון לחודש ${ctx.hebrewMonth}. גיליונות בקובץ: ${availableSheets.join(" · ") || "—"}`,
        ],
        sheetName: null,
        periodLabel: ctx.periodLabel,
        availableSheets,
      };
    }

    const sheet = workbook.Sheets[sheetName];
    sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true, cellDates: true });
  }

  const parsed = parseMetricsSheetRows(sheetRows);
  return {
    ...parsed,
    sheetName,
    periodLabel: periodLabelFromSheet(sheetName, referenceDate),
    availableSheets,
  };
}

export function downloadMetricsTemplate() {
  const headers = [
    "שם נציג",
    "שיחות ממוצע לשעה",
    "זמן התחברות (דק)",
    "תיעוד %",
    "אי זמינות %",
    "כמות טיפול במיילים",
    "ממוצע משך שיחה (דק)",
    "שיחות",
    "עמידה ביעד %",
    "ציון שביעות רצון",
  ];
  const sample = ["אוראל כליפה", 8.5, 7.2, 0.94, 0.03, 42, 4.5, 120, 0.92, 4.8];
  const teamSample = ["ממוצע צוות", 7.8, 6.5, 0.91, 0.04, 38, 4.8, 110, 0.9, 4.6];
  const ctx = getCurrentMonthSheetContext();
  const ws = XLSX.utils.aoa_to_sheet([headers, sample, teamSample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, ctx.hebrewMonth);
  XLSX.writeFile(wb, "template-agent-metrics.xlsx");
}
