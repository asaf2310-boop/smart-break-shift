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

export function isDurationMinutesColumn(columnName) {
  const norm = normalizeHeader(columnName);
  if (norm.includes("דק")) return true;
  if (norm.includes("משך שיחה") || norm.includes("ממוצע משך")) return true;
  if (norm.includes("זמן ממוצע") || norm.includes("משך")) return true;
  if (norm.includes("aht") || norm.includes("handle time")) return true;
  if (norm.includes("duration") && (norm.includes("min") || norm.includes("דק"))) return true;
  return false;
}

/** ערך מספרי לדירוג — מנרמל אחוזים מ-Excel (0.92 → 92) */
export function metricValueForScoring(value, columnName) {
  const n = parseMetricNumber(value);
  if (n === null) return null;
  if (isPercentColumn(columnName) && n > 0 && n <= 1) return n * 100;
  if (isDurationMinutesColumn(columnName) && n >= 60 && n < 6000) return n / 60;
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

function formatDurationMinutes(value) {
  const str = String(value).trim();
  const clockMatch = str.match(/^(\d{1,3}):(\d{1,2})$/);
  if (clockMatch) {
    const mins = Number.parseInt(clockMatch[1], 10);
    const secs = Number.parseInt(clockMatch[2], 10);
    if (secs === 0) return `${mins} דק'`;
    return `${mins}:${String(secs).padStart(2, "0")} דק'`;
  }

  const n = parseMetricNumber(value);
  if (n === null) return str;

  let totalMinutes = n;
  if (n >= 60 && n < 6000) {
    totalMinutes = n / 60;
  }

  const mins = Math.floor(totalMinutes);
  let secs = Math.round((totalMinutes - mins) * 60);
  if (secs === 60) {
    return `${mins + 1} דק'`;
  }
  if (secs === 0) {
    if (Math.abs(totalMinutes - mins) < 0.001) return `${mins} דק'`;
    return `${totalMinutes.toFixed(1)} דק'`;
  }
  return `${mins}:${String(secs).padStart(2, "0")} דק'`;
}

export function formatMetricCell(value, columnName) {
  if (value === null || value === undefined || value === "") return "—";

  if (isPercentColumn(columnName)) {
    return formatPercent(value);
  }
  if (isDurationMinutesColumn(columnName)) {
    return formatDurationMinutes(value);
  }

  const n = parseMetricNumber(value);
  if (n !== null) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  return String(value).trim();
}
