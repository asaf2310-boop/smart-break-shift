import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";
import { agentOwnsBreakRegistration } from "@/lib/breakCapacity";
import {
  clearMetricsDataset,
  getAllMetricsSnapshots,
  getLatestMetricsSnapshot,
  getMetricsForAgent,
  replaceMetricsDataset,
} from "@/lib/agentMetricsStore";

export function agentMetricsEnabled() {
  return demoModeEnabled || supabaseConfigured;
}

function cloudEnabled() {
  return supabaseConfigured && !demoModeEnabled && Boolean(supabase);
}

async function fetchChannelFromCloud(channel) {
  let query = supabase
    .from("agent_metrics_uploads")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { data: uploads, error: uploadError } = await query;
  if (uploadError) throw new Error(uploadError.message);

  const upload = (uploads || []).find((row) => (row.channel || "phone") === channel) || uploads?.[0];
  if (!upload) return null;

  const { data: rows, error: rowsError } = await supabase
    .from("agent_metrics_rows")
    .select("*")
    .eq("upload_id", upload.id)
    .order("agent_name", { ascending: true });

  if (rowsError) throw new Error(rowsError.message);

  return {
    upload,
    rows: rows ?? [],
    columns: Array.isArray(upload.column_headers) ? upload.column_headers : [],
  };
}

async function fetchAllFromCloud() {
  const phone = await fetchChannelFromCloud("phone");
  const whatsapp = await fetchChannelFromCloud("whatsapp");
  return { phone, whatsapp };
}

export async function loadAllMetricsSnapshots() {
  if (!agentMetricsEnabled()) return { phone: null, whatsapp: null };
  if (cloudEnabled()) {
    try {
      return await fetchAllFromCloud();
    } catch (err) {
      console.warn("[agentMetricsApi] cloud load failed", err);
      return getAllMetricsSnapshots();
    }
  }
  return getAllMetricsSnapshots();
}

/** @deprecated השתמשו ב-loadAllMetricsSnapshots */
export async function loadLatestMetrics(channel = "phone") {
  const all = await loadAllMetricsSnapshots();
  return all[channel] || all.phone;
}

export async function loadMetricsForAgent(agentName, channel = "phone") {
  const snapshot = await loadLatestMetrics(channel);
  if (!snapshot) return null;
  const rows = snapshot.rows.filter((r) =>
    agentOwnsBreakRegistration({ agent_name: r.agent_name }, agentName)
  );
  return { ...snapshot, rows };
}

export async function importMetricsDataset({
  channel = "phone",
  periodLabel,
  fileName,
  columns,
  rows,
  teamSummary,
}) {
  if (!rows?.length) throw new Error("אין שורות לייבוא");

  if (cloudEnabled()) {
    await supabase.from("agent_metrics_uploads").delete().eq("channel", channel);

    const { data: uploadRows, error: uploadError } = await supabase
      .from("agent_metrics_uploads")
      .insert({
        channel,
        period_label: periodLabel || "",
        file_name: fileName || "",
        column_headers: columns,
        team_summary: teamSummary || null,
      })
      .select("*")
      .single();

    if (uploadError) throw new Error(uploadError.message);

    const payload = rows.map((row) => ({
      upload_id: uploadRows.id,
      agent_name: row.agentName,
      metrics: row.metrics,
    }));

    const { error: rowsError } = await supabase.from("agent_metrics_rows").insert(payload);
    if (rowsError) throw new Error(rowsError.message);

    return { upload: uploadRows, rowCount: payload.length, channel };
  }

  return replaceMetricsDataset({ channel, periodLabel, fileName, columns, rows, teamSummary });
}

export async function clearAllMetrics(channel) {
  if (cloudEnabled()) {
    let query = supabase.from("agent_metrics_uploads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (channel) {
      query = supabase.from("agent_metrics_uploads").delete().eq("channel", channel);
    }
    const { error } = await query;
    if (error) throw new Error(error.message);
    return;
  }
  clearMetricsDataset(channel);
}
