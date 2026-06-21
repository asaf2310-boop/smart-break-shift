import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
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
import {
  buildDetailTab,
  buildListTab,
  closeTab,
  CRM_HOME_TAB,
  openOrActivateTab,
} from "@/lib/crmDashboardTabs";
import CustomerForm from "@/components/crm/CustomerForm";
import CrmDashboardTabBar from "@/components/crm/CrmDashboardTabBar";
import CrmCustomerDetail from "@/pages/CrmCustomerDetail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { getAgentSession } from "@/lib/agentAuth";
import {
  effectiveCrmRole,
  hasCrmAdminAccess as crmRoleHasAdminAccess,
  hasCrmAgentDashboard as crmRoleHasAgentDashboard,
} from "@/lib/crmRoles";
import { m3PageClass } from "@/lib/hypPage";
import { cn } from "@/lib/utils";
import "@/styles/crm-dashboard.css";

const DASHBOARD_CARDS = [
  { filter: "my-open", icon: FolderOpen, iconVariant: "indigo" },
  { filter: "team-open", icon: UsersRound, iconVariant: "sage" },
  { filter: "my-dept", icon: Building2, iconVariant: "gold" },
  { filter: "handled-month", icon: CheckCircle2, iconVariant: "sky" },
];

function getInitialDashboardCounts(agentName) {
  const cached = readCrmDashboardCountsCache(agentName);
  if (cached) return cached;
  return Object.fromEntries(DASHBOARD_CARDS.map(({ filter }) => [filter, 0]));
}

const CRM_TITLE_SPLIT = /^CRM\s*[—–-]\s*(.+)$/u;

function DashboardTitle({ title }) {
  const match = CRM_TITLE_SPLIT.exec(title);
  if (match) {
    return (
      <h1 className="dashboard-title">
        <span className="dashboard-title-brand">CRM</span>
        <span className="dashboard-title-sep" aria-hidden="true">
          —
        </span>
        <span className="dashboard-title-sub">{match[1]}</span>
      </h1>
    );
  }
  return <h1 className="dashboard-title dashboard-title-plain">{title}</h1>;
}

