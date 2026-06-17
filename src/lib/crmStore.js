import { crmEnabled } from "@/api/crmMode";
import { isCrmCloudEnabled } from "@/api/crmCloudMode";
import { getDepartmentName, getDepartmentsForAgent, isCrmDepartmentsHydrated } from "@/lib/crmDepartments";
import {
  deleteCallLogFromCloud,
  deleteCustomerFromCloud,
  deleteEmailLogFromCloud,
  invalidateCrmCloudCache,
  loadCrmFromCloud,
  logReferralEvent,
  migrateLocalStoreToCloud,
  persistCallLog,
  persistCustomer,
  persistEmailLog,
  persistReferral,
} from "@/lib/crmCloudSync";

export const CRM_STORAGE_KEY = "smart-break-shift-crm-v3";
const CRM_STORAGE_KEY_V2 = "smart-break-shift-crm-v2";
export const REFERRAL_REOPEN_DAYS = 7;
export const CRM_CHANGE_EVENT = "crm-store-changed";

let memoryStore = null;
let hydratePromise = null;
let cloudHydrated = false;

function emptyStore() {
  return { customers: [], callLogs: [], emailLogs: [], referrals: [] };
}

function warnCloudPersist(err, op) {
  console.warn(`[crmStore] cloud ${op} failed`, err);
}

/*
-- Supabase (production, later):
-- create table crm_customers (
--   id uuid primary key default gen_random_uuid(),
--   name text not null,
--   phone text,
--   email text,
--   company text,
--   notes text,
--   created_at timestamptz default now(),
--   updated_at timestamptz default now()
-- );
-- create table crm_call_logs (
--   id uuid primary key default gen_random_uuid(),
--   customer_id uuid references crm_customers(id) on delete cascade,
--   occurred_at timestamptz not null,
--   call_type text check (call_type in ('incoming','outgoing','chat')),
--   summary text,
--   agent_name text,
--   duration_minutes int,
--   referral_topic text,
--   created_at timestamptz default now()
-- );
-- create table crm_referrals (
--   id uuid primary key default gen_random_uuid(),
--   customer_id uuid references crm_customers(id) on delete cascade,
--   referral_topic text,
--   description text,
--   agent_name text not null,
--   original_agent_name text not null,
--   assigned_to_type text check (assigned_to_type in ('agent','department')) default 'agent',
--   assigned_agent_name text,
--   assigned_department_id text,
--   status text check (status in ('open','closed')) default 'open',
--   opened_at timestamptz not null,
--   closed_at timestamptz,
--   last_activity_at timestamptz not null,
--   reopened_at timestamptz,
--   created_at timestamptz default now()
-- );
-- create table crm_email_logs (
--   id uuid primary key default gen_random_uuid(),
--   customer_id uuid references crm_customers(id) on delete cascade,
--   to_email text,
--   subject text,
--   body text,
--   referral_topic text,
--   sent_at timestamptz not null,
--   agent_name text,
--   status text check (status in ('sent','simulated')),
--   created_at timestamptz default now()
-- );
*/

export const REFERRAL_TOPICS = ["סליקה", "חשבוניות"];

export const REFERRAL_STATUSES = {
  open: { value: "open", label: "פתוח" },
  closed: { value: "closed", label: "הסתיים טיפול" },
};

export const CALL_TYPES = [
  { value: "incoming", label: "שיחה נכנסת" },
  { value: "outgoing", label: "שיחה יוצאת" },
  { value: "chat", label: "צ'אט" },
];

