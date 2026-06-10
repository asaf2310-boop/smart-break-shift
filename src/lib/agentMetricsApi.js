import { demoModeEnabled } from "@/api/demoClient";
import { supabase, supabaseConfigured } from "@/api/supabase";
import { agentOwnsBreakRegistration } from "@/lib/breakCapacity";
import {
  clearMetricsDataset,
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

async function fetchLatestFromCloud() {
  const { data: uploads, error: uploadError } = await supabase
    .from("agent_metrics_uploads")
    .select("*")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (uploadError) throw new Error(uploadError.message);
  const upload = uploads?.[0];
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

export async function loadLatestMetrics() {
  if (!agentMetricsEnabled()) return null;
  if (cloudEnabled()) {
    try {
      return await fetchLatestFromCloud();
    } catch (err) {
      console.warn("[agentMetricsApi] cloud load failed", err);
      return getLatestMetricsSnapshot();
    }
  }
  return getLatestMetricsSnapshot();
}

export async function loadMetricsForAgent(agentName) {
  const snapshot = await loadLatestMetrics();
  if (!snapshot) return null;
  const rows = snapshot.rows.filter((r) =>
    agentOwnsBreakRegistration({ agent_name: r.agent_name }, agentName)
  );
  return { ...snapshot, rows };
}

export async function importMetricsDataset({
  periodLabel,
  fileName,
  columns,
  rows,
}) {
  if (!rows?.length) throw new Error("אין שורות לייבוא");

  if (cloudEnabled()) {
    await supabase
      .from("agent_metrics_uploads")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    const { data: uploadRows, error: uploadError } = await supabase
      .from("agent_metrics_uploads")
      .insert({
        period_label: periodLabel || "",
        file_name: fileName || "",
        column_headers: columns,
      })
      .select("*")
      .single();

    if (uploadError) throw new Error(uploadError.message);

    const payload = rows.map((row) => ({
      upload_id: uploadRows.id,
      agent_name: row.agentName,
      metrics: row.metrics,
    }));

    const { error: rowsError } = await supabase
      .from("agent_metrics_rows")
      .insert(payload);

    if (rowsError) throw new Error(rowsError.message);

    return { upload: uploadRows, rowCount: payload.length };
  }

  return replaceMetricsDataset({ periodLabel, fileName, columns, rows });
}

export async function clearAllMetrics() {
  if (cloudEnabled()) {
    const { error } = await supabase
      .from("agent_metrics_uploads")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
    return;
  }
  clearMetricsDataset();
}
