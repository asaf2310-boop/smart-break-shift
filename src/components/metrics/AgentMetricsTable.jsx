import React from "react";
import { Crown } from "lucide-react";
import { filterMetricsColumns, formatMetricCell } from "@/lib/agentMetricsFormat";
import { formatCompositeScore } from "@/lib/agentMetricsScoring";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   columns: string[],
 *   rows: Array<{ agent_name: string, metrics: Record<string, unknown>, _rank?: number, _compositeScore?: number }>,
 *   teamSummary?: { label?: string, metrics?: Record<string, unknown> } | null,
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
  teamSummary = null,
  highlightAgentName,
  showRank = false,
  showCompositeScore = true,
  highlightLeader = true,
  hideMetricColumns = false,
}) {
  const displayColumns = filterMetricsColumns(columns);
  const agentColumn = displayColumns[0] || "שם נציג";
  const metricColumns = hideMetricColumns ? [] : displayColumns.slice(1);
  const colCount =
    metricColumns.length + 1 + (showRank ? 1 : 0) + (showCompositeScore ? 1 : 0);

  if (!rows.length && !teamSummary) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        אין נתוני מדדים להצגה
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 w-full">
      <table className="w-full table-fixed text-[11px] sm:text-xs" dir="rtl">
        <colgroup>
          {showRank && <col style={{ width: "2.25rem" }} />}
          <col style={{ width: showRank ? "14%" : "16%" }} />
          {metricColumns.map((col) => (
            <col key={col} />
          ))}
          {showCompositeScore && <col style={{ width: "4.5rem" }} />}
        </colgroup>
        <thead>
          <tr className="bg-slate-100 text-slate-700">
            {showRank && (
              <th className="px-1 py-2 text-center font-semibold leading-tight">#</th>
            )}
            <th className="px-1.5 py-2 text-right font-semibold leading-tight break-words">
              {agentColumn}
            </th>
            {metricColumns.map((col) => (
              <th
                key={col}
                className="px-1 py-2 text-right font-semibold leading-tight break-words align-bottom"
                title={col}
              >
                {col}
              </th>
            ))}
            {showCompositeScore && (
              <th className="px-1 py-2 text-right font-semibold leading-tight bg-violet-100/80">
                ציון
              </th>
            )}
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
                      "px-1 py-1.5 text-center font-bold",
                      isLeader ? "text-amber-700" : "text-violet-700"
                    )}
                  >
                    {rank ?? "—"}
                  </td>
                )}
                <td className="px-1.5 py-1.5 font-medium text-slate-800 leading-snug break-words">
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    <span className="break-words">{row.agent_name}</span>
                    {isLeader && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-bold text-amber-900 shrink-0">
                        <Crown className="h-2.5 w-2.5" />
                        מוביל
                      </span>
                    )}
                    {isCurrentAgent && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0",
                          isLeader ? "bg-teal-600/90 text-white" : "bg-teal-200/80 text-teal-900"
                        )}
                      >
                        אתה
                      </span>
                    )}
                  </span>
                </td>
                {metricColumns.map((col) => (
                  <td
                    key={col}
                    className="px-1 py-1.5 text-slate-700 leading-snug break-words text-center sm:text-right"
                  >
                    {formatMetricCell(row.metrics?.[col], col)}
                  </td>
                ))}
                {showCompositeScore && (
                  <td
                    className={cn(
                      "px-1 py-1.5 font-bold bg-violet-50/50 text-center",
                      isLeader ? "text-amber-800" : "text-violet-800"
                    )}
                  >
                    {formatCompositeScore(row._compositeScore)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        {teamSummary?.metrics && Object.keys(teamSummary.metrics).length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-200/70 font-semibold text-slate-800">
              {showRank && <td className="px-1 py-2" />}
              <td className="px-1.5 py-2 break-words leading-snug">
                {teamSummary.label || "ממוצע צוות"}
              </td>
              {metricColumns.map((col) => (
                <td
                  key={col}
                  className="px-1 py-2 leading-snug break-words text-center sm:text-right"
                >
                  {formatMetricCell(teamSummary.metrics[col], col)}
                </td>
              ))}
              {showCompositeScore && <td className="px-1 py-2 text-center">—</td>}
            </tr>
          </tfoot>
        )}
      </table>
      {colCount > 6 && (
        <p className="px-2 py-1 text-[10px] text-slate-400 text-center border-t border-slate-100">
          טיפ: הקטנת זום בדפדפן מציגה את כל העמודות בנוחות
        </p>
      )}
    </div>
  );
}
