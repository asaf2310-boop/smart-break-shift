import * as XLSX from "xlsx";

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

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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

/**
 * @param {Record<string, unknown>[]} sheetRows — from XLSX sheet_to_json
 */
export function parseMetricsSheetRows(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
    return { columns: [], rows: [], errors: ["הקובץ ריק או ללא שורות נתונים"] };
  }

  const keys = Object.keys(sheetRows[0] || {}).filter((k) => k && String(k).trim());
  if (!keys.length) {
    return { columns: [], rows: [], errors: ["לא נמצאו עמודות בקובץ"] };
  }

  const agentKey = findAgentNameKey(keys);
  if (!agentKey) {
    return { columns: [], rows: [], errors: ["לא נמצאה עמודת שם נציג"] };
  }

  const metricKeys = keys.filter((k) => k !== agentKey);
  const columns = [agentKey, ...metricKeys];
  const rows = [];
  const errors = [];

  sheetRows.forEach((raw, index) => {
    const agentName = normalizeAgentName(raw[agentKey]);
    if (!agentName) return;

    const metrics = {};
    for (const key of metricKeys) {
      const val = raw[key];
      if (val === undefined || val === null || val === "") continue;
      metrics[key] = typeof val === "number" ? val : String(val).trim();
    }

    if (Object.keys(metrics).length === 0) {
      errors.push(`שורה ${index + 2}: אין מדדים עבור ${agentName}`);
      return;
    }

    rows.push({ agentName, metrics });
  });

  if (!rows.length) {
    errors.push("לא נמצאו שורות תקינות עם שם נציג ומדדים");
  }

  return { columns, rows, errors, agentColumn: agentKey };
}

export async function parseMetricsFile(file) {
  if (!file) throw new Error("לא נבחר קובץ");

  const name = String(file.name || "").toLowerCase();
  let sheetRows = [];

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: "string" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }

  return parseMetricsSheetRows(sheetRows);
}

export function downloadMetricsTemplate() {
  const headers = [
    "שם נציג",
    "שיחות",
    "זמן ממוצע (דק)",
    "עמידה ביעד %",
    "ציון שביעות רצון",
  ];
  const sample = ["אוראל כליפה", 120, 4.5, 92, 4.8];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "מדדים");
  XLSX.writeFile(wb, "template-agent-metrics.xlsx");
}
