import React from "react";
import { Crown } from "lucide-react";
import { formatMetricCell } from "@/lib/agentMetricsFormat";
import { formatCompositeScore } from "@/lib/agentMetricsScoring";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   columns: string[],
 *   rows: Array<{ agent_name: string, metrics: Record<string, unknown>, _rank?: number, _compositeScore?: number }>,
 *   highlightAgentName?: string,
 *   showRank?: boolean,
 *   showCompositeScore?: boolean,
 *   highlightLeader?: boolean,
 *   hideMetricColumns?: boolean,
 * }} props
 */
export default function AgentMetricsTable({
  columns = [],
  rows = [],
  highlightAgentName,
  showRank = false,
  showCompositeScore = false,
  highlightLeader = true,
  hideMetricColumns = false,
}) {
  const agentColumn = columns[0] || "שם נציג";
  const metricColumns = hideMetricColumns ? [] : columns.slice(1);

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        אין נתוני מדדים להצגה
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[480px] text-sm" dir="rtl">
        <thead>
          <tr className="bg-slate-100 text-slate-700">
            {showRank && (
              <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap w-12">#</th>
            )}
            <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{agentColumn}</th>
            {showCompositeScore && (
              <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">ציון משוקלל</th>
            )}
            {metricColumns.map((col) => (
              <th key={col} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rank = row._rank;
            const isLeader = highlightLeader && showRank && rank === 1;
            const isCurrentAgent =
              highlightAgentName &&
              String(row.agent_name || "").trim() === String(highlightAgentName).trim();
            return (
              <tr
                key={row.id || row.agent_name}
                className={cn(
                  "border-t",
                  isLeader
                    ? "bg-amber-50 border-amber-200/80"
                    : isCurrentAgent
                      ? "bg-teal-50/90 border-teal-100"
                      : "border-slate-100 odd:bg-white even:bg-slate-50/50"
                )}
              >
                {showRank && (
                  <td
                    className={cn(
                      "px-3 py-2.5 text-center font-bold",
                      isLeader ? "text-amber-700" : "text-violet-700"
                    )}
                  >
                    {rank ?? "—"}
                  </td>
                )}
                <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    {row.agent_name}
                    {isLeader && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                        <Crown className="h-3 w-3" />
                        מוביל
                      </span>
                    )}
                    {isCurrentAgent && !isLeader && (
                      <span className="rounded-full bg-teal-200/80 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
                        אתה
                      </span>
                    )}
                    {isCurrentAgent && isLeader && (
                      <span className="rounded-full bg-teal-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                        אתה
                      </span>
                    )}
                  </span>
                </td>
                {showCompositeScore && (
                  <td
                    className={cn(
                      "px-3 py-2.5 font-semibold whitespace-nowrap",
                      isLeader ? "text-amber-800" : "text-slate-700"
                    )}
                  >
                    {formatCompositeScore(row._compositeScore)}
                  </td>
                )}
                {metricColumns.map((col) => (
                  <td key={col} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    {formatMetricCell(row.metrics?.[col], col)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
