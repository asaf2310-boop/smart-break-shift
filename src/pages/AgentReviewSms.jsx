import React, { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, MessageSquare, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { useAgentSession } from "@/hooks/useAgentSession";
import { formatAgentPhoneDisplay, normalizeAgentPhone } from "@/lib/agentPhone";
import {
  buildReviewSmsPreview,
  DEFAULT_REVIEW_SMS_TEMPLATE,
  getGoogleReviewUrlPreview,
  sendReviewSms,
} from "@/lib/reviewSms";
import { demoModeEnabled } from "@/api/demoClient";

export default function AgentReviewSms() {
  const { toast } = useToast();
  const { isLoggedIn } = useAgentSession();
  const [phone, setPhone] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [sending, setSending] = useState(false);

  const reviewUrlConfigured = Boolean(getGoogleReviewUrlPreview());
  const normalizedPhone = useMemo(() => normalizeAgentPhone(phone), [phone]);
  const preview = useMemo(
    () => buildReviewSmsPreview(useCustom ? customMessage : ""),
    [useCustom, customMessage]
  );

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  const handleSend = async (event) => {
    event.preventDefault();
    if (!normalizedPhone) {
      toast({
        title: "מספר לא תקין",
        description: "הזינו מספר נייד ישראלי (05XXXXXXXX)",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const result = await sendReviewSms({
        phone: normalizedPhone,
        message: useCustom ? customMessage : "",
      });

      if (!result.ok) {
        toast({
          title: "לא נשלח",
          description: result.message || "שליחת SMS נכשלה",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: result.simulated ? "SMS דמו" : "נשלח בהצלחה",
        description: result.simulated
          ? `סימולציה ל-${formatAgentPhoneDisplay(result.phone)}`
          : `נשלח ל-${formatAgentPhoneDisplay(result.phone)}`,
      });
      setPhone("");
      if (useCustom) setCustomMessage("");
    } finally {
      setSending(false);
    }
  };

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-xl px-4 py-8">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לראשי
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center gap-3 justify-center mb-2">
          <div
            className={hypHeaderIconClass(
              "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/25"
            )}
          >
            <Star className="w-5 h-5 text-white" />
          </div>
          <h1 className="hyp-scheduling-title text-2xl font-extrabold text-slate-800 tracking-tight">
            שליחת בקשת דירוג בגוגל
          </h1>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          שלחו ללקוח SMS עם קישור לדירוג העסק בגוגל לאחר שיחה או טיפול.
        </p>
      </motion.div>

      {!reviewUrlConfigured && !demoModeEnabled && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-center">
          קישור דירוג גוגל לא מוגדר ב-build. הגדירו <code className="text-xs">VITE_GOOGLE_REVIEW_URL</code>{" "}
          (תצוגה מקדימה) ו-<code className="text-xs">GOOGLE_REVIEW_URL</code> בשרת Vercel.
        </div>
      )}

      <form onSubmit={handleSend} className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
        <div>
          <label htmlFor="review-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
            מספר טלפון לקוח
          </label>
          <input
            id="review-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="05XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={sending}
          />
          {phone && !normalizedPhone && (
            <p className="mt-1.5 text-xs text-red-500">מספר לא תקין — השתמשו בפורמט ישראלי</p>
          )}
          {normalizedPhone && (
            <p className="mt-1.5 text-xs text-slate-400">יישלח ל: {formatAgentPhoneDisplay(normalizedPhone)}</p>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="rounded border-slate-300"
              disabled={sending}
            />
            התאמת תוכן ההודעה
          </label>

          {useCustom ? (
            <div>
              <textarea
                id="review-message"
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-y min-h-[80px]"
                placeholder={DEFAULT_REVIEW_SMS_TEMPLATE}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                disabled={sending}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                השאירו ריק לתבנית ברירת מחדל, או השתמשו ב-<code className="text-[11px]">{"{url}"}</code>{" "}
                למיקום הקישור
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 leading-relaxed">
              תבנית ברירת מחדל: {DEFAULT_REVIEW_SMS_TEMPLATE}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            תצוגה מקדימה
          </p>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
            {preview}
          </div>
        </div>

        <button
          type="submit"
          disabled={sending || !normalizedPhone}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold py-3 text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              שולח...
            </>
          ) : (
            "שלח SMS"
          )}
        </button>
      </form>
    </HypPageLayout>
  );
}
