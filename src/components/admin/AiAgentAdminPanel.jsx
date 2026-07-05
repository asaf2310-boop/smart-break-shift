import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { getAgentBearerHeaders } from "@/lib/agentAuthClient";
import { AGENT_MODULES } from "@/constants/agentModules";

function StatusRow({ label, ok, detail }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-2 text-sm text-right">
        {detail ? <span className="text-slate-500 text-xs">{detail}</span> : null}
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-label="תקין" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 shrink-0" aria-label="חסר" />
        )}
      </div>
    </div>
  );
}

export default function AiAgentAdminPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const headers = await getAgentBearerHeaders();
        const res = await fetch("/api/ai-agent-status", { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setError(data.message || data.error || "לא ניתן לטעון סטטוס");
          }
          return;
        }
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setError("שגיאת רשת בטעינת סטטוס");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const moduleLabel = AGENT_MODULES.ai_agent?.label || "סוכן AI";

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-2">סקירה</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          סוכן AI עונה לנציגים בעברית ושולף נתונים מ-Supabase (קריאה בלבד) דרך OpenAI Function
          Calling. מודול:{" "}
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">ai_agent</code>
          {" · "}
          <Link to="/admin/users" className="text-primary font-semibold hover:underline">
            ניהול נציגים
          </Link>
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4">סטטוס שרת</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            בודק הגדרות...
          </div>
        ) : error ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            {error}
          </p>
        ) : status ? (
          <div>
            <StatusRow
              label="OPENAI_API_KEY"
              ok={status.openaiConfigured}
              detail={status.openaiModel || undefined}
            />
            <StatusRow label="SUPABASE_URL + SERVICE_ROLE_KEY" ok={status.supabaseConfigured} />
            <StatusRow
              label="Rate limit"
              ok
              detail={`${status.rateLimit?.maxPerHour ?? 30} בקשות/שעה`}
            />
          </div>
        ) : null}
      </section>

      {status?.allowedTables?.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-2">טבלאות מורשות (read-only)</h2>
          <p className="text-sm text-slate-500 mb-4">
            הכלי <code className="text-xs bg-slate-100 px-1 rounded">getBusinessData</code> — שוויון
            בלבד, עד 50 שורות
          </p>
          <div className="space-y-4">
            {status.allowedTables.map((table) => {
              const cols = status.allowedColumns?.[table] || [];
              const tableOk = status.tableStatus?.[table]?.ok;
              return (
                <div key={table} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <code className="text-sm font-bold text-slate-800">{table}</code>
                    {status.tableStatus ? (
                      tableOk ? (
                        <span className="text-xs text-emerald-700 font-semibold">קיימת</span>
                      ) : (
                        <span className="text-xs text-amber-700 font-semibold">חסרה / שגיאה</span>
                      )
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 font-mono leading-relaxed break-all">
                    {cols.join(", ")}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            אם טבלה חסרה — הריצו{" "}
            <code className="bg-slate-100 px-1 rounded">supabase/ai_agent_tables.sql</code>
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5">
        <div className="flex items-start gap-3">
          <Bot className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-1">בדיקת צ&apos;אט</h2>
            <p className="text-sm text-slate-600 mb-3">
              פתחו את ממשק {moduleLabel} כפי שהנציג רואה אותו (דורש מודול או הרשאת מנהל).
            </p>
            <Link
              to="/ai-agent"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white text-sm font-semibold px-4 py-2 hover:bg-violet-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {moduleLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-2">משתני סביבה (Vercel)</h2>
        <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside marker:text-slate-400">
          <li>
            <code className="text-xs">OPENAI_API_KEY</code> — חובה
          </li>
          <li>
            <code className="text-xs">OPENAI_MODEL</code> — אופציונלי (ברירת מחדל: gpt-4o-mini)
          </li>
          <li>
            <code className="text-xs">SUPABASE_URL</code> +{" "}
            <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> — שרת בלבד
          </li>
        </ul>
      </section>
    </div>
  );
}
