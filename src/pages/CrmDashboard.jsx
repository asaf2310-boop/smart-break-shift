import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  Mail,
  Phone,
  Plus,
  Search,
  UserCircle,
  Users,
  UsersRound,
} from "lucide-react";
import { getStoredAgentName } from "@/constants/scheduling";
import { demoModeEnabled } from "@/api/demoClient";
import {
  countReferralsHandledTodayByAgent,
  createCustomer,
  crmDemoAvailable,
  getReferralAssignmentLabel,
  getReferralStatusLabel,
  listDepartmentQueuesForAgent,
  listOpenReferralsForAgent,
  searchCustomersByContact,
  subscribeCrmStore,
} from "@/lib/crmStore";
import CustomerForm from "@/components/crm/CustomerForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { hypHeaderIconClass, m3PageClass } from "@/lib/hypPage";
import { cn } from "@/lib/utils";

function ReferralCard({ referral, variant = "personal" }) {
  const topicClass =
    variant === "department"
      ? "text-on-primary-container bg-primary-container/70 border-outline/20"
      : "text-primary bg-primary-container/50 border-outline/20";

  return (
    <Link
      to={`/crm/${referral.customer_id}`}
      className="m3-card block px-4 py-3 hover:border-primary/30 transition-all"
    >
      <div className="flex justify-between gap-2 items-start">
        <div className="min-w-0">
          <span className="m3-label-large">{referral.customer?.name || "לקוח"}</span>
          <span className={`mr-2 text-xs font-semibold border rounded-lg px-2 py-0.5 ${topicClass}`}>
            {referral.referral_topic}
          </span>
        </div>
        <span className="m3-label-medium text-primary bg-primary-container/60 border border-outline/20 rounded-lg px-2 py-0.5 shrink-0">
          {getReferralStatusLabel(referral.status)}
        </span>
      </div>
      <p className="m3-label-medium mt-1.5 line-clamp-2">{referral.description}</p>
      {referral.reopened_at && (
        <p className="text-xs text-amber-700 mt-1">נפתח מחדש לאחר תגובת לקוח</p>
      )}
      {variant === "department" && (
        <p className="m3-label-medium mt-1">
          {getReferralAssignmentLabel(referral)} · יוצר: {referral.original_agent_name}
        </p>
      )}
    </Link>
  );
}

