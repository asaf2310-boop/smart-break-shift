import { useEffect, useMemo, useState } from "react";
import { loadAllMetricsSnapshots } from "@/lib/agentMetricsApi";
import { filterMetricsColumns } from "@/lib/agentMetricsFormat";
import { isTeamAverageLabel, partitionMetricsRows } from "@/lib/agentMetricsImport";
import {
  DEFAULT_METRICS_POINT_SETTINGS,
  loadMetricsPointSettings,
} from "@/lib/agentMetricsPointSettings";
import {
  getMetricsRankingNote,
  getUnifiedRankingNote,
  mergeDisplayColumns,
  METRICS_CHANNEL,
  rankMetricRows,
  rankUnifiedMetricRows,
} from "@/lib/agentMetricsScoring";

function resolveTeamSummary(snapshot) {
  if (!snapshot) return null;
  if (snapshot.upload?.team_summary?.metrics) {
    return snapshot.upload.team_summary;
  }
  const fromRows = (snapshot.rows || []).find((row) => isTeamAverageLabel(row.agent_name));
  if (fromRows) {
    return { label: fromRows.agent_name, metrics: fromRows.metrics };
  }
  return null;
}

function mapSnapshotRows(snapshot) {
  return (snapshot?.rows || []).map((r) => ({
    agentName: r.agent_name,
    agent_name: r.agent_name,
    metrics: r.metrics,
    id: r.id,
  }));
}

function buildChannelView(snapshot, channel, pointSettings) {
  const displayColumns = filterMetricsColumns(snapshot?.columns || []);
  const teamSummary = resolveTeamSummary(snapshot);

  const rankedRows = (() => {
    if (!snapshot?.rows?.length) return [];
    const { agentRows } = partitionMetricsRows(mapSnapshotRows(snapshot));
    return rankMetricRows(agentRows, displayColumns, channel, pointSettings);
  })();

  const rankingNote = getMetricsRankingNote(displayColumns, channel, pointSettings);

  return {
    snapshot,
    displayColumns,
    rankedRows,
    teamSummary,
    rankingNote,
    hasData: Boolean(snapshot?.upload && rankedRows.length),
  };
}

function buildUnifiedView(phoneSnapshot, whatsappSnapshot, pointSettings) {
  const phoneColumns = filterMetricsColumns(phoneSnapshot?.columns || []);
  const whatsappColumns = filterMetricsColumns(whatsappSnapshot?.columns || []);
  const displayColumns = mergeDisplayColumns(phoneColumns, whatsappColumns);

  const { agentRows: phoneAgents } = partitionMetricsRows(mapSnapshotRows(phoneSnapshot));
  const { agentRows: waAgents } = partitionMetricsRows(mapSnapshotRows(whatsappSnapshot));

  const rankedRows = rankUnifiedMetricRows({
    phoneRows: phoneAgents,
    phoneColumns,
    whatsappRows: waAgents,
    whatsappColumns,
    pointSettings,
  });

  const periodLabel =
    phoneSnapshot?.upload?.period_label ||
    whatsappSnapshot?.upload?.period_label ||
    "";

  return {
    snapshot: phoneSnapshot || whatsappSnapshot,
    phoneSnapshot,
    whatsappSnapshot,
    displayColumns,
    rankedRows,
    rankingNote: getUnifiedRankingNote(pointSettings),
    periodLabel,
    hasData: rankedRows.length > 0,
  };
}

export function useAgentMetricsSnapshots() {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState({ phone: null, whatsapp: null });
  const [pointSettings, setPointSettings] = useState({ ...DEFAULT_METRICS_POINT_SETTINGS });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [data, settings] = await Promise.all([
          loadAllMetricsSnapshots(),
          loadMetricsPointSettings(),
        ]);
        if (!cancelled) {
          setSnapshots(data);
          setPointSettings(settings);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onSettingsChange = async () => {
      const settings = await loadMetricsPointSettings();
      setPointSettings(settings);
    };
    window.addEventListener("metrics-point-settings-changed", onSettingsChange);
    return () => window.removeEventListener("metrics-point-settings-changed", onSettingsChange);
  }, []);

  const phone = useMemo(
    () => buildChannelView(snapshots.phone, METRICS_CHANNEL.phone, pointSettings),
    [snapshots.phone, pointSettings]
  );

  const whatsapp = useMemo(
    () => buildChannelView(snapshots.whatsapp, METRICS_CHANNEL.whatsapp, pointSettings),
    [snapshots.whatsapp, pointSettings]
  );

  const unified = useMemo(
    () => buildUnifiedView(snapshots.phone, snapshots.whatsapp, pointSettings),
    [snapshots.phone, snapshots.whatsapp, pointSettings]
  );

  const hasAnyData = unified.hasData;

  return { loading, phone, whatsapp, unified, pointSettings, hasAnyData };
}

/** תאימות לאחור */
export function useAgentMetricsSnapshot() {
  const { loading, unified, hasAnyData } = useAgentMetricsSnapshots();
  return {
    loading,
    snapshot: unified.snapshot,
    displayColumns: unified.displayColumns,
    rankedRows: unified.rankedRows,
    teamSummary: null,
    rankingNote: unified.rankingNote,
    hasData: hasAnyData,
  };
}