function makeId(prefix) {
  if (isCrmCloudEnabled() && typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function daysAgo(n, hours = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hours, 30, 0, 0);
  return d.toISOString();
}

function daysBetween(isoStart, isoEnd) {
  const start = new Date(isoStart).getTime();
  const end = new Date(isoEnd).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return Infinity;
  return (end - start) / (1000 * 60 * 60 * 24);
}

function createSeedReferrals(customers) {
  const byId = Object.fromEntries(customers.map((c) => [c.id, c]));
  const c1 = byId.crm_c_01;
  const c2 = byId.crm_c_02;
  const c4 = byId.crm_c_04;
  if (!c1 || !c2 || !c4) return [];

  const openAt = daysAgo(2, 11);
  const closedRecent = daysAgo(3, 14);
  const closedOld = daysAgo(12, 10);

  const deptQueueAt = daysAgo(1, 8);

  return [
    {
      id: "crm_ref_01",
      customer_id: c1.id,
      referral_topic: "סליקה",
      description: "בירור עמלות סליקה — ממתין לתשובת חברת האשראי",
      agent_name: "נציג 02",
      original_agent_name: "נציג 02",
      assigned_to_type: "agent",
      assigned_agent_name: "נציג 02",
      assigned_department_id: null,
      status: "open",
      opened_at: openAt,
      closed_at: null,
      last_activity_at: openAt,
      reopened_at: null,
      created_at: openAt,
    },
    {
      id: "crm_ref_02",
      customer_id: c2.id,
      referral_topic: "חשבוניות",
      description: "הפרשה בחשבונית ינואר — נסגר לאחר שליחת הסבר",
      agent_name: "נציג 03",
      original_agent_name: "נציג 03",
      assigned_to_type: "agent",
      assigned_agent_name: "נציג 03",
      assigned_department_id: null,
      status: "closed",
      opened_at: daysAgo(8, 9),
      closed_at: closedRecent,
      last_activity_at: closedRecent,
      reopened_at: null,
      created_at: daysAgo(8, 9),
    },
    {
      id: "crm_ref_03",
      customer_id: c4.id,
      referral_topic: "חשבוניות",
      description: "תלונה על חיוב כפול — טופל ונסגר",
      agent_name: "נציג 05",
      original_agent_name: "נציג 05",
      assigned_to_type: "agent",
      assigned_agent_name: "נציג 05",
      assigned_department_id: null,
      status: "closed",
      opened_at: daysAgo(20, 11),
      closed_at: closedOld,
      last_activity_at: closedOld,
      reopened_at: null,
      created_at: daysAgo(20, 11),
    },
    {
      id: "crm_ref_04",
      customer_id: c1.id,
      referral_topic: "חשבוניות",
      description: "בקשת זיכוי — בתור מחלקת שירות",
      agent_name: "נציג 01",
      original_agent_name: "נציג 01",
      assigned_to_type: "department",
      assigned_agent_name: null,
      assigned_department_id: "service",
      status: "open",
      opened_at: deptQueueAt,
      closed_at: null,
      last_activity_at: deptQueueAt,
      reopened_at: null,
      created_at: deptQueueAt,
    },
  ];
}

function buildReferralAssignment({
  creatorName,
  assigned_to_type = "agent",
  assigned_agent_name,
  assigned_department_id,
}) {
  const creator = String(creatorName || "").trim();
  const type = assigned_to_type === "department" ? "department" : "agent";
  if (type === "department") {
    return {
      original_agent_name: creator,
      assigned_to_type: "department",
      assigned_agent_name: null,
      assigned_department_id: String(assigned_department_id || "service").trim(),
      agent_name: creator,
    };
  }
  const agent = String(assigned_agent_name || creator).trim();
  return {
    original_agent_name: creator,
    assigned_to_type: "agent",
    assigned_agent_name: agent,
    assigned_department_id: null,
    agent_name: creator,
  };
}

export function migrateReferral(ref) {
  if (!ref) return ref;
  if (ref.original_agent_name && ref.assigned_to_type) return ref;
  const creator = ref.original_agent_name || ref.agent_name || "";
  return {
    ...ref,
    ...buildReferralAssignment({
      creatorName: creator,
      assigned_to_type: "agent",
      assigned_agent_name: creator,
    }),
  };
}

function migrateReferralsInStore(store) {
  let changed = false;
  store.referrals = (store.referrals || []).map((ref) => {
    const migrated = migrateReferral(ref);
    if (migrated !== ref) changed = true;
    return migrated;
  });
  return changed;
}

function createSeedStore() {
  const c1 = { id: "crm_c_01", name: "דנה כהן", phone: "050-1234567", email: "dana@example.co.il", company: "כהן לוגיסטיקה", notes: "לקוחה ותיקה, מעדיפה התקשרות בבוקר", created_at: daysAgo(30), updated_at: daysAgo(2) };
  const c2 = { id: "crm_c_02", name: "יוסי לוי", phone: "052-9876543", email: "yossi.levi@gmail.com", company: "", notes: "ביקש הצעת מחיר לחבילת פרימיום", created_at: daysAgo(14), updated_at: daysAgo(1) };
  const c3 = { id: "crm_c_03", name: "מיכל אברהם", phone: "054-5551234", email: "michal@startup.io", company: "סטארטאפ.io", notes: "", created_at: daysAgo(7), updated_at: daysAgo(7) };
  const c4 = { id: "crm_c_04", name: "אלי רוזן", phone: "03-1234567", email: "eli@rozen.co.il", company: "רוזן בע\"מ", notes: "איש קשר: מזכירה שרה", created_at: daysAgo(5), updated_at: daysAgo(0) };
  const c5 = { id: "crm_c_05", name: "נועה שמש", phone: "058-7778899", email: "noa@demo.local", company: null, notes: "ליד חדש מהאתר", created_at: daysAgo(1), updated_at: daysAgo(1) };

  return {
    customers: [c1, c2, c3, c4, c5],
    callLogs: [
      { id: "crm_call_01", customer_id: c1.id, occurred_at: daysAgo(2, 9), call_type: "incoming", summary: "בירור סטטוס משלוח — הועבר ללוגיסטיקה", agent_name: "נציג 02", duration_minutes: 8, referral_topic: "סליקה", created_at: daysAgo(2, 9) },
      { id: "crm_call_02", customer_id: c1.id, occurred_at: daysAgo(5, 14), call_type: "outgoing", summary: "עדכון על איחור — הלקוחה מבינה", agent_name: "נציג 01", duration_minutes: 5, referral_topic: null, created_at: daysAgo(5, 14) },
      { id: "crm_call_03", customer_id: c2.id, occurred_at: daysAgo(1, 11), call_type: "chat", summary: "שאלה על תשלום — נשלח קישור לפורטל", agent_name: "נציג 03", duration_minutes: null, referral_topic: "חשבוניות", created_at: daysAgo(1, 11) },
      { id: "crm_call_04", customer_id: c2.id, occurred_at: daysAgo(3, 16), call_type: "outgoing", summary: "הצעת מחיר — ממתין לאישור מנהל", agent_name: "נציג 04", duration_minutes: 12, referral_topic: "סליקה", created_at: daysAgo(3, 16) },
      { id: "crm_call_05", customer_id: c3.id, occurred_at: daysAgo(0, 10), call_type: "incoming", summary: "הדגמת מוצר — נקבעה פגישת המשך", agent_name: "נציג 02", duration_minutes: 18, referral_topic: null, created_at: daysAgo(0, 10) },
      { id: "crm_call_06", customer_id: c4.id, occurred_at: daysAgo(0, 15), call_type: "incoming", summary: "תלונה על חיוב — נפתח טיקט 1042", agent_name: "נציג 05", duration_minutes: 9, referral_topic: "חשבוניות", created_at: daysAgo(0, 15) },
      { id: "crm_call_07", customer_id: c5.id, occurred_at: daysAgo(1, 9), call_type: "outgoing", summary: "שיחת היכרות ראשונה — מעוניינת בדמו", agent_name: "נציג 01", duration_minutes: 6, referral_topic: null, created_at: daysAgo(1, 9) },
    ],
    emailLogs: [
      {
        id: "crm_email_01",
        customer_id: c1.id,
        to_email: c1.email,
        subject: "עדכון סטטוס סליקה",
        body: "שלום דנה,\n\nבהמשך לשיחתנו — הסליקה אושרה והחשבונית תישלח תוך 48 שעות.\n\nבברכה",
        referral_topic: "סליקה",
        sent_at: daysAgo(1, 10),
        agent_name: "נציג 02",
        status: "simulated",
        created_at: daysAgo(1, 10),
      },
    ],
    referrals: null,
  };
}

function normalizeReferralsArray(store, seedIfMissing) {
  if (!Array.isArray(store.referrals)) {
    store.referrals = seedIfMissing ? createSeedReferrals(store.customers || []) : [];
  }
  return store;
}

function parseStoredCrm(raw) {
  const parsed = JSON.parse(raw);
  const hadReferralsField = Object.prototype.hasOwnProperty.call(parsed, "referrals");
  const store = {
    customers: parsed.customers || [],
    callLogs: parsed.callLogs || [],
    emailLogs: parsed.emailLogs || [],
    referrals: parsed.referrals,
  };
  normalizeReferralsArray(store, !hadReferralsField);
  return store;
}

function seedAndPersistStore() {
  const seed = createSeedStore();
  seed.referrals = createSeedReferrals(seed.customers);
  writeStore(seed);
  return { ...seed, referrals: seed.referrals };
}

function isStoreEmpty(store) {
  return (
    !store.customers?.length &&
    !store.callLogs?.length &&
    !store.emailLogs?.length &&
    !store.referrals?.length
  );
}

function readLocalStorageStore() {
  if (!crmEnabled || typeof window === "undefined") return emptyStore();
  try {
    let raw = localStorage.getItem(CRM_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(CRM_STORAGE_KEY_V2);
      if (raw) {
        const store = parseStoredCrm(raw);
        migrateReferralsInStore(store);
        return store;
      }
    }
    if (raw) {
      const store = parseStoredCrm(raw);
      if (migrateReferralsInStore(store)) {
        return store;
      }
      return store;
    }
  } catch {
    // ignore
  }
  return emptyStore();
}

function readStore() {
  if (!crmEnabled || typeof window === "undefined") {
    return emptyStore();
  }
  if (isCrmCloudEnabled()) {
    if (!cloudHydrated) return emptyStore();
    if (memoryStore) return memoryStore;
    return readLocalStorageStore();
  }
  const local = readLocalStorageStore();
  if (isStoreEmpty(local)) {
    return seedAndPersistStore();
  }
  if (memoryStore) return memoryStore;
  memoryStore = local;
  return memoryStore;
}

function cacheStoreToLocalStorage(store) {
  try {
    localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

function writeStore(store) {
  if (!crmEnabled || typeof window === "undefined") return;
  memoryStore = {
    customers: store.customers || [],
    callLogs: store.callLogs || [],
    emailLogs: store.emailLogs || [],
    referrals: store.referrals || [],
  };
  cacheStoreToLocalStorage(memoryStore);
  window.dispatchEvent(new CustomEvent(CRM_CHANGE_EVENT));
}

function cloudHasData(store) {
  return (
    store.customers?.length > 0 ||
    store.referrals?.length > 0 ||
    store.callLogs?.length > 0 ||
    store.emailLogs?.length > 0
  );
}

async function loadCrmStoreFromCloud() {
  if (!isCrmCloudEnabled()) {
    memoryStore = readLocalStorageStore();
    if (isStoreEmpty(memoryStore)) {
      memoryStore = seedAndPersistStore();
    }
    cloudHydrated = true;
    return memoryStore;
  }

  const local = readLocalStorageStore();

  try {
    const cloud = await loadCrmFromCloud();
    if (cloudHasData(cloud)) {
      memoryStore = cloud;
      cacheStoreToLocalStorage(memoryStore);
      cloudHydrated = true;
      return memoryStore;
    }

    if (cloudHasData(local)) {
      memoryStore = await migrateLocalStoreToCloud(local);
      cacheStoreToLocalStorage(memoryStore);
      cloudHydrated = true;
      return memoryStore;
    }
  } catch (err) {
    console.warn("[crmStore] cloud load failed", err);
    if (cloudHasData(local)) {
      memoryStore = local;
      cacheStoreToLocalStorage(memoryStore);
      cloudHydrated = true;
      return memoryStore;
    }
  }

  memoryStore = emptyStore();
  cacheStoreToLocalStorage(memoryStore);
  cloudHydrated = true;
  return memoryStore;
}

/** טוען CRM מ-Supabase (כולל מחלקות) */
export function hydrateCrmStore() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const { hydrateCrmDepartments } = await import("@/lib/crmDepartments");
      await Promise.all([loadCrmStoreFromCloud(), hydrateCrmDepartments()]);
    })().finally(() => {
      hydratePromise = null;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(CRM_CHANGE_EVENT));
      }
    });
  }
  return hydratePromise;
}

