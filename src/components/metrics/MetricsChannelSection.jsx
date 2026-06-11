import React from "react";
import { MessageCircle, Phone } from "lucide-react";
import AgentMetricsTable from "@/components/metrics/AgentMetricsTable";
import { getChannelLabel } from "@/lib/agentMetricsScoring";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   channel: 'phone' | 'whatsapp',
 *   view: { snapshot, displayColumns, rankedRows, teamSummary, rankingNote, hasData },
 *   highlightAgentName?: string,
 *   showRank?: boolean,
 *   showCompositeScore?: boolean,
 *   hideMetricColumns?: boolean,
 *   className?: string,
 * }} props
 */
export default function MetricsChannelSection({
  channel,
  view,
  highlightAgentName,
  showRank = true,
  showCompositeScore = true,
  hideMetricColumns = false,
  className,
}) {
  const Icon = channel === "whatsapp" ? MessageCircle : Phone;
  const accent =
    channel === "whatsapp"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
      : "border-violet-200 bg-violet-50/60 text-violet-950";

  if (!view.hasData) {
    return (
      <div className={cn("rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center", className)}>
        <div className="flex items-center justify-center gap-2 text-slate-600 text-sm font-medium mb-1">
          <Icon className="h-4 w-4" />
          {getChannelLabel(channel)}
        </div>
        <p className="text-xs text-slate-500">אין נתונים שפורסמו לערוץ זה.</p>
      </div>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className={cn("rounded-xl border px-4 py-3", accent)}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <Icon className="h-4 w-4 shrink-0" />
          <h2 className="text-sm font-bold">{getChannelLabel(channel)}</h2>
          {view.snapshot?.upload?.period_label && (
            <span className="text-xs opacity-80">· {view.snapshot.upload.period_label}</span>
          )}
        </div>
        <p className="text-xs leading-relaxed opacity-90">{view.rankingNote}</p>
      </div>

      <AgentMetricsTable
        columns={view.displayColumns}
        rows={view.rankedRows}
        teamSummary={view.teamSummary}
        highlightAgentName={highlightAgentName}
        showRank={showRank}
        showCompositeScore={showCompositeScore}
        highlightLeader
        hideMetricColumns={hideMetricColumns}
      />
    </section>
  );
}
