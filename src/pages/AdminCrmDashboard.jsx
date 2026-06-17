import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderOpen,
  LayoutDashboard,
  Search,
  ShieldCheck,
} from "lucide-react";
import { demoModeEnabled } from "@/api/demoClient";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import {
  assignReferral,
  closeReferral,
  getDepartmentName,
  getReferralAssignmentLabel,
  getReferralPriorityLabel,
  listAllOpenReferrals,
  REFERRAL_PRIORITIES,
  subscribeCrmStore,
  updateReferralPriority,
} from "@/lib/crmStore";
import { listCrmDepartments, subscribeCrmDepartments } from "@/lib/crmDepartments";
import ReferralTransferDialog from "@/components/crm/ReferralTransferDialog";
import { useToast } from "@/components/ui/use-toast";
import { hypHeaderIconClass, m3PageClass } from "@/lib/hypPage";
import { cn } from "@/lib/utils";

const MS_HOUR = 1000 * 60 * 60;

function hoursSince(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / MS_HOUR;
}

function getAgingTier(ref) {
  const h = hoursSince(ref.opened_at);
  if (h >= 24 * 7) return "7d";
  if (h >= 48) return "48h";
  if (h >= 24) return "24h";
  return null;
}

const AGING_BADGES = {
  "24h": { label: "24+ שעות", className: "text-amber-800 bg-amber-50 border-amber-200" },
  "48h": { label: "48+ שעות", className: "text-orange-800 bg-orange-50 border-orange-200" },
  "7d": { label: "7+ ימים", className: "text-red-800 bg-red-50 border-red-200" },
};

const PRIORITY_BADGES = {
  low: "text-slate-600 bg-slate-100 border-slate-200",
  normal: "text-primary bg-primary-container/50 border-outline/20",
  high: "text-orange-800 bg-orange-50 border-orange-200",
  urgent: "text-red-800 bg-red-50 border-red-200",
};

function formatDt(iso) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yy HH:mm");
  } catch {
    return "—";
  }
}

