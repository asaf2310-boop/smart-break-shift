import React, { useEffect, useState } from "react";
import { Mail, MailWarning } from "lucide-react";
import { demoModeEnabled, demoSendRealEmailEnabled } from "@/api/demoClient";
import { fetchEmailStatus } from "@/lib/emailApi";
import EmailDiagnosticButton from "@/components/remote/EmailDiagnosticButton";

export default function EmailStatusBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchEmailStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  const notDeployed = status.apiPresent === false;
  const sandbox = status.configured && status.sandboxMode;
  const legacyOnly = status.configured && status.legacyStatusOnly;
  const productionReady = status.configured && !sandbox && !legacyOnly;
  const needsEnv = !status.configured && status.apiPresent !== false;

  let message;
  let tone = "amber";

  if (notDeployed) {
    message = "מייל: שרת לא נפרסם — העלו api/ ל-GitHub ו-Redeploy";
  } else if (needsEnv) {
    message = "מייל: לא מוגדר — הגדירו RESEND_API_KEY + EMAIL_FROM ב-Vercel";
  } else if (legacyOnly) {
    message =
      "מייל: Resend מוגדר — Redeploy לסטטוס מלא (sandbox/דומיין). לחצו «בדיקת מייל»";
    tone = "amber";
  } else if (sandbox) {
    message =
      "מייל: Resend בדיקות (onboarding@resend.dev) — נשלח רק למייל של חשבון Resend. ללקוחות: אמתו דומיין והחליפו EMAIL_FROM";
    tone = "amber";
  } else if (productionReady) {
    message = status.fromDomain
      ? `מייל: פעיל (${status.fromDomain})`
      : "מייל: פעיל — דומיין מאומת";
    tone = "emerald";
  } else {
    message = "מייל: סטטוס לא ידוע";
  }

  if (demoSendRealEmailEnabled && sandbox) {
    message += " · בדמו: שליחה אמיתית מופעלת אך Resend חוסם נמענים חיצוניים";
  } else if (demoModeEnabled && !demoSendRealEmailEnabled && status.configured) {
    message += " · בדמו: שליחה אמיתית כבויה (VITE_DEMO_SEND_REAL_EMAIL=false — Redeploy)";
  } else if (demoSendRealEmailEnabled && !status.configured && status.apiPresent !== false) {
    message += " · בדמו: מנסים מייל אמיתי — חסרים RESEND_API_KEY / EMAIL_FROM";
  }

  const boxClass =
    tone === "emerald"
      ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
      : "bg-amber-50 border border-amber-200 text-amber-950";

  return (
    <div className={`rounded-xl px-3 py-2 flex flex-wrap items-center gap-2 text-xs leading-relaxed ${boxClass}`}>
      {tone === "emerald" ? (
        <Mail className="w-4 h-4 shrink-0 text-emerald-700" />
      ) : (
        <MailWarning className="w-4 h-4 shrink-0 text-amber-700" />
      )}
      <span className="flex-1 min-w-[12rem]">{message}</span>
      <EmailDiagnosticButton variant="outline" size="sm" className="shrink-0 h-7 text-xs border-current/30" />
    </div>
  );
}
