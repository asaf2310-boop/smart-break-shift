import {
  isDurationMinutesColumn,
  metricValueForScoring,
  parseMetricNumber,
} from "@/lib/agentMetricsFormat";

const CALLS_PER_HOUR_HEADERS = new Set([
  "שיחות ממוצע לשעה",
  "ממוצע שיחות לשעה",
  "שיחות לשעה",
  "שיחות/שעה",
  "calls per hour",
  "cph",
  "avg calls per hour",
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

/**
 * דירוג נציגים: 50% שקלול לפי שיחות ממוצע לשעה, 50% ממוצע שאר המדדים המספריים.
 * @param {Array<{ agent_name?: string, agentName?: string, metrics: Record<string, unknown>, id?: string }>} rows
 * @param {string[]} columns
 */
export function rankMetricRows(rows = [], columns = []) {
  if (!rows.length) return [];

  const metricColumns = columns.slice(1);
  const callsCol = findCallsPerHourColumn(metricColumns);
  const otherCols = metricColumns.filter((c) => c !== callsCol);

  const callsValues = rows.map((r) => parseMetricNumber(r.metrics?.[callsCol]));
  const callsNorm = normalizeSeries(callsValues, { higherIsBetter: true });

  const otherNormByCol = otherCols.map((col) => {
    const higherIsBetter = !isDurationMinutesColumn(col);
    const vals = rows.map((r) => metricValueForScoring(r.metrics?.[col], col));
    return normalizeSeries(vals, { higherIsBetter });
  });

  const scored = rows.map((row, index) => {
    let otherSum = 0;
    let otherCount = 0;
    otherNormByCol.forEach((series) => {
      otherSum += series[index] ?? 0;
      otherCount += 1;
    });
    const otherAvg = otherCount ? otherSum / otherCount : 0;
    const callsScore = callsCol ? callsNorm[index] ?? 0 : 0;
    const compositeScore = callsCol ? callsScore * 0.5 + otherAvg * 0.5 : otherAvg;

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
  const callsCol = findCallsPerHourColumn(columns.slice(1));
  if (callsCol) {
    return `דירוג: 50% לפי «${callsCol}», 50% ממוצע שאר המדדים (גבוה יותר = טוב יותר).`;
  }
  return "דירוג: ממוצע כל המדדים המספריים (מומלץ לכלול עמודת «שיחות ממוצע לשעה» לשקלול 50%).";
}

/** ציון משוקלל 0–100 להצגה */
export function formatCompositeScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return "—";
  return `${Math.round(Number(score) * 100)}`;
}
