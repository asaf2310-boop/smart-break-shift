import { getAgentSession } from "@/lib/agentAuth";
import { getStoredAgentName } from "@/constants/scheduling";
import { getAgentSessionStorage, readJson, writeJson } from "@/lib/browserStoragePolicy";

const RECENTS_KEY_PREFIX = "smart-break-crm-recents-v1";
const MAX_RECENTS = 10;
export const CRM_RECENTS_CHANGED = "crm-recents-changed";

function getRecentsStorage() {
  return getAgentSessionStorage();
}

export function getAgentRecentsScope() {
  const session = getAgentSession();
  return session?.userId || getStoredAgentName() || "anonymous";
}

function storageKey(scope) {
  return `${RECENTS_KEY_PREFIX}:${scope}`;
}

function readRecents(scope = getAgentRecentsScope()) {
  const data = readJson(getRecentsStorage(), storageKey(scope));
  return {
    searches: Array.isArray(data?.searches) ? data.searches : [],
    visits: Array.isArray(data?.visits) ? data.visits : [],
  };
}

function writeRecents(scope, data) {
  writeJson(getRecentsStorage(), storageKey(scope), data);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CRM_RECENTS_CHANGED));
  }
}

function dedupePush(list, item, keyFn, max = MAX_RECENTS) {
  const key = keyFn(item);
  const filtered = list.filter((x) => keyFn(x) !== key);
  return [item, ...filtered].slice(0, max);
}

export function recordRecentSearch(query, meta = {}) {
  const q = String(query || "").trim();
  if (q.length < 2) return;
  const scope = getAgentRecentsScope();
  const recents = readRecents(scope);
  const entry = {
    query: q,
    at: new Date().toISOString(),
    ...meta,
  };
  recents.searches = dedupePush(recents.searches, entry, (x) => String(x.query || "").trim().toLowerCase());
  writeRecents(scope, recents);
}

export function recordRecentVisit({
  customerId,
  customerName,
  referralId = null,
  referralTopic = null,
  label = null,
} = {}) {
  const id = String(customerId || "").trim();
  if (!id) return;
  const scope = getAgentRecentsScope();
  const recents = readRecents(scope);
  const entry = {
    customerId: id,
    customerName: String(customerName || "").trim() || "לקוח",
    referralId: referralId || null,
    referralTopic: referralTopic || null,
    label: label || null,
    at: new Date().toISOString(),
  };
  recents.visits = dedupePush(recents.visits, entry, (x) =>
    x.referralId ? `${x.customerId}:${x.referralId}` : x.customerId
  );
  writeRecents(scope, recents);
}

export function listRecentSearches(limit = MAX_RECENTS) {
  return readRecents().searches.slice(0, limit);
}

export function listRecentVisits(limit = MAX_RECENTS) {
  return readRecents().visits.slice(0, limit);
}

export function subscribeCrmRecents(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(CRM_RECENTS_CHANGED, handler);
  return () => window.removeEventListener(CRM_RECENTS_CHANGED, handler);
}

export function formatRecentTimestamp(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
