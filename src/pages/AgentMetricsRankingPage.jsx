import React from "react";
import { motion } from "framer-motion";
import { Loader2, Trophy } from "lucide-react";
import AgentMetricsTable from "@/components/metrics/AgentMetricsTable";
import MetricsSubNav from "@/components/metrics/MetricsSubNav";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { useAgentMetricsSnapshots } from "@/hooks/useAgentMetricsSnapshot";
import { formatCompositeScore } from "@/lib/agentMetricsScoring";
import { useAgentSession } from "@/hooks/useAgentSession";
import { getStoredAgentName } from "@/constants/scheduling";

export default function AgentMetricsRankingPage() {
  const { displayName } = useAgentSession();
  const agentName = displayName || getStoredAgentName();
  const { loading, phone, whatsapp, unified, hasAnyData } = useAgentMetricsSnapshots();

  const myPhoneRow = phone.rankedRows.find(
    (r) => String(r.agent_name || "").trim() === String(agentName || "").trim()
  );
  const myWhatsappRow = whatsapp.rankedRows.find(
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
        <p className="text-sm text-slate-500">דירוג חודשי לפי ערוץ — טלפון ו-WhatsApp</p>
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
        ) : !hasAnyData ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 leading-relaxed">
            עדיין לא פורסמו מדדים לדירוג.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950 leading-relaxed">
              <p className="font-semibold mb-1">אופן החישוב</p>
              <p className="text-violet-900/90 text-xs sm:text-sm">{unified.rankingNote}</p>
            </div>

            {(myPhoneRow || myWhatsappRow) && (
              <div className="grid gap-3 lg:grid-cols-2">
                {myPhoneRow && (
                  <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-teal-900">
                      המיקום שלך בטלפון: <strong>#{myPhoneRow._rank}</strong> מתוך {phone.rankedRows.length}
                    </span>
                    <span className="font-bold text-teal-800">
                      ציון: {formatCompositeScore(myPhoneRow._compositeScore)}
                    </span>
                  </div>
                )}
                {myWhatsappRow && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-emerald-900">
                      המיקום שלך ב-WhatsApp: <strong>#{myWhatsappRow._rank}</strong> מתוך {whatsapp.rankedRows.length}
                    </span>
                    <span className="font-bold text-emerald-800">
                      ציון: {formatCompositeScore(myWhatsappRow._compositeScore)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                כל הנציגים מופיעים באותה טבלה, אבל עמודת דירוג בערוץ נשארת נפרדת לטלפון ול-WhatsApp.
              </p>
              <AgentMetricsTable
                columns={unified.displayColumns}
                rows={unified.rankedRows}
                highlightAgentName={agentName}
                showRank
                rankLabel="דירוג בערוץ"
                showChannel
                showCompositeScore
                hideMetricColumns
              />
            </div>
          </>
        )}
      </motion.div>
    </HypPageLayout>
  );
}
