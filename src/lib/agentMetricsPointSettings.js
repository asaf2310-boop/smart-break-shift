import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";

export const METRICS_POINT_SETTINGS_KEY = "agent-metrics-point-settings-v1";
export const METRICS_POINT_SETTINGS_ROW_ID = "default";

export const DEFAULT_METRICS_POINT_SETTINGS = {
  phoneCall: 1,
  whatsappCall: 0.5,
  email: 0.75,
  ticket: 0.75,
};

export function normalizeMetricsPointSettings(raw) {
  const base = { ...DEFAULT_METRICS_POINT_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base)) {
    const n = Number.parseFloat(raw[key]);
    if (Number.isFinite(n) && n >= 0) base[key] = n;
  }
  return base;
}

function readLocalSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_METRICS_POINT_SETTINGS };
  try {
    const raw = localStorage.getItem(METRICS_POINT_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_METRICS_POINT_SETTINGS };
    return normalizeMetricsPointSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_METRICS_POINT_SETTINGS };
  }
}

function writeLocalSettings(settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(METRICS_POINT_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("metrics-point-settings-changed"));
}

async function fetchCloudSettings() {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from("agent_metrics_settings")
    .select("point_values")
    .eq("id", METRICS_POINT_SETTINGS_ROW_ID)
    .maybeSingle();
  if (error) {
    console.warn("[agentMetricsPointSettings] cloud load failed", error);
    return null;
  }
  return normalizeMetricsPointSettings(data?.point_values);
}

export async function loadMetricsPointSettings() {
  if (supabaseConfigured && !demoModeEnabled && supabase) {
    const cloud = await fetchCloudSettings();
    if (cloud) {
      writeLocalSettings(cloud);
      return cloud;
    }
  }
  return readLocalSettings();
}

export async function saveMetricsPointSettings(settings) {
  const normalized = normalizeMetricsPointSettings(settings);
  writeLocalSettings(normalized);

  if (supabaseConfigured && !demoModeEnabled && supabase) {
    const { error } = await supabase.from("agent_metrics_settings").upsert({
      id: METRICS_POINT_SETTINGS_ROW_ID,
      point_values: normalized,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  return normalized;
}
