import React from "react";
import { formatMetricCell } from "@/lib/agentMetricsFormat";

/**
 * @param {{
 *   columns: string[],
 *   rows: Array<{ agent_name: string, metrics: Record<string, unknown>, _rank?: number }>,
 *   highlightAgentName?: string,
 *   showRank?: boolean,
 * }} props
 */
export default function AgentMetricsTable({
  columns = [],
  rows = [],
  highlightAgentName,
  showRank = false,
}) {
  const agentColumn = columns[0] || "שם נציג";
  const metricColumns = columns.slice(1);

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
            {metricColumns.map((col) => (
              <th key={col} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const highlighted =
              highlightAgentName &&
              String(row.agent_name || "").trim() === String(highlightAgentName).trim();
            const rank = row._rank;
            const isTop = showRank && rank === 1;
            return (
              <tr
                key={row.id || row.agent_name}
                className={
                  highlighted
                    ? "bg-teal-50 border-t border-teal-100"
                    : isTop
                      ? "bg-violet-50/80 border-t border-violet-100"
                      : "border-t border-slate-100 odd:bg-white even:bg-slate-50/50"
                }
              >
                {showRank && (
                  <td className="px-3 py-2.5 text-center font-bold text-violet-700">
                    {rank ?? "—"}
                  </td>
                )}
                <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                  {row.agent_name}
                </td>
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