export default function CrmDashboard() {
  const agentName = getStoredAgentName();
  const [query, setQuery] = useState("");
  const [openReferrals, setOpenReferrals] = useState([]);
  const [departmentQueues, setDepartmentQueues] = useState([]);
  const [handledToday, setHandledToday] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addInitial, setAddInitial] = useState(null);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const refresh = useCallback(() => {
    setOpenReferrals(listOpenReferralsForAgent(agentName));
    setDepartmentQueues(listDepartmentQueuesForAgent(agentName));
    setHandledToday(countReferralsHandledTodayByAgent(agentName));
  }, [agentName]);

  useEffect(() => {
    refresh();
    return subscribeCrmStore(refresh);
  }, [refresh]);

  useEffect(() => {
    const notfound = searchParams.get("notfound");
    const addphone = searchParams.get("addphone");
    if (!notfound && !addphone) return;

    const next = new URLSearchParams(searchParams);
    if (notfound) {
      toast({
        title: "לקוח לא נמצא",
        description: `לא נמצא לקוח עבור המספר ${notfound}`,
        variant: "destructive",
      });
      next.delete("notfound");
    }
    if (addphone) {
      setAddInitial({ phone: addphone });
      setAddOpen(true);
      next.delete("addphone");
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast]);

  const searchResults = useMemo(
    () => searchCustomersByContact(query),
    [query]
  );

  const deptOpenCount = useMemo(
    () => departmentQueues.reduce((sum, q) => sum + q.referrals.length, 0),
    [departmentQueues]
  );

  if (!agentName) {
    return <Navigate to="/" replace />;
  }

  if (!crmDemoAvailable()) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <div className="max-w-md text-center m3-card p-8">
          <Users className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="m3-title-large text-xl font-medium mb-2">CRM — סביבת דמו</h1>
          <p className="m3-label-medium mb-6">
            מודול ה-CRM זמין כרגע עם <code className="text-xs bg-surface-container px-1 rounded-md">VITE_DEMO_MODE=true</code> ונתונים ב-localStorage.
          </p>
          <Link to="/" className="text-primary font-medium text-sm hover:underline">
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  const handleAddCustomer = (data) => {
    const created = createCustomer(data);
    setAddOpen(false);
    setAddInitial(null);
    toast({ title: "לקוח נוסף", description: created.name });
    refresh();
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div className={m3PageClass("pb-24")} dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary-container/35 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <Link to="/" className="inline-flex items-center gap-1 m3-label-medium hover:text-primary mb-4">
            <ArrowRight className="w-4 h-4" />
            ראשי
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={cn(hypHeaderIconClass("shadow-elevation-1 mb-3"), !demoModeEnabled && "bg-primary")}>
                <FolderOpen className={cn("w-6 h-6", demoModeEnabled ? "text-white" : "text-primary-foreground")} />
              </div>
              <h1 className="m3-headline-small font-medium">CRM — פניות</h1>
              <p className="m3-label-medium mt-1">
                שלום, <span className="font-semibold text-foreground">{agentName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="shrink-0 m3-btn-tonal px-3 py-2"
            >
              <Plus className="w-4 h-4" />
              לקוח חדש
            </button>
          </div>
          {demoModeEnabled && (
            <span className="m3-badge mt-3">דמו · localStorage</span>
          )}
        </motion.div>

        <section className="mb-6">
          <h2 className="m3-label-large mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-on-surface-variant" />
            חיפוש לקוח
          </h2>
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="שם, טלפון או אימייל..."
              className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-outline/30 bg-surface-container-lowest shadow-elevation-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {!hasQuery ? (
            <p className="m3-label-medium text-center py-2">הקלד לפחות תו אחד לחיפוש לקוח</p>
          ) : searchResults.length === 0 ? (
            <p className="text-center m3-label-medium py-4">לא נמצאו לקוחות</p>
          ) : (
            <div className="space-y-2">
              {searchResults.map((c) => (
                <Link
                  key={c.id}
                  to={`/crm/${c.id}`}
                  className="m3-card flex items-center gap-3 px-3 py-2.5 hover:border-primary/25 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center shrink-0">
                    <UserCircle className="w-5 h-5 text-on-primary-container" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="m3-label-large truncate text-sm">{c.name}</p>
                    <div className="flex flex-wrap gap-x-3 m3-label-medium mt-0.5">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                          <Mail className="w-3 h-3 shrink-0" />
                          {c.email}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="m3-surface-container px-3 py-2.5 text-center">
            <p className="m3-label-medium uppercase tracking-wide">פתוחות שלי</p>
            <p className="text-xl font-medium text-foreground mt-0.5">{openReferrals.length}</p>
          </div>
          <div className="m3-surface-container px-3 py-2.5 text-center">
            <p className="m3-label-medium uppercase tracking-wide">תור מחלקה</p>
            <p className="text-xl font-medium text-foreground mt-0.5">{deptOpenCount}</p>
          </div>
          <div className="m3-surface-container px-3 py-2.5 text-center">
            <p className="m3-label-medium uppercase tracking-wide flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              טופלו היום
            </p>
            <p className="text-xl font-medium text-foreground mt-0.5">{handledToday}</p>
          </div>
        </div>

        <section className="mb-6">
          <h2 className="m3-label-large mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            פניות פתוחות — שויכו אליי ({openReferrals.length})
          </h2>
          {openReferrals.length === 0 ? (
            <p className="text-center m3-label-medium py-6 rounded-2xl border border-dashed border-outline/40 bg-surface-container-low/60">
              אין פניות פתוחות בשם הנציג
            </p>
          ) : (
            <div className="space-y-2">
              {openReferrals.map((ref) => (
                <ReferralCard key={ref.id} referral={ref} variant="personal" />
              ))}
            </div>
          )}
        </section>

        {departmentQueues.map(
          ({ department, referrals }) =>
            referrals.length > 0 && (
              <section key={department.id} className="mb-6">
                <h2 className="m3-label-large mb-3 flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-primary" />
                  תור מחלקת {department.name} ({referrals.length})
                </h2>
                <div className="space-y-2">
                  {referrals.map((ref) => (
                    <ReferralCard key={ref.id} referral={ref} variant="department" />
                  ))}
                </div>
              </section>
            )
        )}
      </div>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setAddInitial(null);
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl shadow-elevation-3" dir="rtl">
          <DialogHeader>
            <DialogTitle>לקוח חדש</DialogTitle>
          </DialogHeader>
          <CustomerForm
            initial={addInitial}
            onSubmit={handleAddCustomer}
            onCancel={() => {
              setAddOpen(false);
              setAddInitial(null);
            }}
            submitLabel="הוספה"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
