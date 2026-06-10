import React from "react";
import { motion } from "framer-motion";
import { Loader2, Trophy } from "lucide-react";
import AgentMetricsTable from "@/components/metrics/AgentMetricsTable";
import MetricsSubNav from "@/components/metrics/MetricsSubNav";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { useAgentMetricsSnapshot } from "@/hooks/useAgentMetricsSnapshot";
import { useAgentSession } from "@/hooks/useAgentSession";
import { getStoredAgentName } from "@/constants/scheduling";

export default function AgentMetricsRankingPage() {
  const { displayName } = useAgentSession();
  const agentName = displayName || getStoredAgentName();
  const { loading, snapshot, rankedRows, rankingNote } = useAgentMetricsSnapshot();

  const myRow = rankedRows.find(
    (r) => String(r.agent_name || "").trim() === String(agentName || "").trim()
  );

  return (
    <HypPageLayout variant="scheduling" contentClassName="max-w-5xl px-4 py-8">
      <BackendConfigBanner />
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <div className="flex items-center gap-3 justify-center mb-1">
          <div
            className={hypHeaderIconClass(
              "bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30"
            )}
          >
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">ציון משוקלל</h1>
        </div>
        <p className="text-sm text-slate-500">דירוג נציגים לפי שקלול המדדים</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="m3-card p-4 sm:p-6 space-y-4"
        dir="rtl"
      >
        <MetricsSubNav />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען דירוג...
          </div>
        ) : !snapshot?.upload ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 leading-relaxed">
            עדיין לא פורסמו מדדים לדירוג.
          </div>
        ) : !rankedRows.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-900">
            אין נתונים לחישוב ציון משוקלל.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950 leading-relaxed">
              <p className="font-semibold mb-1">אופן החישוב</p>
              <p className="text-violet-900/90 text-xs sm:text-sm">{rankingNote}</p>
              <p className="text-violet-800/80 text-xs mt-2">
                הציון המשוקלל מוצג בסולם 0–100 (100 = הביצועים הטובים ביותר בקבוצה לכל מדד).
              </p>
            </div>

            {myRow && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-teal-900">
                  המיקום שלך: <strong>#{myRow._rank}</strong> מתוך {rankedRows.length}
                </span>
                <span className="font-bold text-teal-800">
                  ציון: {Math.round((myRow._compositeScore ?? 0) * 100)}
                </span>
              </div>
            )}

            {snapshot.upload?.period_label && (
              <p className="text-sm text-slate-600">
                תקופה: <strong>{snapshot.upload.period_label}</strong>
              </p>
            )}

            <AgentMetricsTable
              columns={snapshot.columns}
              rows={rankedRows}
              highlightAgentName={agentName}
              showRank
              showCompositeScore
              highlightLeader
              hideMetricColumns
            />
          </>
        )}
      </motion.div>
    </HypPageLayout>
  );
}