export default function AdminCrmDashboard() {
  const { toast } = useToast();
  const [openReferrals, setOpenReferrals] = useState(() => listAllOpenReferrals());
  const [departments, setDepartments] = useState(() => listCrmDepartments());
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [agingFilter, setAgingFilter] = useState("all");
  const [transferRef, setTransferRef] = useState(null);

  const refresh = useCallback(() => {
    setOpenReferrals(listAllOpenReferrals());
    setDepartments(listCrmDepartments());
  }, []);

  useEffect(() => {
    refresh();
    const unsubCrm = subscribeCrmStore(refresh);
    const unsubDept = subscribeCrmDepartments(refresh);
    return () => {
      unsubCrm();
      unsubDept();
    };
  }, [refresh]);

  const stats = useMemo(() => {
    const byPriority = Object.fromEntries(REFERRAL_PRIORITIES.map((p) => [p.value, 0]));
    const byDept = {};
    let agentAssigned = 0;
    let deptQueue = 0;
    let aging24 = 0;
    let aging48 = 0;
    let aging7d = 0;

    for (const ref of openReferrals) {
      const priority = ref.priority || "normal";
      byPriority[priority] = (byPriority[priority] || 0) + 1;

      if (ref.assigned_to_type === "department" && ref.assigned_department_id) {
        deptQueue += 1;
        const deptId = ref.assigned_department_id;
        byDept[deptId] = (byDept[deptId] || 0) + 1;
      } else {
        agentAssigned += 1;
      }

      const tier = getAgingTier(ref);
      if (tier === "24h") aging24 += 1;
      else if (tier === "48h") aging48 += 1;
      else if (tier === "7d") aging7d += 1;
    }

    return {
      total: openReferrals.length,
      agentAssigned,
      deptQueue,
      byPriority,
      byDept,
      aging24,
      aging48,
      aging7d,
    };
  }, [openReferrals]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openReferrals.filter((ref) => {
      if (deptFilter !== "all") {
        if (deptFilter === "agent") {
          if (ref.assigned_to_type !== "agent") return false;
        } else if (ref.assigned_department_id !== deptFilter) {
          return false;
        }
      }
      if (priorityFilter !== "all" && (ref.priority || "normal") !== priorityFilter) return false;
      if (agingFilter !== "all") {
        const tier = getAgingTier(ref);
        if (agingFilter === "24h" && !tier) return false;
        if (agingFilter === "48h" && tier !== "48h" && tier !== "7d") return false;
        if (agingFilter === "7d" && tier !== "7d") return false;
      }
      if (!q) return true;
      const hay = [
        ref.customer?.name,
        ref.referral_topic,
        ref.description,
        getReferralAssignmentLabel(ref),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [openReferrals, query, deptFilter, priorityFilter, agingFilter]);

  const handleAssign = (assignment) => {
    if (!transferRef) return;
    const updated = assignReferral(transferRef.id, assignment);
    if (updated) {
      toast({
        title: "שויך מחדש",
        description: `הפניה הועברה ל${getReferralAssignmentLabel(updated)}`,
      });
      refresh();
    }
    setTransferRef(null);
  };

  const handleClose = (ref) => {
    closeReferral(ref.id);
    toast({
      title: "נסגר",
      description: `פניה של ${ref.customer?.name || "לקוח"} נסגרה`,
    });
    refresh();
  };

  const handlePriorityChange = (refId, priority) => {
    updateReferralPriority(refId, priority);
    toast({ title: "עדיפות עודכנה", description: getReferralPriorityLabel(priority) });
    refresh();
  };

  return (
    <div className={m3PageClass("pb-24")} dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary-container/35 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 sm:py-10">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Link to="/admin" className="inline-flex items-center gap-1 m3-label-medium hover:text-primary">
              <ArrowRight className="w-4 h-4" />
              דשבורד מנהל
            </Link>
            <Link
              to="/admin/crm/departments"
              className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
            >
              <Building2 className="w-4 h-4" />
              ניהול מחלקות
            </Link>
          </div>
          <div className="flex items-start gap-4">
            <div className={cn(hypHeaderIconClass("shadow-elevation-1"), !demoModeEnabled && "bg-primary")}>
              <LayoutDashboard className={cn("w-6 h-6", demoModeEnabled ? "text-white" : "text-primary-foreground")} />
            </div>
            <div>
              <h1 className="m3-headline-small font-medium">דשבורד מפקח CRM</h1>
              <p className="m3-label-medium mt-1">סקירת פניות פתוחות, תורים ו-SLA</p>
            </div>
          </div>
          {isCrmCloudEnabled() ? (
            <span className="m3-badge mt-3">ענן · Supabase</span>
          ) : demoModeEnabled ? (
            <span className="m3-badge mt-3">דמו · localStorage</span>
          ) : null}
        </motion.div>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="m3-surface-container px-3 py-3 text-center">
            <p className="m3-label-medium">פניות פתוחות</p>
            <p className="text-2xl font-medium mt-0.5">{stats.total}</p>
          </div>
          <div className="m3-surface-container px-3 py-3 text-center">
            <p className="m3-label-medium">שויכו לנציג</p>
            <p className="text-2xl font-medium mt-0.5">{stats.agentAssigned}</p>
          </div>
          <div className="m3-surface-container px-3 py-3 text-center">
            <p className="m3-label-medium">תור מחלקה</p>
            <p className="text-2xl font-medium mt-0.5">{stats.deptQueue}</p>
          </div>
          <div className="m3-surface-container px-3 py-3 text-center">
            <p className="m3-label-medium flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              7+ ימים
            </p>
            <p className="text-2xl font-medium text-red-700 mt-0.5">{stats.aging7d}</p>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="m3-card p-4">
            <h2 className="m3-label-large mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              לפי עדיפות
            </h2>
            <div className="flex flex-wrap gap-2">
              {REFERRAL_PRIORITIES.map((p) => (
                <span
                  key={p.value}
                  className={cn(
                    "text-xs font-semibold border rounded-lg px-2.5 py-1",
                    PRIORITY_BADGES[p.value]
                  )}
                >
                  {p.label}: {stats.byPriority[p.value] || 0}
                </span>
              ))}
            </div>
          </div>
          <div className="m3-card p-4">
            <h2 className="m3-label-large mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              תור לפי מחלקה
            </h2>
            {stats.deptQueue === 0 ? (
              <p className="m3-label-medium">אין פניות בתור מחלקה</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byDept).map(([deptId, count]) => (
                  <span
                    key={deptId}
                    className="text-xs font-semibold border border-outline/25 rounded-lg px-2.5 py-1 bg-surface-container-low"
                  >
                    {getDepartmentName(deptId)}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="m3-card p-4 mb-6">
          <h2 className="m3-label-large mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            SLA / זמן פתוח
          </h2>
          <div className="flex flex-wrap gap-2">
            <span className={cn("text-xs font-semibold border rounded-lg px-2.5 py-1", AGING_BADGES["24h"].className)}>
              24+ שעות: {stats.aging24}
            </span>
            <span className={cn("text-xs font-semibold border rounded-lg px-2.5 py-1", AGING_BADGES["48h"].className)}>
              48+ שעות: {stats.aging48}
            </span>
            <span className={cn("text-xs font-semibold border rounded-lg px-2.5 py-1", AGING_BADGES["7d"].className)}>
              7+ ימים: {stats.aging7d}
            </span>
          </div>
        </section>

        <section className="mb-4">
          <h2 className="m3-label-large mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            פניות פתוחות ({filtered.length})
          </h2>
          <div className="m3-card p-4 mb-3 space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש לקוח, נושא או תיאור..."
                className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-outline/30 bg-surface-container-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm"
                aria-label="סינון מחלקה"
              >
                <option value="all">כל השיוכים</option>
                <option value="agent">נציג בלבד</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    מחלקת {dept.name}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm"
                aria-label="סינון עדיפות"
              >
                <option value="all">כל העדיפויות</option>
                {REFERRAL_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={agingFilter}
                onChange={(e) => setAgingFilter(e.target.value)}
                className="rounded-xl border border-outline/30 bg-surface-container-lowest px-3 py-2 text-sm"
                aria-label="סינון SLA"
              >
                <option value="all">כל הגילאים</option>
                <option value="24h">24+ שעות</option>
                <option value="48h">48+ שעות</option>
                <option value="7d">7+ ימים</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center m3-label-medium py-8 rounded-2xl border border-dashed border-outline/40 bg-surface-container-low/60">
              אין פניות פתוחות התואמות לסינון
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-outline/20 bg-surface-container-lowest shadow-elevation-1">
              <table className="w-full text-sm text-right min-w-[760px]">
                <thead>
                  <tr className="border-b border-outline/15 bg-surface-container-low m3-label-medium">
                    <th className="px-3 py-2.5 font-medium">לקוח</th>
                    <th className="px-3 py-2.5 font-medium">נושא</th>
                    <th className="px-3 py-2.5 font-medium">שיוך</th>
                    <th className="px-3 py-2.5 font-medium">עדיפות</th>
                    <th className="px-3 py-2.5 font-medium">נפתח</th>
                    <th className="px-3 py-2.5 font-medium">פעילות אחרונה</th>
                    <th className="px-3 py-2.5 font-medium">SLA</th>
                    <th className="px-3 py-2.5 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ref) => {
                    const agingTier = getAgingTier(ref);
                    const agingBadge = agingTier ? AGING_BADGES[agingTier] : null;
                    const priority = ref.priority || "normal";
                    return (
                      <tr key={ref.id} className="border-b border-outline/10 hover:bg-surface-container-low/80">
                        <td className="px-3 py-3">
                          <Link
                            to={`/crm/${ref.customer_id}`}
                            className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {ref.customer?.name || "—"}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs font-semibold border border-outline/20 rounded-lg px-2 py-0.5">
                            {ref.referral_topic}
                          </span>
                          <p className="m3-label-medium mt-1 line-clamp-1 max-w-[200px]">{ref.description}</p>
                        </td>
                        <td className="px-3 py-3 m3-label-medium whitespace-nowrap">
                          {getReferralAssignmentLabel(ref)}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={priority}
                            onChange={(e) => handlePriorityChange(ref.id, e.target.value)}
                            className={cn(
                              "text-xs font-semibold border rounded-lg px-2 py-1 bg-transparent",
                              PRIORITY_BADGES[priority]
                            )}
                            aria-label="עדיפות"
                          >
                            {REFERRAL_PRIORITIES.map((p) => (
                              <option key={p.value} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 m3-label-medium whitespace-nowrap">{formatDt(ref.opened_at)}</td>
                        <td className="px-3 py-3 m3-label-medium whitespace-nowrap">
                          {formatDt(ref.last_activity_at)}
                        </td>
                        <td className="px-3 py-3">
                          {agingBadge ? (
                            <span
                              className={cn(
                                "text-xs font-semibold border rounded-lg px-2 py-0.5",
                                agingBadge.className
                              )}
                            >
                              {agingBadge.label}
                            </span>
                          ) : (
                            <span className="text-xs text-on-surface-variant">בתוך SLA</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => setTransferRef(ref)}
                              className="m3-btn-tonal px-2 py-1 text-xs inline-flex items-center gap-1"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              שיוך
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClose(ref)}
                              className="text-xs font-semibold px-2 py-1 rounded-xl border border-outline/30 hover:bg-surface-container-high inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              סגור
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="m3-label-medium text-center text-on-surface-variant">
          יומן אירועי הפניות (audit) —{" "}
          <span className="text-on-surface-variant/70">בקרוב · Phase 4</span>
        </p>
      </div>

      <ReferralTransferDialog
        referral={transferRef}
        open={Boolean(transferRef)}
        onOpenChange={(open) => {
          if (!open) setTransferRef(null);
        }}
        onConfirm={handleAssign}
      />
    </div>
  );
}
