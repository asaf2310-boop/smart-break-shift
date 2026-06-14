import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, Loader2 } from "lucide-react";
import AgentMetricsTable from "@/components/metrics/AgentMetricsTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAgentMetricsSnapshots } from "@/hooks/useAgentMetricsSnapshot";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useAgentModules } from "@/hooks/useAgentModules";
import {
  markMorningMetricsPopupShown,
  shouldShowMorningMetricsPopup,
  isMorningMetricsPreviewForced,
} from "@/lib/morningMetricsPopup";

function isExcludedPath(pathname) {
  if (!pathname) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/metrics")) return true;
  if (pathname.startsWith("/chat/guest")) return true;
  if (pathname.startsWith("/support/")) return true;
  if (pathname.startsWith("/j/")) return true;
  return false;
}

export default function MorningMetricsPopup() {
  const { isLoggedIn, bootstrapped, displayName } = useAgentSession();
  const { hasModule } = useAgentModules();
  const metricsEnabled = hasModule("metrics");
  const { loading, unified, hasAnyData } = useAgentMetricsSnapshots();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!bootstrapped || !isLoggedIn || !metricsEnabled) return;
    if (loading || !hasAnyData) return;
    if (isExcludedPath(pathname)) return;
    if (!shouldShowMorningMetricsPopup(displayName)) return;

    setOpen(true);
    if (!isMorningMetricsPreviewForced()) {
      markMorningMetricsPopupShown(displayName);
    }
  }, [
    bootstrapped,
    isLoggedIn,
    metricsEnabled,
    loading,
    hasAnyData,
    displayName,
    pathname,
  ]);

  const handleOpenChange = (next) => {
    setOpen(next);
  };

  if (!metricsEnabled) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[min(96vw,80rem)] w-full max-h-[min(92vh,900px)] overflow-y-auto p-4 sm:p-6"
        dir="rtl"
      >
        <DialogHeader className="text-right space-y-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 shadow-md shadow-violet-500/25">
              <BarChart3 className="h-5 w-5 text-white" />
            </span>
            בוקר טוב{displayName ? `, ${displayName}` : ""} — מדדי הנציגים
          </DialogTitle>
          <DialogDescription className="text-right text-sm text-slate-600 leading-relaxed">
            {unified.periodLabel ? (
              <>
                תקופת דיווח: <strong>{unified.periodLabel}</strong>
                {" · "}
              </>
            ) : null}
            השורה שלך מסומנת בירוק; המוביל/ה בצהוב.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            טוען מדדים...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 text-xs text-violet-950 leading-relaxed">
              {unified.rankingNote}
            </div>
            <AgentMetricsTable
              columns={unified.displayColumns}
              rows={unified.rankedRows}
              highlightAgentName={displayName}
              showRank
              showChannel
              showCompositeScore
              highlightLeader
            />
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-start gap-2 pt-2">
          <button type="button" onClick={() => setOpen(false)} className="m3-btn-tonal">
            המשך לעבודה
          </button>
          <Link to="/metrics" onClick={() => setOpen(false)} className="m3-btn-outlined text-center">
            פתיחה בדף מלא
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
