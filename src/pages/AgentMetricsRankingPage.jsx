import React from "react";
import { motion } from "framer-motion";
import { Loader2, Trophy } from "lucide-react";
import MetricsChannelSection from "@/components/metrics/MetricsChannelSection";
import MetricsSubNav from "@/components/metrics/MetricsSubNav";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { useAgentMetricsSnapshots } from "@/hooks/useAgentMetricsSnapshot";
import { formatCompositeScore, METRICS_CHANNEL } from "@/lib/agentMetricsScoring";
import { useAgentSession } from "@/hooks/useAgentSession";
import { getStoredAgentName } from "@/constants/scheduling";

function MyRankCard({ view, agentName }) {
  const myRow = view.rankedRows.find(
    (r) => String(r.agent_name || "").trim() === String(agentName || "").trim()
  );
  if (!myRow) return null;

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-teal-900">
        המיקום שלך: <strong>#{myRow._rank}</strong> מתוך {view.rankedRows.length}
      </span>
      <span className="font-bold text-teal-800">ציון: {formatCompositeScore(myRow._compositeScore)}</span>
    </div>
  );
}

export default function AgentMetricsRankingPage() {
  const { displayName } = useAgentSession();
  const agentName = displayName || getStoredAgentName();
  const { loading, phone, whatsapp, hasAnyData } = useAgentMetricsSnapshots();

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
        <p className="text-sm text-slate-500">דירוג חודשי — טלפון ו-WhatsApp/טיקטים</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="m3-card p-4 sm:p-6 space-y-6"
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
            {phone.hasData && <MyRankCard view={phone} agentName={agentName} />}
            {whatsapp.hasData && <MyRankCard view={whatsapp} agentName={agentName} />}

            <MetricsChannelSection
              channel={METRICS_CHANNEL.phone}
              view={phone}
              highlightAgentName={agentName}
              hideMetricColumns
            />

            <MetricsChannelSection
              channel={METRICS_CHANNEL.whatsapp}
              view={whatsapp}
              highlightAgentName={agentName}
              hideMetricColumns
            />
          </>
        )}
      </motion.div>
    </HypPageLayout>
  );
}
