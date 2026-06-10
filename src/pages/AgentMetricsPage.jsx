import React from "react";
import { motion } from "framer-motion";
import { BarChart3, Loader2 } from "lucide-react";
import AgentMetricsTable from "@/components/metrics/AgentMetricsTable";
import MetricsSubNav from "@/components/metrics/MetricsSubNav";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { useAgentMetricsSnapshot } from "@/hooks/useAgentMetricsSnapshot";
import { useAgentSession } from "@/hooks/useAgentSession";
import { getStoredAgentName } from "@/constants/scheduling";

export default function AgentMetricsPage() {
  const { displayName } = useAgentSession();
  const agentName = displayName || getStoredAgentName();
  const { loading, snapshot, rankedRows } = useAgentMetricsSnapshot();

  const hasData = Boolean(snapshot?.upload && rankedRows.length);

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
              "bg-gradient-to-br from-violet-400 to-indigo-500 shadow-lg shadow-violet-500/30"
            )}
          >
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">מדדי נציגים</h1>
        </div>
        <p className="text-sm text-slate-500">
          {agentName ? `מחובר כ־${agentName}` : "יש להתחבר כנציג"}
          {hasData && " · טבלה מלאה של כל הנציגים"}
        </p>
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
            טוען מדדים...
          </div>
        ) : !snapshot?.upload ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 leading-relaxed">
            עדיין לא פורסמו מדדים.
            <br />
            המנהל יעלה קובץ Excel דרך ממשק הניהול.
          </div>
        ) : !rankedRows.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-900 leading-relaxed">
            לא נמצאו שורות בדיווח האחרון.
          </div>
        ) : (
          <>
            {snapshot.upload?.period_label && (
              <p className="text-sm text-slate-600">
                תקופת דיווח: <strong>{snapshot.upload.period_label}</strong>
                {snapshot.upload?.uploaded_at && (
                  <span className="text-slate-400 text-xs mr-2">
                    · עודכן{" "}
                    {new Date(snapshot.upload.uploaded_at).toLocaleDateString("he-IL")}
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-slate-500 leading-relaxed">
              הנציג המוביל מסומן בצהוב. השורה שלך מסומנת בירוק. לציון המשוקלל — עברו ללשונית «ציון
              משוקלל».
            </p>
            <AgentMetricsTable
              columns={snapshot.columns}
              rows={rankedRows}
              highlightAgentName={agentName}
              showRank
              highlightLeader
            />
          </>
        )}
      </motion.div>
    </HypPageLayout>
  );
}
