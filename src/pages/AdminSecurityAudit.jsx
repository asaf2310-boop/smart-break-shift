import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, ScrollText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { apiAdminListAuditLog } from "@/lib/agentAuthClient";
import {
  SECURITY_AUDIT_ACTION_LABELS,
  securityAuditActionLabel,
} from "@/lib/securityAuditLabels";

const PAGE_SIZE = 50;

function formatAuditTime(iso) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: he });
  } catch {
    return iso;
  }
}

function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return "—";
  const keys = Object.keys(metadata);
  if (!keys.length) return "—";
  try {
    const text = JSON.stringify(metadata);
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  } catch {
    return "—";
  }
}

export default function AdminSecurityAudit() {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filterAction, setFilterAction] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiAdminListAuditLog({
        limit: PAGE_SIZE,
        offset,
        filterAction: filterAction || null,
      });
      if (!result.ok) {
        toast({
          title: "שגיאה בטעינת יומן",
          description: result.message || "לא הצלחנו לטעון את יומן הביקורת",
          variant: "destructive",
        });
        setEntries([]);
        setTotal(0);
        return;
      }
      setEntries(result.entries || []);
      setTotal(result.total ?? 0);
    } catch (err) {
      toast({
        title: "שגיאה",
        description: err.message || "לא הצלחנו לטעון את יומן הביקורת",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filterAction, offset, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6" dir="rtl">
        <div className="flex items-center gap-3">
          <div
            className={hypHeaderIconClass(
              "w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800 shadow-elevation-2"
            )}
          >
            <ScrollText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">יומן ביקורת אבטחה</h1>
            <p className="text-sm text-slate-500">פעולות מנהל ופעולות רגישות אחרונות</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            לוח מנהל
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3" dir="rtl">
        <label className="text-sm text-slate-600 flex items-center gap-2">
          סוג פעולה:
          <select
            value={filterAction}
            onChange={(e) => {
              setOffset(0);
              setFilterAction(e.target.value);
            }}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white min-w-[12rem]"
          >
            <option value="">הכל</option>
            {Object.entries(SECURITY_AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-400">{total} רשומות</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500" dir="rtl">
          אין רשומות ביומן (או שמיגרציית phase 12 טרם הורצה ב-Supabase).
        </div>
      ) : (
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
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">זמן</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">פעולה</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">מבצע</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">משאב</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">IP</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">פרטים</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                      {formatAuditTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 font-medium">
                      {securityAuditActionLabel(row.action)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {row.actorDisplayName || row.actorAgentId || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[10rem] truncate" title={row.resourceId || ""}>
                      {row.resourceType ? `${row.resourceType}` : "—"}
                      {row.resourceId ? ` · ${row.resourceId}` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{row.ip || "—"}</td>
                    <td
                      className="px-4 py-2.5 text-slate-500 text-xs max-w-[14rem] truncate"
                      title={formatMetadata(row.metadata)}
                    >
                      {formatMetadata(row.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-4 mt-6" dir="rtl">
          <button
            type="button"
            disabled={offset <= 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
            הקודם
          </button>
          <span className="text-sm text-slate-500">
            עמוד {currentPage} מתוך {pageCount}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="flex items-center gap-1 text-sm text-slate-600 disabled:opacity-40"
          >
            הבא
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </HypPageLayout>
  );
}
