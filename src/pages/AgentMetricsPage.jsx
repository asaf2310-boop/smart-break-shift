import React from "react";
import { motion } from "framer-motion";
import { BarChart3, Loader2 } from "lucide-react";
import MetricsChannelSection from "@/components/metrics/MetricsChannelSection";
import BackendConfigBanner from "@/components/BackendConfigBanner";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { useAgentMetricsSnapshots } from "@/hooks/useAgentMetricsSnapshot";
import { METRICS_CHANNEL } from "@/lib/agentMetricsScoring";
import { useAgentSession } from "@/hooks/useAgentSession";
import { getStoredAgentName } from "@/constants/scheduling";

export default function AgentMetricsPage() {
  const { displayName } = useAgentSession();
  const agentName = displayName || getStoredAgentName();
  const { loading, phone, whatsapp, hasAnyData } = useAgentMetricsSnapshots();

  return (
    <HypPageLayout variant="scheduling" contentClassName="max-w-[min(100%,80rem)] px-3 sm:px-4 py-8">
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
          {hasAnyData && " · דירוג חודשי לפי ציון משוקלל"}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="m3-card p-4 sm:p-6 space-y-6"
        dir="rtl"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען מדדים...
          </div>
        ) : !hasAnyData ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 leading-relaxed">
            עדיין לא פורסמו מדדים.
            <br />
            המנהל יעלה קובץ Excel לכל ערוץ (טלפון / WhatsApp) דרך ממשק הניהול.
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500 leading-relaxed">
              כל מדד מושווה לנציג הטוב ביותר באותו חודש (מקסימום 100 נקודות למדד). הציון הסופי הוא
              סכום משוקלל מתוך 100. הנציג המוביל מסומן בצהוב; השורה שלך בירוק.
            </p>

            <MetricsChannelSection
              channel={METRICS_CHANNEL.phone}
              view={phone}
              highlightAgentName={agentName}
            />

            <MetricsChannelSection
              channel={METRICS_CHANNEL.whatsapp}
              view={whatsapp}
              highlightAgentName={agentName}
            />
          </>
        )}
      </motion.div>
    </HypPageLayout>
  );
}
