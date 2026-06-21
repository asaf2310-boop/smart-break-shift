import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, MessageSquare, Star } from "lucide-react";
import { demoModeEnabled } from "@/api/demoClient";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { getAgentSession } from "@/lib/agentAuth";
import { getCachedBearerToken } from "@/lib/agentAuthClient";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatAgentPhoneDisplay, normalizeAgentPhone } from "@/lib/agentPhone";
import {
  buildReviewSmsPreview,
  fetchReviewSmsConfig,
  getInitialReviewSmsConfigState,
  REVIEW_SMS_MAX_LENGTH,
  sendReviewSms,
  validateReviewSmsLength,
} from "@/lib/reviewSms";

function hasStoredAgentSession() {
  const session = getAgentSession();
  return Boolean(session?.email && session?.userId && session?.needsPasswordSetup !== true);
}

export default function AgentReviewSms() {
  const { toast } = useToast();
  const { isLoggedIn, bootstrapped, accessToken } = useAgentSession();
  const isAdmin = useIsAdmin();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [smsConfig, setSmsConfig] = useState(getInitialReviewSmsConfigState);

  const likelyLoggedIn = isLoggedIn || (!bootstrapped && hasStoredAgentSession());

  useEffect(() => {
    if (bootstrapped && !isLoggedIn) return undefined;

    const token = accessToken || getCachedBearerToken();
    if (!demoModeEnabled && !token && !hasStoredAgentSession()) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const config = await fetchReviewSmsConfig({ accessToken: token });
        if (!cancelled) {
          setSmsConfig({ loading: false, refreshing: false, ...config });
        }
      } catch {
        if (!cancelled) {
          setSmsConfig((prev) => ({
            ...prev,
            loading: false,
            refreshing: false,
            ok: false,
            smsUrl: null,
            source: null,
            message: "לא הצלחנו לטעון את הגדרות הקישור",
            dbError: "request_failed",
            dbErrorMessage: null,
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, isLoggedIn, accessToken]);

  const normalizedPhone = useMemo(() => normalizeAgentPhone(phone), [phone]);
  const preview = useMemo(() => buildReviewSmsPreview(smsConfig.smsUrl), [smsConfig.smsUrl]);
  const lengthCheck = useMemo(() => validateReviewSmsLength(preview), [preview]);
  const previewTooLong = !lengthCheck.ok;
  const configPending = smsConfig.refreshing || smsConfig.loading;
  const hasSmsUrl = Boolean(smsConfig.smsUrl);
  const smsUrlMissing = !configPending && !smsConfig.ok;
  const waitingForUrl = configPending && !hasSmsUrl;
  const formDisabled = sending;
  const sendDisabled =
    sending ||
    !likelyLoggedIn ||
    !normalizedPhone ||
    previewTooLong ||
    waitingForUrl ||
    smsUrlMissing;

  if (bootstrapped && !isLoggedIn) {
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
      const result = await sendReviewSms({ phone: normalizedPhone });

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

      {(hasSmsUrl || smsUrlMissing) && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm text-center leading-relaxed ${
            smsUrlMissing
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {smsUrlMissing ? (
            <span>
              {smsConfig.dbError === "app_settings_missing" && smsConfig.dbErrorMessage
                ? smsConfig.dbErrorMessage
                : smsConfig.message || "קישור דירוג לא מוגדר ל-SMS."}
            </span>
          ) : (
            <>
              הקישור שיישלח ב-SMS:{" "}
              <code className="text-xs font-mono" dir="ltr">
                {smsConfig.smsUrl}
              </code>
              {configPending && (
                <Loader2
                  className="inline w-3.5 h-3.5 animate-spin opacity-60 ms-1.5 align-[-2px]"
                  aria-label="מעדכן קישור"
                />
              )}
            </>
          )}
          {smsUrlMissing && (
            <p className="mt-2 text-xs opacity-80">
              {isAdmin ? (
                <>
                  הגדירו קישור קצר (מומלץ{" "}
                  <code className="text-[11px]" dir="ltr">
                    g.page/r/…/review
                  </code>
                  ) ב{" "}
                  <Link to="/admin" className="underline font-medium hover:text-amber-950">
                    דשבורד מנהל
                  </Link>{" "}
                  → קישור דירוג גוגל ל-SMS.
                  {smsConfig.dbError === "app_settings_missing" ? (
                    <span className="block mt-1">
                      לפני השמירה הראשונה: הריצו{" "}
                      <code className="text-[11px]" dir="ltr">
                        app_settings_review_url.sql
                      </code>{" "}
                      ב-Supabase.
                    </span>
                  ) : null}
                </>
              ) : (
                "פנה למנהל להגדרת קישור דירוג גוגל ל-SMS."
              )}
            </p>
          )}
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
            placeholder="05XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={formDisabled}
          />
          {phone && !normalizedPhone && (
            <p className="mt-1.5 text-xs text-red-500">מספר לא תקין — השתמשו בפורמט ישראלי</p>
          )}
          {normalizedPhone && (
            <p className="mt-1.5 text-xs text-slate-400">יישלח ל: {formatAgentPhoneDisplay(normalizedPhone)}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            תצוגה מקדימה
            {configPending && (
              <span className="inline-flex items-center gap-1 font-normal text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                מעדכן קישור...
              </span>
            )}
          </p>
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
              previewTooLong
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-slate-50 border-slate-100 text-slate-700"
            }`}
          >
            {preview}
          </div>
          <p className={`mt-1.5 text-xs ${previewTooLong ? "text-red-500" : "text-slate-400"}`}>
            {lengthCheck.length}/{REVIEW_SMS_MAX_LENGTH} תווים
            {previewTooLong ? ` — ${lengthCheck.message}` : ""}
          </p>
        </div>

        <div>
          <button
            type="submit"
            disabled={sendDisabled}
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
          {waitingForUrl && (
            <p className="mt-2 text-xs text-slate-400 text-center">ממתין לטעינת קישור דירוג...</p>
          )}
          {!waitingForUrl && smsUrlMissing && (
            <p className="mt-2 text-xs text-amber-700 text-center">לא ניתן לשלוח ללא קישור דירוג מוגדר</p>
          )}
        </div>
      </form>
    </HypPageLayout>
  );
}
