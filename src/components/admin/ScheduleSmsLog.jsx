import React, { useEffect, useState } from "react";
import { demoModeEnabled } from "@/api/demoClient";
import { getDemoScheduleSmsLog } from "@/lib/scheduleSms";

export default function ScheduleSmsLog() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((value) => value + 1);
    window.addEventListener("schedule-sms-sent", refresh);
    return () => window.removeEventListener("schedule-sms-sent", refresh);
  }, []);

  const entries = getDemoScheduleSmsLog();
  void tick;

  if (!demoModeEnabled || entries.length === 0) return null;

  return (
    <div className="rounded-3xl border border-cyan-200 bg-cyan-50/80 p-5 mt-6" dir="rtl">
      <h3 className="font-bold text-slate-800 text-sm mb-2">יומן SMS דמו (אחרון)</h3>
      <p className="text-xs text-slate-500 mb-3">
        בסביבת טסט לא נשלח SMS אמיתי — רק תצוגה של מה שהיה נשלח בפרסום אחרון.
      </p>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {entries.slice(0, 8).map((entry) => (
          <div key={entry.id} className="rounded-xl bg-white border border-cyan-100 p-3 text-xs">
            <div className="font-bold text-slate-700 mb-1">
              {entry.agent_name} · {entry.phone}
            </div>
            <pre className="whitespace-pre-wrap text-slate-600 leading-relaxed">{entry.message}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
