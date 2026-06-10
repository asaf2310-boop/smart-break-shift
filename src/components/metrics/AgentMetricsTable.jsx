import React from "react";

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

/**
 * @param {{ columns: string[], rows: Array<{ agent_name: string, metrics: Record<string, unknown> }>, highlightAgentName?: string }} props
 */
export default function AgentMetricsTable({ columns = [], rows = [], highlightAgentName }) {
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
            return (
              <tr
                key={row.id || row.agent_name}
                className={
                  highlighted
                    ? "bg-teal-50 border-t border-teal-100"
                    : "border-t border-slate-100 odd:bg-white even:bg-slate-50/50"
                }
              >
                <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                  {row.agent_name}
                </td>
                {metricColumns.map((col) => (
                  <td key={col} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    {formatCell(row.metrics?.[col])}
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