function ReferralCard({ referral, variant = "personal", onClaim = null, showClosedAt = false, onOpen = null }) {
  const topicClass =
    variant === "department"
      ? "text-on-primary-container bg-primary-container/70 border-outline/20"
      : "text-primary bg-primary-container/50 border-outline/20";

  return (
    <div className="m3-card px-4 py-3 hover:border-primary/30 transition-all">
      <button
        type="button"
        onClick={() => {
          if (typeof onOpen === "function") {
            onOpen(referral);
          }
        }}
        className="block w-full text-right"
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
      </button>
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

function DashboardCard({ filter, count, icon: Icon, iconVariant, onClick }) {
  const meta = CRM_AGENT_DASHBOARD_FILTERS[filter];
  if (!meta) return null;

  return (
    <button type="button" onClick={onClick} className="dashboard-summary-card">
      <div className={cn("card-icon", `card-icon--${iconVariant}`)}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="card-count">{count}</div>
      <div className="card-label">{meta.title}</div>
    </button>
  );
}

function useCrmDashboardAccess() {
  const [session, setSession] = useState(() => getAgentSession());

  useEffect(() => {
    const sync = () => setSession(getAgentSession());
    window.addEventListener("agent-session-changed", sync);
    return () => window.removeEventListener("agent-session-changed", sync);
  }, []);

  const role = useMemo(
    () =>
      effectiveCrmRole({
        crmRole: session?.crmRole,
        isAdmin: session?.isAdmin,
      }),
    [session?.crmRole, session?.isAdmin]
  );
  const hasIdentity = Boolean(session?.email || session?.userId);
  return {
    hasCrmAgentDashboard: hasIdentity && crmRoleHasAgentDashboard(role),
    hasCrmAdminAccess: hasIdentity && crmRoleHasAdminAccess(role),
  };
}

export default function CrmDashboard() {
  const agentName = getStoredAgentName();
  const { hasCrmAgentDashboard, hasCrmAdminAccess } = useCrmDashboardAccess();
  const [query, setQuery] = useState("");
  const [dashboardCounts, setDashboardCounts] = useState(() => getInitialDashboardCounts(agentName));
  const [filteredReferrals, setFilteredReferrals] = useState([]);
  const [tabs, setTabs] = useState([CRM_HOME_TAB]);
  const [activeTabId, setActiveTabId] = useState(CRM_HOME_TAB.id);
  const [addOpen, setAddOpen] = useState(false);
  const [addInitial, setAddInitial] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentVisits, setRecentVisits] = useState([]);
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? CRM_HOME_TAB,
    [tabs, activeTabId]
  );
  const isHomeTab = activeTab.type === "home";
  const isListTab = activeTab.type === "list";
  const isDetailTab = activeTab.type === "detail";
  const filterMeta = isListTab ? CRM_AGENT_DASHBOARD_FILTERS[activeTab.filter] : null;

  const refreshCounts = useCallback(() => {
    void loadAgentDashboardCounts(agentName).then((counts) => {
      setDashboardCounts(counts);
    });
  }, [agentName]);

  const refreshList = useCallback(() => {
    if (isListTab && activeTab.filter && CRM_AGENT_DASHBOARD_FILTERS[activeTab.filter]) {
      setFilteredReferrals(listReferralsForAgentDashboardFilter(activeTab.filter, agentName));
    } else {
      setFilteredReferrals([]);
    }
  }, [activeTab.filter, agentName, isListTab]);

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
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    const legacyFilter = searchParams.get("filter");
    if (!legacyFilter || !CRM_AGENT_DASHBOARD_FILTERS[legacyFilter]) return;
    const listTab = buildListTab(legacyFilter);
    if (!listTab) return;
    setTabs((prev) => openOrActivateTab(prev, listTab).tabs);
    setActiveTabId(listTab.id);
    const next = new URLSearchParams(searchParams);
    next.delete("filter");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const openListTab = useCallback((filter) => {
    const listTab = buildListTab(filter);
    if (!listTab) return;
    setTabs((prev) => openOrActivateTab(prev, listTab).tabs);
    setActiveTabId(listTab.id);
  }, []);

  const openDetailTab = useCallback(
    ({ customerId, referralId = null, referralTopic = null, customerName = null }) => {
      const detailTab = buildDetailTab({ customerId, referralId, referralTopic, customerName });
      setTabs((prev) => openOrActivateTab(prev, detailTab).tabs);
      setActiveTabId(detailTab.id);
      recordRecentVisit({
        customerId,
        customerName,
        referralId,
        referralTopic,
      });
      refreshRecents();
    },
    [refreshRecents]
  );

  const handleSelectTab = useCallback((tabId) => {
    setActiveTabId(tabId);
  }, []);

  const handleCloseTab = useCallback((tabId) => {
    setTabs((prev) => {
      const result = closeTab(prev, tabId);
      setActiveTabId(result.activeTabId);
      return result.tabs;
    });
  }, []);

  const handleOpenCustomerFromSearch = useCallback(
    (customer) => {
      recordRecentSearch(query.trim());
      openDetailTab({
        customerId: customer.id,
        customerName: customer.name,
      });
    },
    [openDetailTab, query]
  );

  const handleOpenReferral = useCallback(
    (referral) => {
      openDetailTab({
        customerId: referral.customer_id,
        referralId: referral.id,
        referralTopic: referral.referral_topic,
        customerName: referral.customer?.name,
      });
    },
    [openDetailTab]
  );

  const handleRecentSearchClick = useCallback((searchQuery) => {
    setQuery(searchQuery);
  }, []);

  const handleDetailDeleted = useCallback(
    (tabId) => {
      handleCloseTab(tabId);
    },
    [handleCloseTab]
  );

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
  const listVariant =
    isListTab && (activeTab.filter === "team-open" || activeTab.filter === "my-dept")
      ? "department"
      : "personal";
  const showClaimInList = isListTab && activeTab.filter === "team-open";
  const showClosedAt = isListTab && activeTab.filter === "handled-month";

  const headerTitle = isListTab
    ? filterMeta?.title
    : isDetailTab
      ? activeTab.label
      : hasCrmAgentDashboard
        ? "CRM — דשבורד נציג"
        : "CRM — חיפוש לקוחות";

  const headerDescription = isListTab ? (
    filterMeta?.description
  ) : isDetailTab ? (
    "כרטיס לקוח / פניה"
  ) : (
    <>
      שלום, <strong>{agentName}</strong>
    </>
  );

  return (
    <div className={cn(m3PageClass("pb-24 body-container min-h-screen"), "relative")} dir="rtl">
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <div>
          {isHomeTab && (
            <Link to="/" className="crm-nav-link">
              <ArrowRight className="w-4 h-4" />
              ראשי
            </Link>
          )}

          <div className="dashboard-title-panel">
            <DashboardTitle title={headerTitle} />
            <p className="user-info">{headerDescription}</p>
            {demoModeEnabled ? (
              <span className="demo-tag">דמו · localStorage</span>
            ) : null}
          </div>

          <CrmDashboardTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={handleSelectTab}
            onClose={handleCloseTab}
          />

        {isDetailTab ? (
          <CrmCustomerDetail
            embedded
            customerId={activeTab.customerId}
            referralId={activeTab.referralId}
            referralTopic={activeTab.referralTopic}
            onDeleted={() => handleDetailDeleted(activeTab.id)}
          />
        ) : isListTab ? (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="crm-section-title">
                {filterMeta.title} ({filteredReferrals.length})
              </h2>
              {hasCrmAgentDashboard && (
                <Link to="/crm/new" className="btn-action-pill btn-blue-action">
                  <FolderOpen className="w-4 h-4" />
                  <span>פתיחת פניה ידנית</span>
                </Link>
              )}
            </div>
            {filteredReferrals.length === 0 ? (
              <p className="crm-empty-state">אין פניות להצגה</p>
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
            <div className="dashboard-actions-row">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="btn-action-pill btn-green-action"
              >
                <Plus className="w-4 h-4" />
                <span>לקוח חדש</span>
              </button>
              {hasCrmAgentDashboard && (
                <Link to="/crm/new" className="btn-action-pill btn-blue-action">
                  <FolderOpen className="w-4 h-4" />
                  <span>פתיחת פניה ידנית</span>
                </Link>
              )}
              {hasCrmAdminAccess && (
                <Link to="/admin/crm" className="btn-action-pill btn-outline-action">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>ניהול CRM</span>
                </Link>
              )}
            </div>

            <section className="mb-6">
              <h2 className="crm-section-title">
                <Search className="w-4 h-4" />
                חיפוש לקוח
              </h2>
              <div className="search-bar-panel">
                <span className="search-icon-wrapper" aria-hidden>
                  <Search className="w-5 h-5" />
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="שם, טלפון או אימייל..."
                  className="client-search-input"
                />
              </div>
              {hasQuery && searchResults.length === 0 ? (
                <p className="crm-empty-state py-4">לא נמצאו לקוחות</p>
              ) : null}
              {hasQuery && searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleOpenCustomerFromSearch(c)}
                      className="crm-glass-panel crm-result-card w-full text-right"
                    >
                      <div className="w-9 h-9 rounded-full bg-[color-mix(in_srgb,var(--color-accent-sky)_50%,white)] flex items-center justify-center shrink-0">
                        <UserCircle className="w-5 h-5 text-[var(--color-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="font-semibold truncate text-sm text-[var(--color-primary)]">{c.name}</p>
                        <div className="flex flex-wrap gap-x-3 text-sm text-[#666] mt-0.5">
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
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            {hasCrmAgentDashboard && (
              <section className="mb-6">
                <h2 className="crm-section-title">
                  <LayoutDashboard className="w-4 h-4" />
                  סיכום פניות
                </h2>
                <div className="summary-cards-container">
                  {DASHBOARD_CARDS.map(({ filter, icon, iconVariant }) => (
                    <DashboardCard
                      key={filter}
                      filter={filter}
                      count={dashboardCounts[filter] ?? 0}
                      icon={icon}
                      iconVariant={iconVariant}
                      onClick={() => openListTab(filter)}
                    />
                  ))}
                </div>
              </section>
            )}

            {!hasQuery && (
              <>
                <section className="mb-6">
                  <h2 className="crm-section-title">
                    <History className="w-4 h-4" />
                    חיפושים אחרונים
                  </h2>
                  {recentSearches.length === 0 ? (
                    <p className="crm-empty-state">אין חיפושים אחרונים — הקלד בשדה החיפוש למעלה</p>
                  ) : (
                    <div className="space-y-2">
                      {recentSearches.map((item) => (
                        <button
                          key={item.query}
                          type="button"
                          onClick={() => handleRecentSearchClick(item.query)}
                          className="crm-glass-panel crm-result-card w-full text-right"
                        >
                          <span className="font-semibold truncate text-sm text-[var(--color-primary)]">{item.query}</span>
                          <span className="shrink-0 text-sm text-[#888]">
                            {formatRecentTimestamp(item.at)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mb-6">
                  <h2 className="crm-section-title">
                    <Clock className="w-4 h-4" />
                    פניות / טיקטים אחרונים
                  </h2>
                  {resolvedRecentVisits.length === 0 ? (
                    <p className="crm-empty-state">
                      אין פניות אחרונות — פתח לקוח או פניה מהכרטיסים למעלה
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {resolvedRecentVisits.map((visit) => (
                        <button
                          key={visit.referralId ? `${visit.customerId}:${visit.referralId}` : visit.customerId}
                          type="button"
                          onClick={() =>
                            handleOpenReferral({
                              id: visit.referralId,
                              customer_id: visit.customerId,
                              customer: { name: visit.customerName },
                              referral_topic: visit.referralTopic,
                            })
                          }
                          className={cn(
                            "crm-glass-panel crm-result-card w-full text-right",
                            visit.missing && "opacity-60"
                          )}
                        >
                          <div className="min-w-0 text-right flex-1">
                            <p className="font-semibold truncate text-sm text-[var(--color-primary)]">{visit.customerName}</p>
                            {visit.referralTopic && (
                              <p className="text-sm text-[#666] mt-0.5 truncate">{visit.referralTopic}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-sm text-[#888]">
                            {formatRecentTimestamp(visit.at)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
        </div>
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
