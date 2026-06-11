function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
  if (norm.includes("תיעוד")) return true;
  if (norm.includes("אי זמינות") || norm.includes("לא זמין")) return true;
  if (norm.includes("עמידה ביעד") || norm.includes("יעד")) return true;
  if (norm.includes("percent") || norm.includes("pct")) return true;
  if (norm.includes("unavail")) return true;
  return false;
}

/** זמן התחברות — בדקות כמו ב-Excel */
export function isConnectionTimeColumn(columnName) {
  const norm = normalizeHeader(columnName);
  if (norm.includes("זמן התחברות") || norm.includes("התחברות")) return true;
  if (norm.includes("connection time") || norm.includes("login time")) return true;
  return false;
}

export function isDurationMinutesColumn(columnName) {
  const norm = normalizeHeader(columnName);
  if (isConnectionTimeColumn(columnName)) return true;
  if (norm.includes("דק")) return true;
  if (norm.includes("משך שיחה") || norm.includes("ממוצע משך")) return true;
  if (norm.includes("זמן ממוצע")) return true;
  if (norm.includes("aht") || norm.includes("handle time")) return true;
  if (norm.includes("duration") && (norm.includes("min") || norm.includes("דק"))) return true;
  return false;
}

/** המרה לדקות — תואם Excel (עשרוני, שבר יום, או mm:ss) */
export function parseDurationToMinutes(value, columnName = "") {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60;
  }

  const str = String(value).trim();
  const hms = str.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hms) {
    const first = Number.parseInt(hms[1], 10);
    const second = Number.parseInt(hms[2], 10);
    const third = hms[3] !== undefined ? Number.parseInt(hms[3], 10) : null;
    if (third !== null) return first * 60 + second + third / 60;
    return first + second / 60;
  }

  const n = parseMetricNumber(value);
  if (n === null) return null;

  const norm = normalizeHeader(columnName);

  // Excel time cell — שבר מיום (למשל 4.5 דק' ≈ 0.003125)
  if (n > 0 && n < 1) return n * 24 * 60;

  // עמודה מסומנת במפורש כדקות
  if (norm.includes("דק")) return n;

  // ברירת מחדל: הערך ב-Excel הוא כבר בדקות (למשל 4.5)
  return n;
}

/** ערך מספרי לדירוג — מנרמל אחוזים מ-Excel (0.92 → 92) */
export function metricValueForScoring(value, columnName) {
  const n = parseMetricNumber(value);
  if (n === null) return null;
  if (isPercentColumn(columnName) && n > 0 && n <= 1) return n * 100;
  if (isDurationMinutesColumn(columnName)) {
    return parseDurationToMinutes(value, columnName);
  }
  return n;
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

export function formatDurationMinutes(value, columnName = "") {
  const totalMinutes = parseDurationToMinutes(value, columnName);
  if (totalMinutes === null) {
    const str = String(value ?? "").trim();
    return str || "—";
  }

  const rounded = Math.round(totalMinutes * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return `${Math.round(rounded)} דק'`;
  }
  return `${rounded.toFixed(1)} דק'`;
}

export function formatMetricCell(value, columnName) {
  if (value === null || value === undefined || value === "") return "—";

  if (isPercentColumn(columnName)) {
    return formatPercent(value);
  }
  if (isDurationMinutesColumn(columnName)) {
    return formatDurationMinutes(value, columnName);
  }

  const n = parseMetricNumber(value);
  if (n !== null) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  return String(value).trim();
}
