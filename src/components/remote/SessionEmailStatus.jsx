import React from "react";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { getSimulatedStatusHint } from "@/lib/emailSimulatedReason";

const STATUS_STYLES = {
  sent: {
    label: "נשלח",
    className: "bg-emerald-50 border-emerald-200 text-emerald-950",
    icon: CheckCircle2,
    iconClass: "text-emerald-700",
  },
  simulated: {
    label: "סימולציה — לא נשלח במייל",
    className: "bg-amber-50 border-amber-200 text-amber-950",
    icon: Mail,
    iconClass: "text-amber-700",
  },
  failed: {
    label: "שליחה נכשלה",
    className: "bg-red-50 border-red-200 text-red-950",
    icon: AlertCircle,
    iconClass: "text-red-700",
  },
};

function formatWhen(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function SessionEmailStatus({ log, sessionEmailSentAt }) {
  const when = log?.sentAt || sessionEmailSentAt;
  if (!log && !when) return null;

  const status = log?.status || (sessionEmailSentAt ? "sent" : null);
  const style = STATUS_STYLES[status] || STATUS_STYLES.simulated;
  const Icon = style.icon;
  const simulatedHint = status === "simulated" ? getSimulatedStatusHint(log) : null;

  return (
    <div
      className={`rounded-xl border px-3 py-2 flex items-start gap-2 text-xs leading-relaxed ${style.className}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.iconClass}`} />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          מייל אחרון: {style.label}
          {when ? ` · ${formatWhen(when)}` : ""}
        </p>
        {log?.to ? (
          <p className="font-mono text-left text-[11px] opacity-90" dir="ltr">
            {log.to}
          </p>
        ) : null}
        {simulatedHint ? (
          <p className="text-[11px] opacity-95 leading-snug">{simulatedHint}</p>
        ) : null}
      </div>
    </div>
  );
}
