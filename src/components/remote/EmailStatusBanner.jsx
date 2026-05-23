import React, { useEffect, useState } from "react";
import { Mail, MailWarning } from "lucide-react";
import { fetchEmailStatus } from "@/lib/emailApi";

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

  const active = status.configured && status.apiPresent !== false;
  const notDeployed = status.apiPresent === false;

  const message = active
    ? "מייל: פעיל"
    : notDeployed
      ? "מייל: שרת לא נפרסם — העלו api/ ל-GitHub ו-Redeploy"
      : "מייל: לא מוגדר — הגדירו RESEND_API_KEY + EMAIL_FROM ב-Vercel";

  return (
    <div
      className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs leading-relaxed ${
        active
          ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
          : "bg-amber-50 border border-amber-200 text-amber-950"
      }`}
    >
      {active ? (
        <Mail className="w-4 h-4 shrink-0 text-emerald-700" />
      ) : (
        <MailWarning className="w-4 h-4 shrink-0 text-amber-700" />
      )}
      <span>{message}</span>
    </div>
  );
}
