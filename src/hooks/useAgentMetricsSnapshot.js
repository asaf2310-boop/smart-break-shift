import { useEffect, useMemo, useState } from "react";
import { loadLatestMetrics } from "@/lib/agentMetricsApi";
import { isTeamAverageLabel, partitionMetricsRows } from "@/lib/agentMetricsImport";
import { getMetricsRankingNote, rankMetricRows } from "@/lib/agentMetricsScoring";

function resolveTeamSummary(snapshot) {
  if (!snapshot) return null;
  if (snapshot.upload?.team_summary?.metrics) {
    return snapshot.upload.team_summary;
  }
  const fromRows = (snapshot.rows || []).find((row) =>
    isTeamAverageLabel(row.agent_name)
  );
  if (fromRows) {
    return { label: fromRows.agent_name, metrics: fromRows.metrics };
  }
  return null;
}

export function useAgentMetricsSnapshot() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await loadLatestMetrics();
        if (!cancelled) setSnapshot(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamSummary = useMemo(() => resolveTeamSummary(snapshot), [snapshot]);

  const rankedRows = useMemo(() => {
    if (!snapshot?.rows?.length) return [];
    const { agentRows } = partitionMetricsRows(
      snapshot.rows.map((r) => ({
        agentName: r.agent_name,
        agent_name: r.agent_name,
        metrics: r.metrics,
        id: r.id,
      }))
    );
    return rankMetricRows(agentRows, snapshot.columns || []);
  }, [snapshot]);

  const rankingNote = useMemo(
    () => getMetricsRankingNote(snapshot?.columns || []),
    [snapshot?.columns]
  );

  return { loading, snapshot, rankedRows, teamSummary, rankingNote };
}