/** רענון מ-Supabase Realtime */
export function invalidateCrmStoreCache() {
  memoryStore = null;
  cloudHydrated = false;
  hydratePromise = null;
  invalidateCrmCloudCache();
  import("@/lib/crmDepartments").then(({ clearCrmDepartmentsMemory }) => {
    clearCrmDepartmentsMemory();
  });
  return hydrateCrmStore();
}

export function isCrmStoreHydrated() {
  if (!isCrmCloudEnabled()) return true;
  return cloudHydrated && isCrmDepartmentsHydrated();
}

export function crmDemoAvailable() {
  return crmEnabled;
}

export function listCustomers() {
  const { customers } = readStore();
  return [...customers].sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
}

export function searchCustomers(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return listCustomers();
  return listCustomers().filter((c) => {
    const hay = [c.name, c.phone, c.email, c.company, c.notes].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

/** חיפוש לקוח לדשבורד — רק שם, טלפון, אימייל; ללא רשימה מלאה כשאין שאילתה */
export function searchCustomersByContact(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  return listCustomers().filter((c) => {
    const hay = [c.name, c.phone, c.email].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export function getCustomerById(id) {
  return readStore().customers.find((c) => c.id === id) || null;
}

/** נרמול מספר ישראלי לחיפוש — מסיר מקפים/רווחים, ממיר +972/972 ל-0 */
export function normalizePhoneForLookup(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  return digits.replace(/\D/g, "");
}

/** חיפוש לקוח לפי טלפון (דמו בלבד) — null אם לא נמצא */
export function getCustomerByPhone(phone) {
  if (!crmEnabled) return null;
  const needle = normalizePhoneForLookup(phone);
  if (!needle || needle.length < 7) return null;
  const { customers } = readStore();
  return (
    customers.find((c) => {
      const hay = normalizePhoneForLookup(c.phone);
      return hay && hay === needle;
    }) || null
  );
}

export function createCustomer({ name, phone, email, company, notes }) {
  const store = readStore();
  const now = new Date().toISOString();
  const customer = {
    id: makeId("crm_c"),
    name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    email: String(email || "").trim(),
    company: company ? String(company).trim() : "",
    notes: notes ? String(notes).trim() : "",
    created_at: now,
    updated_at: now,
  };
  store.customers = [...store.customers, customer];
  writeStore(store);
  if (isCrmCloudEnabled()) {
    persistCustomer(customer).catch((err) => warnCloudPersist(err, "persistCustomer"));
  }
  return customer;
}

export function updateCustomer(id, patch) {
  const store = readStore();
  let updated = null;
  store.customers = store.customers.map((c) => {
    if (c.id !== id) return c;
    updated = {
      ...c,
      ...patch,
      name: patch.name !== undefined ? String(patch.name).trim() : c.name,
      phone: patch.phone !== undefined ? String(patch.phone).trim() : c.phone,
      email: patch.email !== undefined ? String(patch.email).trim() : c.email,
      company: patch.company !== undefined ? (patch.company ? String(patch.company).trim() : "") : c.company,
      notes: patch.notes !== undefined ? String(patch.notes).trim() : c.notes,
      updated_at: new Date().toISOString(),
    };
    return updated;
  });
  writeStore(store);
  if (isCrmCloudEnabled() && updated) {
    persistCustomer(updated).catch((err) => warnCloudPersist(err, "persistCustomer"));
  }
  return updated;
}

export function deleteCustomer(id) {
  const store = readStore();
  store.customers = store.customers.filter((c) => c.id !== id);
  store.callLogs = store.callLogs.filter((log) => log.customer_id !== id);
  store.emailLogs = (store.emailLogs || []).filter((log) => log.customer_id !== id);
  store.referrals = (store.referrals || []).filter((ref) => ref.customer_id !== id);
  writeStore(store);
  if (isCrmCloudEnabled()) {
    deleteCustomerFromCloud(id).catch((err) => warnCloudPersist(err, "deleteCustomer"));
  }
}

export function listCallLogsForCustomer(customerId) {
  const { callLogs } = readStore();
  return callLogs
    .filter((log) => log.customer_id === customerId)
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
}

export function listRecentCallLogs(limit = 10) {
  const { callLogs, customers } = readStore();
  const byId = Object.fromEntries(customers.map((c) => [c.id, c]));
  return [...callLogs]
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    .slice(0, limit)
    .map((log) => ({ ...log, customer: byId[log.customer_id] || null }));
}

function normalizeReferralTopic(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return REFERRAL_TOPICS.includes(trimmed) ? trimmed : null;
}

export function createCallLog({
  customer_id,
  occurred_at,
  call_type,
  summary,
  agent_name,
  duration_minutes,
  referral_topic,
}) {
  const store = readStore();
  const now = new Date().toISOString();
  const log = {
    id: makeId("crm_call"),
    customer_id,
    occurred_at: occurred_at || now,
    call_type: call_type || "incoming",
    summary: String(summary || "").trim(),
    agent_name: String(agent_name || "").trim(),
    duration_minutes:
      duration_minutes === "" || duration_minutes == null || Number.isNaN(Number(duration_minutes))
        ? null
        : Number(duration_minutes),
    referral_topic: normalizeReferralTopic(referral_topic),
    created_at: now,
  };
  store.callLogs = [...store.callLogs, log];
  writeStore(store);
  if (isCrmCloudEnabled()) {
    persistCallLog(log).catch((err) => warnCloudPersist(err, "persistCallLog"));
  }
  if (log.call_type === "incoming") {
    tryAutoReopenReferrals(customer_id, {
      referralTopic: log.referral_topic,
      activityAt: log.occurred_at,
    });
  }
  return log;
}

export function deleteCallLog(id) {
  const store = readStore();
  store.callLogs = store.callLogs.filter((log) => log.id !== id);
  writeStore(store);
  if (isCrmCloudEnabled()) {
    deleteCallLogFromCloud(id).catch((err) => warnCloudPersist(err, "deleteCallLog"));
  }
}

export function listEmailLogsForCustomer(customerId) {
  const { emailLogs } = readStore();
  return (emailLogs || [])
    .filter((log) => log.customer_id === customerId)
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
}

export function createEmailLog({
  customer_id,
  to_email,
  subject,
  body,
  referral_topic,
  agent_name,
  sent_at,
  status = "simulated",
}) {
  const store = readStore();
  const now = new Date().toISOString();
  const log = {
    id: makeId("crm_email"),
    customer_id,
    to_email: String(to_email || "").trim(),
    subject: String(subject || "").trim(),
    body: String(body || "").trim(),
    referral_topic: normalizeReferralTopic(referral_topic),
    sent_at: sent_at || now,
    agent_name: String(agent_name || "").trim(),
    status: status === "sent" ? "sent" : "simulated",
    created_at: now,
  };
  store.emailLogs = [...(store.emailLogs || []), log];
  writeStore(store);
  if (isCrmCloudEnabled()) {
    persistEmailLog(log).catch((err) => warnCloudPersist(err, "persistEmailLog"));
  }
  return log;
}

export function createInboundEmailLog({
  customer_id,
  from_email,
  subject,
  body,
  referral_topic,
  received_at,
}) {
  const store = readStore();
  const now = new Date().toISOString();
  const log = {
    id: makeId("crm_email"),
    customer_id,
    to_email: String(from_email || "").trim(),
    subject: String(subject || "").trim() || "מייל נכנס מהלקוח",
    body: String(body || "").trim(),
    referral_topic: normalizeReferralTopic(referral_topic),
    sent_at: received_at || now,
    agent_name: "",
    status: "received",
    direction: "inbound",
    created_at: now,
  };
  store.emailLogs = [...(store.emailLogs || []), log];
  writeStore(store);
  if (isCrmCloudEnabled()) {
    persistEmailLog(log).catch((err) => warnCloudPersist(err, "persistEmailLog"));
  }
  tryAutoReopenReferrals(customer_id, {
    referralTopic: log.referral_topic,
    activityAt: log.sent_at,
  });
  return log;
}

export function deleteEmailLog(id) {
  const store = readStore();
  store.emailLogs = (store.emailLogs || []).filter((log) => log.id !== id);
  writeStore(store);
  if (isCrmCloudEnabled()) {
    deleteEmailLogFromCloud(id).catch((err) => warnCloudPersist(err, "deleteEmailLog"));
  }
}

export function getEmailStatusLabel(status) {
  if (status === "sent") return "נשלח";
  if (status === "received") return "התקבל מהלקוח";
  return "דמו (מדומה)";
}

export function getReferralStatusLabel(status) {
  return REFERRAL_STATUSES[status]?.label || status;
}

export function canReopenReferral(referral, at = new Date().toISOString()) {
  if (!referral || referral.status !== "closed" || !referral.closed_at) return false;
  return daysBetween(referral.closed_at, at) <= REFERRAL_REOPEN_DAYS;
}

export function listReferralsForCustomer(customerId) {
  const { referrals } = readStore();
  return (referrals || [])
    .map(migrateReferral)
    .filter((ref) => ref.customer_id === customerId)
    .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));
}

export { getDepartmentsForAgent, isAgentInDepartment } from "@/lib/crmDepartments";
export { CRM_DEPARTMENTS, getDepartmentName } from "@/lib/crmDepartments";

function enrichReferralsWithCustomer(referrals, customers) {
  const byId = Object.fromEntries(customers.map((c) => [c.id, c]));
  return referrals.map((ref) => ({ ...ref, customer: byId[ref.customer_id] || null }));
}

export function getReferralAssignmentLabel(ref) {
  if (!ref) return "";
  const migrated = migrateReferral(ref);
  if (migrated.assigned_to_type === "department" && migrated.assigned_department_id) {
    return `מחלקה: ${getDepartmentName(migrated.assigned_department_id)}`;
  }
  if (migrated.assigned_agent_name) {
    return `נציג: ${migrated.assigned_agent_name}`;
  }
  return migrated.original_agent_name ? `נציג: ${migrated.original_agent_name}` : "";
}

function isTodayLocal(isoString) {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** פניות שנסגרו היום על ידי הנציג (שויך אליו או יוצר בזמן הסגירה) */
export function countReferralsHandledTodayByAgent(agentName) {
  const { referrals } = readStore();
  const name = String(agentName || "").trim();
  if (!name) return 0;
  return (referrals || [])
    .map(migrateReferral)
    .filter((ref) => {
      if (ref.status !== "closed" || !ref.closed_at || !isTodayLocal(ref.closed_at)) return false;
      const handler = ref.assigned_agent_name || ref.agent_name || ref.original_agent_name;
      return handler === name;
    }).length;
}

export function listOpenReferralsForAgent(agentName) {
  const { referrals, customers } = readStore();
  const name = String(agentName || "").trim();
  if (!name) return [];
  const open = (referrals || [])
    .map(migrateReferral)
    .filter(
      (ref) =>
        ref.status === "open" &&
        ref.assigned_to_type === "agent" &&
        ref.assigned_agent_name === name
    )
    .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));
  return enrichReferralsWithCustomer(open, customers);
}

export function listOpenReferralsForDepartment(departmentId) {
  const { referrals, customers } = readStore();
  const deptId = String(departmentId || "").trim();
  if (!deptId) return [];
  const open = (referrals || [])
    .map(migrateReferral)
    .filter(
      (ref) =>
        ref.status === "open" &&
        ref.assigned_to_type === "department" &&
        ref.assigned_department_id === deptId
    )
    .sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at));
  return enrichReferralsWithCustomer(open, customers);
}

export function listDepartmentQueuesForAgent(agentName) {
  const departments = getDepartmentsForAgent(agentName);
  return departments.map((dept) => ({
    department: dept,
    referrals: listOpenReferralsForDepartment(dept.id),
  }));
}

export function createReferral({
  customer_id,
  referral_topic,
  description,
  agent_name,
  status = "open",
  assigned_to_type = "agent",
  assigned_agent_name,
  assigned_department_id,
}) {
  const topic = normalizeReferralTopic(referral_topic);
  if (!topic) {
    throw new Error("נושא הפניה הוא שדה חובה");
  }
  if (assigned_to_type === "department" && !assigned_department_id) {
    throw new Error("יש לבחור מחלקה לשיוך");
  }
  if (assigned_to_type === "agent" && !String(assigned_agent_name || agent_name || "").trim()) {
    throw new Error("יש לבחור נציג לשיוך");
  }
  const store = readStore();
  const now = new Date().toISOString();
  const isClosed = status === "closed";
  const assignment = buildReferralAssignment({
    creatorName: agent_name,
    assigned_to_type,
    assigned_agent_name,
    assigned_department_id,
  });
  const referral = {
    id: makeId("crm_ref"),
    customer_id,
    referral_topic: topic,
    description: String(description || "").trim(),
    ...assignment,
    status: isClosed ? "closed" : "open",
    opened_at: now,
    closed_at: isClosed ? now : null,
    last_activity_at: now,
    reopened_at: null,
    created_at: now,
  };
  store.referrals = [...(store.referrals || []), referral];
  writeStore(store);
  if (isCrmCloudEnabled()) {
    persistReferral(referral).catch((err) => warnCloudPersist(err, "persistReferral"));
    logReferralEvent(referral.id, "created", {}, referral).catch(() => {});
  }
  return referral;
}

export function assignReferral(id, { assigned_to_type, assigned_agent_name, assigned_department_id }) {
  const store = readStore();
  const target = (store.referrals || []).find((ref) => ref.id === id);
  if (!target) return null;
  const now = new Date().toISOString();
  const assignment = buildReferralAssignment({
    creatorName: target.original_agent_name || target.agent_name,
    assigned_to_type,
    assigned_agent_name,
    assigned_department_id,
  });
  let updated = null;
  store.referrals = store.referrals.map((ref) => {
    if (ref.id !== id) return ref;
    updated = {
      ...ref,
      ...assignment,
      last_activity_at: now,
    };
    return updated;
  });
  writeStore(store);
  if (isCrmCloudEnabled() && updated) {
    persistReferral(updated).catch((err) => warnCloudPersist(err, "persistReferral"));
    logReferralEvent(id, "assigned", target, updated).catch(() => {});
  }
  return updated;
}

export function claimDepartmentReferral(id, agentName) {
  const name = String(agentName || "").trim();
  if (!name) return null;
  const store = readStore();
  const target = (store.referrals || []).find((ref) => ref.id === id);
  if (!target || target.status !== "open" || target.assigned_to_type !== "department") {
    return null;
  }
  const updated = assignReferral(id, {
    assigned_to_type: "agent",
    assigned_agent_name: name,
    assigned_department_id: null,
  });
  if (isCrmCloudEnabled() && updated) {
    logReferralEvent(id, "claimed", target, updated).catch(() => {});
  }
  return updated;
}

export function closeReferral(id) {
  const store = readStore();
  const now = new Date().toISOString();
  let updated = null;
  store.referrals = (store.referrals || []).map((ref) => {
    if (ref.id !== id) return ref;
    updated = {
      ...ref,
      status: "closed",
      closed_at: now,
      last_activity_at: now,
    };
    return updated;
  });
  writeStore(store);
  if (isCrmCloudEnabled() && updated) {
    persistReferral(updated).catch((err) => warnCloudPersist(err, "persistReferral"));
    logReferralEvent(id, "closed", { status: "open" }, updated).catch(() => {});
  }
  return updated;
}

function reopenReferralRecord(ref, activityAt) {
  const now = activityAt || new Date().toISOString();
  const base = migrateReferral(ref);
  const original = base.original_agent_name || base.agent_name || "";
  return {
    ...base,
    status: "open",
    reopened_at: now,
    last_activity_at: now,
    closed_at: null,
    assigned_to_type: "agent",
    assigned_agent_name: original,
    assigned_department_id: null,
  };
}

export function reopenReferralFromCustomerResponse(id) {
  const store = readStore();
  const target = (store.referrals || []).find((ref) => ref.id === id);
  if (!target) return null;
  if (!canReopenReferral(target)) return null;
  let updated = null;
  store.referrals = store.referrals.map((ref) => {
    if (ref.id !== id) return ref;
    updated = reopenReferralRecord(ref);
    return updated;
  });
  writeStore(store);
  if (isCrmCloudEnabled() && updated) {
    persistReferral(updated).catch((err) => warnCloudPersist(err, "persistReferral"));
    logReferralEvent(id, "reopened", target, updated).catch(() => {});
  }
  return updated;
}

export function tryAutoReopenReferrals(customerId, { referralTopic = null, activityAt } = {}) {
  const store = readStore();
  const at = activityAt || new Date().toISOString();
  const closedCandidates = (store.referrals || [])
    .filter(
      (ref) =>
        ref.customer_id === customerId &&
        ref.status === "closed" &&
        ref.closed_at &&
        canReopenReferral(ref, at)
    )
    .filter((ref) => !referralTopic || ref.referral_topic === referralTopic)
    .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at));

  if (closedCandidates.length === 0) return [];

  const toReopen = closedCandidates[0];
  const reopened = [];
  store.referrals = store.referrals.map((ref) => {
    if (ref.id !== toReopen.id) return ref;
    const updated = reopenReferralRecord(ref, at);
    reopened.push(updated);
    return updated;
  });
  writeStore(store);
  if (isCrmCloudEnabled()) {
    for (const ref of reopened) {
      persistReferral(ref).catch((err) => warnCloudPersist(err, "persistReferral"));
      logReferralEvent(ref.id, "reopened", toReopen, ref).catch(() => {});
    }
  }
  return reopened;
}

export function getCallTypeLabel(value) {
  return CALL_TYPES.find((t) => t.value === value)?.label || value;
}

export function subscribeCrmStore(callback) {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(CRM_CHANGE_EVENT, handler);
  return () => window.removeEventListener(CRM_CHANGE_EVENT, handler);
}
