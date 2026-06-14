import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, MessageSquareWarning } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import {
  listKnowledgeGaps,
  updateKnowledgeGap,
  shouldUseServerRag,
} from "@/lib/knowledge/knowledgeClient";

export default function AdminKnowledgeGaps() {
  const { toast } = useToast();
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const refresh = useCallback(async () => {
    if (!shouldUseServerRag()) {
      setGaps([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listKnowledgeGaps();
      setGaps(data);
      const nextDrafts = {};
      for (const gap of data) {
        nextDrafts[gap.id] = gap.manual_answer || "";
      }
      setDrafts(nextDrafts);
    } catch (err) {
      toast({
        title: "שגיאה בטעינת פערים",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async (gap) => {
    const manualAnswer = String(drafts[gap.id] || "").trim();
    if (!manualAnswer) {
      toast({ title: "נדרשת תשובה", variant: "destructive" });
      return;
    }
    setSavingId(gap.id);
    try {
      await updateKnowledgeGap(gap.id, { manualAnswer, status: "answered" });
      toast({ title: "התשובה נשמרה" });
      await refresh();
    } catch (err) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const openGaps = gaps.filter((g) => g.status !== "answered");
  const answeredGaps = gaps.filter((g) => g.status === "answered");

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-6" dir="rtl">
        <div className="flex items-center gap-3">
          <div
            className={hypHeaderIconClass(
              "w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 shadow-elevation-2",
            )}
          >
            <MessageSquareWarning className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">פערי ידע</h1>
            <p className="text-sm text-slate-500">שאלות שלא נמצא להן מקור ברור — הוסף תשובה ידנית</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link to="/admin/knowledge" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            ניהול ידע
          </Link>
          <Link to="/admin" className="text-xs text-primary hover:underline">
            לוח מנהל
          </Link>
        </div>
      </div>

      {!shouldUseServerRag() && (
        <div className="m3-card p-6 text-center text-on-surface-variant" dir="rtl">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-70" />
          <p>פערי ידע זמינים בפרודקשן עם pgvector (Supabase).</p>
        </div>
      )}

      {shouldUseServerRag() && loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {shouldUseServerRag() && !loading && gaps.length === 0 && (
        <div className="m3-card p-8 text-center" dir="rtl">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-600 mb-3" />
          <p className="m3-label-large">אין פערים פתוחים</p>
        </div>
      )}

      {shouldUseServerRag() && !loading && openGaps.length > 0 && (
        <section className="space-y-4 mb-8" dir="rtl">
          <h2 className="m3-title-medium">פתוחים ({openGaps.length})</h2>
          <ul className="space-y-3">
            {openGaps.map((gap, i) => (
              <motion.li
                key={gap.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="m3-card p-4 space-y-3"
              >
                <div>
                  <p className="m3-label-large">{gap.question}</p>
                  <p className="m3-label-medium mt-1 opacity-70">
                    {new Date(gap.created_at).toLocaleString("he-IL")}
                    {gap.confidence != null ? ` · ביטחון: ${(gap.confidence * 100).toFixed(0)}%` : ""}
                  </p>
                </div>
                <textarea
                  value={drafts[gap.id] || ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [gap.id]: e.target.value }))}
                  rows={3}
                  placeholder="תשובה ידנית למנהל..."
                  className="w-full rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary resize-y"
                  dir="auto"
                />
                <button
                  type="button"
                  onClick={() => handleSave(gap)}
                  disabled={savingId === gap.id}
                  className="m3-btn-tonal disabled:opacity-50"
                >
                  {savingId === gap.id ? "שומר…" : "שמור תשובה"}
                </button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {shouldUseServerRag() && !loading && answeredGaps.length > 0 && (
        <section className="space-y-4" dir="rtl">
          <h2 className="m3-title-medium">נענו ({answeredGaps.length})</h2>
          <ul className="space-y-2">
            {answeredGaps.map((gap) => (
              <li key={gap.id} className="m3-card p-4">
                <p className="m3-label-medium font-semibold">{gap.question}</p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{gap.manual_answer}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </HypPageLayout>
  );
}
