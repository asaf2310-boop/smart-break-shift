import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { apiAdminSmsStatsByAgent } from "@/lib/agentAuthClient";

const PERIOD_OPTIONS = [
  { value: 7, label: "7 ימים אחרונים" },
  { value: 30, label: "30 ימים אחרונים" },
  { value: 90, label: "90 ימים אחרונים" },
];

function formatPeriodLabel(period) {
  if (!period?.fromDate || !period?.toDate) return "—";
  try {
    const from = format(new Date(`${period.fromDate}T12:00:00`), "dd/MM/yyyy", { locale: he });
    const to = format(new Date(`${period.toDate}T12:00:00`), "dd/MM/yyyy", { locale: he });
    return `${from} – ${to}`;
  } catch {
    return `${period.fromDate} – ${period.toDate}`;
  }
}

function agentLabel(row) {
  return row.agentName || row.agentId || "לא ידוע";
}

function sortAgentsByTotalDesc(rows) {
  return [...rows].sort((a, b) => {
    const diff = Number(b.total) - Number(a.total);
    if (diff !== 0) return diff;
    return String(a.agentName || a.agentId || "").localeCompare(
      String(b.agentName || b.agentId || ""),
      "he"
    );
  });
}

function formatDayLabel(dateStr) {
  if (!dateStr) return "—";
  try {
    return format(new Date(`${dateStr}T12:00:00`), "EEEE, dd/MM/yyyy", { locale: he });
  } catch {
    return dateStr;
  }
}

function sortDailyDesc(rows) {
  return [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export default function AdminSmsStats() {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [totals, setTotals] = useState(null);
  const [period, setPeriod] = useState(null);
  const [rowCount, setRowCount] = useState(0);
  const [daily, setDaily] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiAdminSmsStatsByAgent({ days });
      if (!result.ok) {
        toast({
          title: "שגיאה בטעינת נתונים",
          description: result.message || "לא הצלחנו לטעון סטטיסטיקת SMS",
          variant: "destructive",
        });
        setAgents([]);
        setTotals(null);
        setPeriod(null);
        setRowCount(0);
        setDaily([]);
        return;
      }
      setAgents(sortAgentsByTotalDesc(result.agents || []));
      setTotals(result.totals || null);
      setPeriod(result.period || null);
      setRowCount(result.rowCount ?? 0);
      setDaily(sortDailyDesc(result.daily || []));
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.message || "לא הצלחנו לטעון סטטיסטיקת SMS",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6" dir="rtl">
        <div className="flex items-center gap-3">
          <div
            className={hypHeaderIconClass(
              "w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 shadow-elevation-2"
            )}
          >
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">סטטיסטיקת SMS לפי נציג</h1>
            <p className="text-sm text-slate-500">ספירה מיומן הביקורת — דירוג גוגל ושיבוץ משמרות</p>
          </div>
        </div>
        <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ArrowRight className="w-4 h-4" />
          לוח מנהל
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3" dir="rtl">
        <label className="text-sm text-slate-600 flex items-center gap-2">
          תקופה:
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white min-w-[10rem]"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {period && (
          <span className="text-xs text-slate-400">{formatPeriodLabel(period)}</span>
        )}
        {!loading && (
          <span className="text-xs text-slate-400">{rowCount} אירועי SMS ביומן</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500" dir="rtl">
          אין שליחות SMS מתועדות בתקופה שנבחרה.
          <p className="text-xs text-slate-400 mt-2">
            נתונים נאספים מיומן הביקורת (send_review_sms, send_schedule_sms).
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            dir="rtl"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">נציג</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">סה״כ SMS</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">דירוג גוגל</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">לוח זמנים</th>
                    <th className="text-right font-semibold text-slate-600 px-4 py-3">תקופה</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((row) => (
                    <tr
                      key={row.agentId || row.agentName || row.total}
                      className="border-b border-slate-50 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-2.5 text-slate-800 font-medium">{agentLabel(row)}</td>
                      <td className="px-4 py-2.5 text-slate-700 font-semibold">{row.total}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.send_review_sms || 0}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.send_schedule_sms || 0}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                        {formatPeriodLabel(period)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot className="bg-slate-50 border-t border-slate-100">
                    <tr>
                      <td className="px-4 py-3 font-bold text-slate-700">סה״כ</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{totals.total}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{totals.send_review_sms}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{totals.send_schedule_sms}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatPeriodLabel(period)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </motion.div>

          {daily.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              dir="rtl"
            >
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-bold text-slate-700">פירוט יומי</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  ספירה לפי יום (שעון ישראל) — {formatPeriodLabel(period)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-right font-semibold text-slate-600 px-4 py-3">תאריך</th>
                      <th className="text-right font-semibold text-slate-600 px-4 py-3">סה״כ</th>
                      <th className="text-right font-semibold text-slate-600 px-4 py-3">דירוג גוגל</th>
                      <th className="text-right font-semibold text-slate-600 px-4 py-3">לוח זמנים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((row) => (
                      <tr
                        key={row.date}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 ${
                          row.total === 0 ? "text-slate-400" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">
                          {formatDayLabel(row.date)}
                        </td>
                        <td className="px-4 py-2.5 font-semibold">{row.total}</td>
                        <td className="px-4 py-2.5">{row.send_review_sms || 0}</td>
                        <td className="px-4 py-2.5">{row.send_schedule_sms || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  {totals && (
                    <tfoot className="bg-slate-50 border-t border-slate-100">
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-700">סה״כ</td>
                        <td className="px-4 py-3 font-bold text-slate-800">{totals.total}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{totals.send_review_sms}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{totals.send_schedule_sms}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </HypPageLayout>
  );
}
