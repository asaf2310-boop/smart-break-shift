import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FolderOpen,
  History,
  LayoutDashboard,
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
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import {
  claimDepartmentReferral,
  createCustomer,
  crmDemoAvailable,
  CRM_AGENT_DASHBOARD_FILTERS,
  getReferralAssignmentLabel,
  getReferralStatusLabel,
  getCustomerById,
  listReferralsForAgentDashboardFilter,
  loadAgentDashboardCounts,
  readCrmDashboardCountsCache,
  searchCustomersByContact,
  subscribeCrmStore,
} from "@/lib/crmStore";
import {
  formatRecentTimestamp,
  listRecentSearches,
  listRecentVisits,
  recordRecentSearch,
  recordRecentVisit,
  subscribeCrmRecents,
} from "@/lib/crmRecents";
import CustomerForm from "@/components/crm/CustomerForm";
import CrmBackToDashboard from "@/components/crm/CrmBackToDashboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { hypHeaderIconClass, m3PageClass } from "@/lib/hypPage";
import { cn } from "@/lib/utils";
import { useCrmRole } from "@/hooks/useCrmRole";

const DASHBOARD_CARDS = [
  {
    filter: "my-open",
    icon: FolderOpen,
    accent: "text-primary bg-primary-container/60 border-primary/20",
  },
  {
    filter: "team-open",
    icon: UsersRound,
    accent: "text-on-primary-container bg-primary-container/70 border-outline/20",
  },
  {
    filter: "my-dept",
    icon: Building2,
    accent: "text-amber-800 bg-amber-50 border-amber-200/80",
  },
  {
    filter: "handled-month",
    icon: CheckCircle2,
    accent: "text-emerald-800 bg-emerald-50 border-emerald-200/80",
  },
];

function getInitialDashboardCounts(agentName) {
  const cached = readCrmDashboardCountsCache(agentName);
  if (cached) return cached;
  return Object.fromEntries(DASHBOARD_CARDS.map(({ filter }) => [filter, 0]));
}

