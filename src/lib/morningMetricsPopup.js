const STORAGE_PREFIX = "hyp_morning_metrics_popup";

/** Calendar date in Israel (YYYY-MM-DD) for once-per-day logic. */
export function getIsraelDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(date);
}

/** Morning window in Israel — 05:00–13:59. */
export function isMorningInIsrael(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  return hour >= 5 && hour < 14;
}

function storageKey(agentName, dateKey) {
  const agent = String(agentName || "").trim();
  if (!agent) return null;
  return `${STORAGE_PREFIX}:${agent}:${dateKey}`;
}

export function wasMorningMetricsPopupShown(agentName, dateKey = getIsraelDateKey()) {
  const key = storageKey(agentName, dateKey);
  if (!key || typeof localStorage === "undefined") return false;
  return localStorage.getItem(key) === "1";
}

export function markMorningMetricsPopupShown(agentName, dateKey = getIsraelDateKey()) {
  const key = storageKey(agentName, dateKey);
  if (!key || typeof localStorage === "undefined") return;
  localStorage.setItem(key, "1");
}

export function isMorningMetricsPreviewForced() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("morningMetrics") === "1";
  } catch {
    return false;
  }
}

export function shouldShowMorningMetricsPopup(agentName, { date = new Date() } = {}) {
  const name = String(agentName || "").trim();
  if (!name) return false;
  if (isMorningMetricsPreviewForced()) return true;
  if (!isMorningInIsrael(date)) return false;
  const dateKey = getIsraelDateKey(date);
  return !wasMorningMetricsPopupShown(name, dateKey);
}
