const STORAGE_KEY = "smart-break-shift-agent-metrics-v1";

function readState() {
  if (typeof window === "undefined") {
    return { upload: null, rows: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { upload: null, rows: [] };
    const parsed = JSON.parse(raw);
    return {
      upload: parsed.upload ?? null,
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    };
  } catch {
    return { upload: null, rows: [] };
  }
}

function writeState(state) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getLatestMetricsSnapshot() {
  const { upload, rows } = readState();
  if (!upload) return null;
  return {
    upload,
    rows,
    columns: upload.column_headers || [],
  };
}

export function getMetricsForAgent(agentName) {
  const snapshot = getLatestMetricsSnapshot();
  if (!snapshot) return snapshot;
  const name = String(agentName || "").trim();
  const rows = snapshot.rows.filter(
    (r) => String(r.agent_name || "").trim() === name
  );
  return { ...snapshot, rows };
}

export function replaceMetricsDataset({ periodLabel, fileName, columns, rows, teamSummary }) {
  const uploadId = `demo_upload_${Date.now()}`;
  const upload = {
    id: uploadId,
    period_label: periodLabel || "",
    file_name: fileName || "",
    column_headers: columns,
    team_summary: teamSummary || null,
    uploaded_at: new Date().toISOString(),
  };
  const storedRows = rows.map((row, index) => ({
    id: `demo_row_${uploadId}_${index}`,
    upload_id: uploadId,
    agent_name: row.agentName,
    metrics: row.metrics,
    created_at: new Date().toISOString(),
  }));
  writeState({ upload, rows: storedRows });
  return { upload, rowCount: storedRows.length };
}

export function clearMetricsDataset() {
  writeState({ upload: null, rows: [] });
}
