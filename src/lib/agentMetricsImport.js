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

const ENGLISH_MONTH_ALIASES = [
  ["jan"],
  ["feb"],
  ["mar"],
  ["apr"],
  ["may"],
  ["jun"],
  ["jul"],
  ["aug"],
  ["sep", "sept"],
  ["oct"],
  ["nov"],
  ["dec"],
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
    .replace(/["'`׳״]+/g, " ")
    .replace(/[._\-\/\\]+/g, " ")
    .replace(/\s+/g, " ");
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMonthAliases(monthIndex) {
  const hebrew = normalizeSheetName(HEBREW_MONTHS[monthIndex]);
  const english = normalizeSheetName(ENGLISH_MONTHS[monthIndex]);
  return Array.from(
    new Set([hebrew, english, ...(ENGLISH_MONTH_ALIASES[monthIndex] || [])].map(normalizeSheetName).filter(Boolean))
  );
}

function createMonthBoundaryRegex(alias) {
  return new RegExp(`(^|\\s)${escapeRegex(alias)}(\\s|$)`, "i");
}

function createMonthNumberPatterns(monthIndex, year) {
  const monthNum = String(monthIndex + 1);
  const monthNumPadded = monthNum.padStart(2, "0");
  const yearStr = String(year);
  const prevYearStr = String(year - 1);
  const nextYearStr = String(year + 1);
  const yearCandidates = [yearStr, prevYearStr, nextYearStr];
  const patterns = [];

  for (const candidateYear of yearCandidates) {
    patterns.push(`${monthNum} ${candidateYear}`);
    patterns.push(`${monthNumPadded} ${candidateYear}`);
    patterns.push(`${candidateYear} ${monthNum}`);
    patterns.push(`${candidateYear} ${monthNumPadded}`);
  }

  return Array.from(new Set(patterns));
}

export function getReferenceDateFromPeriodLabel(periodLabel, fallbackDate = new Date()) {
  const normalized = normalizeSheetName(periodLabel);
  if (!normalized) return fallbackDate;

  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : fallbackDate.getFullYear();
  const monthIndex = HEBREW_MONTHS.findIndex((_, index) =>
    buildMonthAliases(index).some((alias) => createMonthBoundaryRegex(alias).test(normalized))
  );

  if (monthIndex === -1) return fallbackDate;
  return new Date(year, monthIndex, 1);
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
  const monthAliases = buildMonthAliases(ctx.monthIndex);
  const primaryHebrew = normalizeSheetName(ctx.hebrewMonth);
  const yearStr = String(ctx.year);
  const monthNumberPatterns = createMonthNumberPatterns(ctx.monthIndex, ctx.year);

  const scored = names.map((name) => {
    const norm = normalizeSheetName(name);
    let score = 0;
    const matchedAlias = monthAliases.find((alias) => {
      if (!alias) return false;
      return (
        norm === alias ||
        norm.startsWith(`${alias} `) ||
        norm.endsWith(` ${alias}`) ||
        createMonthBoundaryRegex(alias).test(norm)
      );
    });
    const hasMonthNumberPattern = monthNumberPatterns.some((pattern) => norm.includes(pattern));

    if (norm === primaryHebrew) score = 100;
    else if (matchedAlias && norm === `${matchedAlias} ${yearStr}`) score = 98;
    else if (matchedAlias && norm.startsWith(`${matchedAlias} `) && norm.includes(yearStr)) score = 95;
    else if (matchedAlias && matchedAlias === primaryHebrew) {
      score = 85;
    } else if (matchedAlias) score = 75;
    else if (hasMonthNumberPattern) {
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

/** זיהוי ערוץ (טלפון / WhatsApp) לפי כותרות העמודות */
export function detectMetricsChannel(columns = []) {
  const metricColumns = columns.slice(1);
  for (const col of metricColumns) {
    const norm = normalizeHeader(col);
    if ((norm.includes("ווטסאפ") || norm.includes("whatsapp")) && norm.includes("שעה")) {
      return "whatsapp";
    }
  }
  const hasWhatsapp = metricColumns.some((col) => {
    const norm = normalizeHeader(col);
    return norm.includes("ווטסאפ") || norm.includes("whatsapp");
  });
  const hasPhoneCalls = metricColumns.some((col) => {
    const norm = normalizeHeader(col);
    if (norm.includes("ווטסאפ") || norm.includes("whatsapp")) return false;
    if (!norm.includes("שעה") || norm.includes("משך")) return false;
    return norm.includes("שיחות") || norm.includes("שיחה");
  });
  if (hasWhatsapp && !hasPhoneCalls) return "whatsapp";
  return "phone";
}

/**
 * @param {File} file
 * @param {{ referenceDate?: Date }} [options]
 */
export async function parseMetricsFile(file, options = {}) {
  if (!file) throw new Error("לא נבחר קובץ");

  const referenceDate =
    options.referenceDate || getReferenceDateFromPeriodLabel(options.periodLabel, new Date());
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
      ? XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, cellDates: true })
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
    sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false, cellDates: true });
  }

  const parsed = parseMetricsSheetRows(sheetRows);
  const channel = detectMetricsChannel(parsed.columns);
  return {
    ...parsed,
    channel,
    sheetName,
    periodLabel: periodLabelFromSheet(sheetName, referenceDate),
    availableSheets,
  };
}

export function downloadMetricsTemplate(channel = "phone") {
  const ctx = getCurrentMonthSheetContext();
  const wb = XLSX.utils.book_new();

  if (channel === "whatsapp") {
    const headers = [
      "שם נציג",
      "ממוצע שיחות WhatsApp לשעה",
      "כמות טיפול במיילים",
      "ממוצע זמן טיפול",
      "אחוז אי זמינות",
    ];
    const sample = ["דנה לוי", 12.4, 58, "4:35", "18%"];
    const teamSample = ["ממוצע צוות", 10.8, 45, "5:10", "21%"];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, sample, teamSample]), ctx.hebrewMonth);
    XLSX.writeFile(wb, "template-agent-metrics-whatsapp.xlsx");
    return;
  }

  const headers = [
    "שם נציג",
    "ממוצע שיחות לשעה",
    "זמן התחברות",
    "אחוז תיעוד",
    "כמות טיפול במיילים",
    "ממוצע משך שיחה",
    "אחוז אי זמינות",
  ];
  const sample = ["אוראל קליפה", 8.5, "08:22:41", "88%", 42, "6:39", "21%"];
  const teamSample = ["ממוצע צוות", 7.8, "07:55:00", "85%", 38, "7:05", "22%"];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, sample, teamSample]), ctx.hebrewMonth);
  XLSX.writeFile(wb, "template-agent-metrics-phone.xlsx");
}
