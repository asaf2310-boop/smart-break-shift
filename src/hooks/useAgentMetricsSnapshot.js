import { useEffect, useMemo, useState } from "react";
import { loadLatestMetrics } from "@/lib/agentMetricsApi";
import { getMetricsRankingNote, rankMetricRows } from "@/lib/agentMetricsScoring";

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

  const rankedRows = useMemo(() => {
    if (!snapshot?.rows?.length) return [];
    return rankMetricRows(snapshot.rows, snapshot.columns || []);
  }, [snapshot]);

  const rankingNote = useMemo(
    () => getMetricsRankingNote(snapshot?.columns || []),
    [snapshot?.columns]
  );

  return { loading, snapshot, rankedRows, rankingNote };
}
