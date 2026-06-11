const STORAGE_KEY = "smart-break-shift-agent-metrics-v2";
const LEGACY_STORAGE_KEY = "smart-break-shift-agent-metrics-v1";

function emptyChannelState() {
  return { upload: null, rows: [] };
}

function readState() {
  if (typeof window === "undefined") {
    return { phone: emptyChannelState(), whatsapp: emptyChannelState() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        phone: parsed.phone ?? emptyChannelState(),
        whatsapp: parsed.whatsapp ?? emptyChannelState(),
      };
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy.upload) {
        return {
          phone: {
            upload: { ...legacy.upload, channel: "phone" },
            rows: Array.isArray(legacy.rows) ? legacy.rows : [],
          },
          whatsapp: emptyChannelState(),
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { phone: emptyChannelState(), whatsapp: emptyChannelState() };
}

function writeState(state) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function snapshotFromChannel(entry) {
  if (!entry?.upload) return null;
  return {
    upload: entry.upload,
    rows: entry.rows ?? [],
    columns: Array.isArray(entry.upload.column_headers) ? entry.upload.column_headers : [],
  };
}

export function getLatestMetricsSnapshot(channel = "phone") {
  const state = readState();
  return snapshotFromChannel(state[channel] || emptyChannelState());
}

export function getAllMetricsSnapshots() {
  const state = readState();
  return {
    phone: snapshotFromChannel(state.phone),
    whatsapp: snapshotFromChannel(state.whatsapp),
  };
}

export function getMetricsForAgent(agentName, channel = "phone") {
  const snapshot = getLatestMetricsSnapshot(channel);
  if (!snapshot) return snapshot;
  const name = String(agentName || "").trim();
  const rows = snapshot.rows.filter((r) => String(r.agent_name || "").trim() === name);
  return { ...snapshot, rows };
}

export function replaceMetricsDataset({
  channel = "phone",
  periodLabel,
  fileName,
  columns,
  rows,
  teamSummary,
}) {
  const uploadId = `demo_upload_${channel}_${Date.now()}`;
  const upload = {
    id: uploadId,
    channel,
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

  const state = readState();
  state[channel] = { upload, rows: storedRows };
  writeState(state);
  return { upload, rowCount: storedRows.length, channel };
}

export function clearMetricsDataset(channel) {
  const state = readState();
  if (channel) {
    state[channel] = emptyChannelState();
    writeState(state);
    return;
  }
  writeState({ phone: emptyChannelState(), whatsapp: emptyChannelState() });
}
