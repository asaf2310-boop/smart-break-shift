import { useEffect, useMemo, useState } from "react";
import { loadAllMetricsSnapshots } from "@/lib/agentMetricsApi";
import { filterMetricsColumns } from "@/lib/agentMetricsFormat";
import { isTeamAverageLabel, partitionMetricsRows } from "@/lib/agentMetricsImport";
import {
  getMetricsRankingNote,
  METRICS_CHANNEL,
  rankMetricRows,
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

function buildChannelView(snapshot, channel) {
  const displayColumns = filterMetricsColumns(snapshot?.columns || []);
  const teamSummary = resolveTeamSummary(snapshot);

  const rankedRows = (() => {
    if (!snapshot?.rows?.length) return [];
    const { agentRows } = partitionMetricsRows(
      snapshot.rows.map((r) => ({
        agentName: r.agent_name,
        agent_name: r.agent_name,
        metrics: r.metrics,
        id: r.id,
      }))
    );
    return rankMetricRows(agentRows, displayColumns, channel);
  })();

  const rankingNote = getMetricsRankingNote(displayColumns, channel);

  return {
    snapshot,
    displayColumns,
    rankedRows,
    teamSummary,
    rankingNote,
    hasData: Boolean(snapshot?.upload && rankedRows.length),
  };
}

export function useAgentMetricsSnapshots() {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState({ phone: null, whatsapp: null });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await loadAllMetricsSnapshots();
        if (!cancelled) setSnapshots(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const phone = useMemo(
    () => buildChannelView(snapshots.phone, METRICS_CHANNEL.phone),
    [snapshots.phone]
  );

  const whatsapp = useMemo(
    () => buildChannelView(snapshots.whatsapp, METRICS_CHANNEL.whatsapp),
    [snapshots.whatsapp]
  );

  const hasAnyData = phone.hasData || whatsapp.hasData;

  return { loading, phone, whatsapp, hasAnyData };
}

/** תאימות לאחור — מחזיר רק ערוץ טלפון */
export function useAgentMetricsSnapshot() {
  const { loading, phone, hasAnyData } = useAgentMetricsSnapshots();
  return {
    loading,
    snapshot: phone.snapshot,
    displayColumns: phone.displayColumns,
    rankedRows: phone.rankedRows,
    teamSummary: phone.teamSummary,
    rankingNote: phone.rankingNote,
    hasData: hasAnyData,
  };
}
