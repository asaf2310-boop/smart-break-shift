import { CRM_AGENT_DASHBOARD_FILTERS } from "@/lib/crmStore";

export const CRM_HOME_TAB = {
  id: "home",
  type: "home",
  label: "דשבורד",
  closable: false,
};

export function listTabId(filter) {
  return `list:${filter}`;
}

export function detailTabId(customerId, referralId) {
  return referralId ? `detail:${customerId}:${referralId}` : `detail:${customerId}`;
}

export function buildListTab(filter) {
  const meta = CRM_AGENT_DASHBOARD_FILTERS[filter];
  if (!meta) return null;
  return {
    id: listTabId(filter),
    type: "list",
    filter,
    label: meta.title,
    closable: true,
  };
}

export function buildDetailTab({ customerId, referralId = null, referralTopic = null, customerName = null }) {
  const label = referralTopic
    ? `${customerName || "לקוח"} · ${referralTopic}`
    : customerName || "לקוח";
  return {
    id: detailTabId(customerId, referralId),
    type: "detail",
    customerId,
    referralId,
    referralTopic,
    label,
    closable: true,
  };
}

export function buildNewCustomerTab(initial = null) {
  return {
    id: "action:new-customer",
    type: "newCustomer",
    label: "לקוח חדש",
    initial,
    closable: true,
  };
}

export function buildNewReferralTab() {
  return {
    id: "action:new-referral",
    type: "newReferral",
    label: "פתיחת פניה ידנית",
    closable: true,
  };
}

export function buildCrmAdminTab() {
  return {
    id: "action:crm-admin",
    type: "crmAdmin",
    label: "ניהול CRM",
    closable: true,
  };
}

export function openOrActivateTab(tabs, tab) {
  const index = tabs.findIndex((t) => t.id === tab.id);
  if (index !== -1) {
    const updated = [...tabs];
    updated[index] = { ...updated[index], ...tab };
    return { tabs: updated, activeTabId: tab.id };
  }
  return { tabs: [...tabs, tab], activeTabId: tab.id };
}

export function closeTab(tabs, tabId) {
  const index = tabs.findIndex((t) => t.id === tabId);
  if (index === -1) return { tabs, activeTabId: tabs[0]?.id ?? CRM_HOME_TAB.id };
  const tab = tabs[index];
  if (!tab.closable) return { tabs, activeTabId: tabId };

  const nextTabs = tabs.filter((t) => t.id !== tabId);
  const fallback = nextTabs[Math.min(index, nextTabs.length - 1)] ?? CRM_HOME_TAB;
  return { tabs: nextTabs.length ? nextTabs : [CRM_HOME_TAB], activeTabId: fallback.id };
}