function ReferralCard({ referral, variant = "personal", onClaim = null, showClosedAt = false, onOpen = null }) {
  const topicClass =
    variant === "department"
      ? "text-on-primary-container bg-primary-container/70 border-outline/20"
      : "text-primary bg-primary-container/50 border-outline/20";

  return (
    <div className="m3-card px-4 py-3 hover:border-primary/30 transition-all">
      <Link
        to={`/crm/${referral.customer_id}`}
        state={{
          referralId: referral.id,
          referralTopic: referral.referral_topic,
        }}
        onClick={() => {
          if (typeof onOpen === "function") {
            onOpen(referral);
          }
        }}
        className="block"
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
        {showClosedAt && referral.closed_at && (
          <p className="text-xs text-emerald-700 mt-1">
            נסגר: {new Date(referral.closed_at).toLocaleDateString("he-IL")}
          </p>
        )}
        {variant === "department" && (
          <p className="m3-label-medium mt-1">
            {getReferralAssignmentLabel(referral)} · יוצר: {referral.original_agent_name}
          </p>
        )}
        {variant === "personal" && referral.status === "open" && (
          <p className="m3-label-medium mt-1">{getReferralAssignmentLabel(referral)}</p>
        )}
      </Link>
      {variant === "department" && typeof onClaim === "function" && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => onClaim(referral)}
            className="m3-btn-tonal px-3 py-1.5 text-xs"
          >
            קח לטיפול
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardCard({ filter, count, icon: Icon, accent, onClick }) {
  const meta = CRM_AGENT_DASHBOARD_FILTERS[filter];
  if (!meta) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="m3-card flex min-w-[5.25rem] flex-1 basis-0 flex-col items-center justify-center gap-1 p-2 text-center hover:border-primary/40 hover:shadow-elevation-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-w-0"
    >
      <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center shrink-0", accent)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-2xl font-semibold text-foreground leading-none tabular-nums">{count}</p>
      <p className="text-xs font-bold leading-tight line-clamp-2 text-foreground">{meta.title}</p>
    </button>
  );
}

export default function CrmDashboard() {
  const agentName = getStoredAgentName();
  const { hasCrmAgentDashboard, hasCrmAdminAccess } = useCrmRole();
  const [query, setQuery] = useState("");
  const [dashboardCounts, setDashboardCounts] = useState(() => getInitialDashboardCounts(agentName));
  const [filteredReferrals, setFilteredReferrals] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addInitial, setAddInitial] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentVisits, setRecentVisits] = useState([]);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = searchParams.get("filter");
  const filterMeta = activeFilter ? CRM_AGENT_DASHBOARD_FILTERS[activeFilter] : null;
  const isListView = Boolean(filterMeta);

  const refreshCounts = useCallback(() => {
    void loadAgentDashboardCounts(agentName).then((counts) => {
      setDashboardCounts(counts);
    });
  }, [agentName]);

  const refreshList = useCallback(() => {
    if (activeFilter && CRM_AGENT_DASHBOARD_FILTERS[activeFilter]) {
      setFilteredReferrals(listReferralsForAgentDashboardFilter(activeFilter, agentName));
    } else {
      setFilteredReferrals([]);
    }
  }, [activeFilter, agentName]);

  const refresh = useCallback(() => {
    refreshCounts();
    refreshList();
  }, [refreshCounts, refreshList]);

  const handleClaimDepartmentReferral = useCallback(
    (referral) => {
      const updated = claimDepartmentReferral(referral.id, agentName);
      if (!updated) {
        toast({ title: "לא ניתן לקחת לטיפול", description: "הפניה כבר שויכה או נסגרה" });
        refresh();
        return;
      }
      toast({
        title: "הפניה שויכה אליך",
        description: `${referral.customer?.name || "הלקוח"} הועברה לטיפול אישי`,
      });
      refresh();
    },
    [agentName, refresh, toast]
  );

  const refreshRecents = useCallback(() => {
    setRecentSearches(listRecentSearches());
    setRecentVisits(listRecentVisits());
  }, []);

  useEffect(() => {
    refresh();
    refreshRecents();
    const unsubStore = subscribeCrmStore(refresh);
    const unsubRecents = subscribeCrmRecents(refreshRecents);
    return () => {
      unsubStore();
      unsubRecents();
    };
  }, [refresh, refreshRecents]);

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

  const searchResults = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return searchCustomersByContact(q);
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    const timer = window.setTimeout(() => {
      recordRecentSearch(q);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [query]);

  const handleOpenCustomerFromSearch = useCallback((customer) => {
    recordRecentSearch(query.trim());
    recordRecentVisit({
      customerId: customer.id,
      customerName: customer.name,
    });
    refreshRecents();
  }, [query, refreshRecents]);

  const handleOpenReferral = useCallback((referral) => {
    recordRecentVisit({
      customerId: referral.customer_id,
      customerName: referral.customer?.name,
      referralId: referral.id,
      referralTopic: referral.referral_topic,
    });
    refreshRecents();
  }, [refreshRecents]);

  const handleRecentSearchClick = useCallback((searchQuery) => {
    setQuery(searchQuery);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
  }, []);

  const openFilter = useCallback(
    (filter) => {
      setSearchParams({ filter });
    },
    [setSearchParams]
  );

  const closeListView = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const resolvedRecentVisits = useMemo(
    () =>
      recentVisits.map((visit) => {
        const customer = getCustomerById(visit.customerId);
        return {
          ...visit,
          customerName: customer?.name || visit.customerName,
          missing: !customer,
        };
      }),
    [recentVisits]
  );

  if (!agentName) {
    return <Navigate to="/" replace />;
  }

  if (isListView && !hasCrmAgentDashboard) {
    return <Navigate to="/crm" replace />;
  }

  if (!crmDemoAvailable()) {
    return (
      <div className={m3PageClass("flex items-center justify-center p-6")} dir="rtl">
        <div className="max-w-md text-center m3-card p-8">
          <Users className="w-12 h-12 mx-auto text-primary mb-4" />
          <h1 className="m3-title-large text-xl font-medium mb-2">CRM אינו פעיל</h1>
          <p className="m3-label-medium mb-6">
            מודול ה-CRM כבוי בסביבה זו. הפעילו אותו ב-Vercel או הסירו{" "}
            <code className="text-xs bg-surface-container px-1 rounded-md">VITE_CRM_ENABLED=false</code>.
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
  const showDashboardBack = isListView || hasQuery;
  const listVariant =
    activeFilter === "team-open" || activeFilter === "my-dept" ? "department" : "personal";
  const showClaimInList = activeFilter === "team-open";
  const showClosedAt = activeFilter === "handled-month";

  return (
    <div className={m3PageClass("pb-24")} dir="rtl">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary-container/35 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 sm:py-10">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          {showDashboardBack ? (
            <CrmBackToDashboard
              onClick={isListView ? closeListView : clearSearch}
            />
          ) : (
            <Link to="/" className="inline-flex items-center gap-1 m3-label-medium hover:text-primary mb-4">
              <ArrowRight className="w-4 h-4" />
              ראשי
            </Link>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={cn(hypHeaderIconClass("shadow-elevation-1 mb-3"), !demoModeEnabled && "bg-primary")}>
                {isListView ? (
                  <FolderOpen className={cn("w-6 h-6", demoModeEnabled ? "text-white" : "text-primary-foreground")} />
                ) : (
                  <LayoutDashboard className={cn("w-6 h-6", demoModeEnabled ? "text-white" : "text-primary-foreground")} />
                )}
              </div>
              <h1 className="m3-headline-small font-medium">
                {isListView
                  ? filterMeta.title
                  : hasCrmAgentDashboard
                    ? "CRM — דשבורד נציג"
                    : "CRM — חיפוש לקוחות"}
              </h1>
              <p className="m3-label-medium mt-1">
                {isListView ? (
                  filterMeta.description
                ) : (
                  <>
                    שלום, <span className="font-semibold text-foreground">{agentName}</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {hasCrmAdminAccess && (
                <Link to="/admin/crm" className="m3-btn-tonal px-3 py-2 text-sm">
                  <LayoutDashboard className="w-4 h-4" />
                  ניהול CRM
                </Link>
              )}
              {hasCrmAgentDashboard && (
                <Link to="/crm/new" className="m3-btn-primary px-3 py-2 text-sm">
                  <FolderOpen className="w-4 h-4" />
                  פתיחת פניה ידנית
                </Link>
              )}
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="m3-btn-tonal px-3 py-2"
              >
                <Plus className="w-4 h-4" />
                לקוח חדש
              </button>
            </div>
          </div>
          {isCrmCloudEnabled() ? (
            <span className="m3-badge mt-3">ענן · Supabase</span>
          ) : demoModeEnabled ? (
            <span className="m3-badge mt-3">דמו · localStorage</span>
          ) : null}
        </motion.div>

        {isListView ? (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="m3-label-large">
                {filterMeta.title} ({filteredReferrals.length})
              </h2>
              {hasCrmAgentDashboard && (
                <Link to="/crm/new" className="m3-btn-primary px-3 py-2 text-sm">
                  <FolderOpen className="w-4 h-4" />
                  פתיחת פניה ידנית
                </Link>
              )}
            </div>
            {filteredReferrals.length === 0 ? (
              <p className="text-center m3-label-medium py-8 rounded-2xl border border-dashed border-outline/40 bg-surface-container-low/60">
                אין פניות להצגה
              </p>
            ) : (
              <div className="space-y-2">
                {filteredReferrals.map((ref) => (
                  <ReferralCard
                    key={ref.id}
                    referral={ref}
                    variant={listVariant}
                    showClosedAt={showClosedAt}
                    onClaim={showClaimInList ? handleClaimDepartmentReferral : null}
                    onOpen={handleOpenReferral}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
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
              {hasQuery && searchResults.length === 0 ? (
                <p className="text-center m3-label-medium py-4">לא נמצאו לקוחות</p>
              ) : null}
              {hasQuery && searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((c) => (
                    <Link
                      key={c.id}
                      to={`/crm/${c.id}`}
                      onClick={() => handleOpenCustomerFromSearch(c)}
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
              ) : null}
            </section>

            {hasCrmAgentDashboard && (
              <section className="mb-6">
                <h2 className="m3-label-large mb-3 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-primary" />
                  סיכום פניות
                </h2>
                <div className="flex gap-2 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-4 sm:overflow-visible">
                  {DASHBOARD_CARDS.map(({ filter, icon, accent }) => (
                    <DashboardCard
                      key={filter}
                      filter={filter}
                      count={dashboardCounts[filter] ?? 0}
                      icon={icon}
                      accent={accent}
                      onClick={() => openFilter(filter)}
                    />
                  ))}
                </div>
              </section>
            )}

            {!hasQuery && (
              <>
                <section className="mb-6">
                  <h2 className="m3-label-large mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    חיפושים אחרונים
                  </h2>
                  {recentSearches.length === 0 ? (
                    <p className="text-center m3-label-medium py-6 rounded-2xl border border-dashed border-outline/40 bg-surface-container-low/60">
                      אין חיפושים אחרונים — הקלד בשדה החיפוש למעלה
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentSearches.map((item) => (
                        <button
                          key={item.query}
                          type="button"
                          onClick={() => handleRecentSearchClick(item.query)}
                          className="w-full m3-card flex items-center justify-between gap-3 px-3 py-2.5 hover:border-primary/25 transition-all text-right"
                        >
                          <span className="m3-label-large truncate text-sm">{item.query}</span>
                          <span className="m3-label-medium shrink-0 text-on-surface-variant">
                            {formatRecentTimestamp(item.at)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mb-6">
                  <h2 className="m3-label-large mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    פניות / טיקטים אחרונים
                  </h2>
                  {resolvedRecentVisits.length === 0 ? (
                    <p className="text-center m3-label-medium py-6 rounded-2xl border border-dashed border-outline/40 bg-surface-container-low/60">
                      אין פניות אחרונות — פתח לקוח או פניה מהכרטיסים למעלה
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {resolvedRecentVisits.map((visit) => (
                        <Link
                          key={visit.referralId ? `${visit.customerId}:${visit.referralId}` : visit.customerId}
                          to={`/crm/${visit.customerId}`}
                          state={
                            visit.referralId
                              ? { referralId: visit.referralId, referralTopic: visit.referralTopic }
                              : undefined
                          }
                          onClick={() => handleOpenReferral({
                            id: visit.referralId,
                            customer_id: visit.customerId,
                            customer: { name: visit.customerName },
                            referral_topic: visit.referralTopic,
                          })}
                          className={cn(
                            "m3-card flex items-center justify-between gap-3 px-3 py-2.5 hover:border-primary/25 transition-all",
                            visit.missing && "opacity-60"
                          )}
                        >
                          <div className="min-w-0 text-right flex-1">
                            <p className="m3-label-large truncate text-sm">{visit.customerName}</p>
                            {visit.referralTopic && (
                              <p className="m3-label-medium mt-0.5 truncate">{visit.referralTopic}</p>
                            )}
                          </div>
                          <span className="m3-label-medium shrink-0 text-on-surface-variant">
                            {formatRecentTimestamp(visit.at)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
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
