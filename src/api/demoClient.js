<<<<<<< HEAD
=======
import { validateBreakRegistration } from "@/lib/breakCapacity";
>>>>>>> 842dd9e (Initial commit)
import {
  createDemoAppUser,
  listAllDemoAppUsers,
  softDeleteDemoAppUser,
  updateDemoAppUser,
} from "@/lib/appUsersStore";
<<<<<<< HEAD
import { demoModeEnabled } from "./demoMode";

export { demoModeEnabled } from "./demoMode";
export { remoteSupportEnabled } from "./remoteSupportMode";
export { customerChatEnabled } from "./customerChatMode";

export const DEMO_STORE_KEY = "smart-break-shift-demo-store-v1";

=======

export const DEMO_STORE_KEY = "smart-break-shift-demo-store-v1";

/** Build-time only (Vercel `VITE_*` at deploy). Off unless value is exactly "true". */
export const demoModeEnabled = import.meta.env.VITE_DEMO_MODE === "true";

>>>>>>> 842dd9e (Initial commit)
/**
 * בדמו: שליחת מייל אמיתית דרך /api/send-email (Resend).
 * ברירת מחדל: מופעלת כש-demoModeEnabled; כיבוי מפורש ב-build: VITE_DEMO_SEND_REAL_EMAIL=false
 */
export const demoSendRealEmailEnabled =
  demoModeEnabled && import.meta.env.VITE_DEMO_SEND_REAL_EMAIL !== "false";

/** לכפתור «בדיקת מייל» — רק מ-import.meta.env (לא מהשרת) */
export function getDemoEmailBuildDiagnostic() {
  const raw = import.meta.env.VITE_DEMO_SEND_REAL_EMAIL;
  const viteSendRaw =
    raw === undefined || raw === "" ? "(לא הוגדר — ברירת מחדל: מייל אמיתי)" : String(raw);
  return {
    demoModeEnabled,
    demoSendRealEmailEnabled,
    viteSendRaw,
    attemptsRealEmailInDemo:
      demoModeEnabled && import.meta.env.VITE_DEMO_SEND_REAL_EMAIL !== "false",
  };
}

const AGENTS = [
  "נציג 01",
  "נציג 02",
  "נציג 03",
  "נציג 04",
  "נציג 05",
  "נציג 06",
  "נציג 07",
  "נציג 08",
  "נציג 09",
  "נציג 10",
];

const ENTITY_KEYS = {
  BreakRegistration: "breakRegistrations",
  BreakSettings: "breakSettings",
  ShiftRegistration: "shiftRegistrations",
  ShiftUnavailability: "shiftUnavailabilities",
  VacationRequest: "vacationRequests",
  ConstraintConfirmation: "constraintConfirmations",
  ChatMessage: "chatMessages",
  ChatPresence: "chatPresence",
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStart(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createSeedStore() {
  const today = new Date();
  const todayStr = formatDate(today);
  const weekStart = getWeekStart(today);
  const nextWeekStart = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const nextWeekDays = Array.from({ length: 5 }, (_, i) => addDays(nextWeekStart, i));

  const shiftRegistrations = weekDays.flatMap((date, dayIndex) => {
    const dateStr = formatDate(date);
    const morning = AGENTS.slice(dayIndex % 2, dayIndex % 2 + 4);
    const evening = AGENTS.slice(4, 8);
    return [
      ...morning.map((agent) => ({ id: makeId("shift"), agent_name: agent, date: dateStr, shift_type: "morning" })),
      ...evening.map((agent) => ({ id: makeId("shift"), agent_name: agent, date: dateStr, shift_type: "evening" })),
    ];
  });

  return {
    breakRegistrations: [
      { id: makeId("break"), agent_name: "נציג 02", date: todayStr, break_type: "short", time_slot: "10:10-10:20" },
      { id: makeId("break"), agent_name: "נציג 04", date: todayStr, break_type: "short", time_slot: "10:30-10:40" },
      { id: makeId("break"), agent_name: "נציג 06", date: todayStr, break_type: "lunch", time_slot: "13:00-13:30" },
    ],
    breakSettings: [
      {
        id: makeId("settings"),
        date: todayStr,
        short_max_per_slot: 2,
        lunch_max_per_slot: 1,
        show_shortage_notice: true,
      },
    ],
    shiftRegistrations,
    shiftUnavailabilities: [
      { id: makeId("unavailable"), agent_name: "נציג 03", date: formatDate(nextWeekDays[1]), shift_type: "morning", reason: "unavailable", note: "דמו" },
      { id: makeId("unavailable"), agent_name: "נציג 05", date: formatDate(nextWeekDays[3]), shift_type: "evening", reason: "unavailable", note: "דמו" },
    ],
    vacationRequests: [
      { id: makeId("vacation"), agent_name: "נציג 07", date: formatDate(nextWeekDays[2]), status: "pending", note: "בקשת דמו" },
      { id: makeId("vacation"), agent_name: "נציג 08", date: formatDate(nextWeekDays[4]), status: "approved", note: "מאושר בדמו" },
    ],
    constraintConfirmations: [
      { id: makeId("confirm"), agent_name: "נציג 01", week_start: formatDate(nextWeekStart), confirmed_at: new Date().toISOString() },
      { id: makeId("confirm"), agent_name: "נציג 02", week_start: formatDate(nextWeekStart), confirmed_at: new Date().toISOString() },
    ],
    chatMessages: [
      {
        id: makeId("chat"),
        sender_name: "נציג 02",
        recipient_name: null,
        body: "בוקר טוב לכולם",
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: makeId("chat"),
        sender_name: "נציג 04",
        recipient_name: "נציג 02",
        body: "אתה מכסה אותי ב-14:00?",
        created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      },
    ],
    chatPresence: AGENTS.map((agent, index) => {
      const status = index % 3 === 0 ? "available" : index % 3 === 1 ? "break" : "offline";
      const seen =
        status === "offline"
          ? "1970-01-01T00:00:00.000Z"
          : new Date(Date.now() - index * 1000 * 45).toISOString();
      return {
        id: makeId("presence"),
        agent_name: agent,
        status,
        last_seen_at: seen,
        updated_at: seen,
      };
    }),
  };
}

function readStore() {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (raw) {
    const store = JSON.parse(raw);
    const seed = createSeedStore();
    let changed = false;
    if (!store.chatMessages?.length) {
      store.chatMessages = seed.chatMessages;
      changed = true;
    }
    if (!store.chatPresence?.length) {
      store.chatPresence = seed.chatPresence;
      changed = true;
    } else if (store.chatPresence.some((row) => !row.status)) {
      store.chatPresence = store.chatPresence.map((row, index) => {
        if (row.status) return row;
        const status = index % 3 === 0 ? "available" : index % 3 === 1 ? "break" : "offline";
        return { ...row, status };
      });
      changed = true;
    }
    if (changed) writeStore(store);
    return store;
  }
  const seed = createSeedStore();
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(seed));
  return seed;
}

function writeStore(store) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("demo-store-changed"));
}

function matchesFilters(row, filters) {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

function createEntity(entityName) {
  const storeKey = ENTITY_KEYS[entityName];

  return {
    async filter(filters = {}) {
      const rows = readStore()[storeKey] || [];
      return rows.filter((row) => matchesFilters(row, filters));
    },

    async list(order = "-created_at", limit = 100) {
      const rows = [...(readStore()[storeKey] || [])];
      const desc = order.startsWith("-");
      const key = desc ? order.slice(1) : order;
      rows.sort((a, b) => String(a[key] || "").localeCompare(String(b[key] || "")));
      if (desc) rows.reverse();
      return rows.slice(0, limit);
    },

    async create(row) {
      const store = readStore();

      if (entityName === "BreakRegistration") {
<<<<<<< HEAD
        const { validateBreakRegistration } = await import("@/lib/breakCapacity");
=======
>>>>>>> 842dd9e (Initial commit)
        const registrations = (store.breakRegistrations || []).filter((r) => r.date === row.date);
        const settings = (store.breakSettings || []).find((s) => s.date === row.date) || null;
        validateBreakRegistration({
          registrations,
          settings,
          agentName: row.agent_name,
          breakType: row.break_type,
          timeSlot: row.time_slot,
<<<<<<< HEAD
          date: row.date,
=======
>>>>>>> 842dd9e (Initial commit)
        });
      }

      const saved = { id: row.id || makeId(storeKey), ...row };
      store[storeKey] = [...(store[storeKey] || []), saved];
      writeStore(store);
      return saved;
    },

    async bulkCreate(rows) {
      const store = readStore();
      const saved = rows.map((row) => ({ id: row.id || makeId(storeKey), ...row }));
      store[storeKey] = [...(store[storeKey] || []), ...saved];
      writeStore(store);
      return saved;
    },

    async update(id, row) {
      const store = readStore();
<<<<<<< HEAD

=======
>>>>>>> 842dd9e (Initial commit)
      let updated = null;
      store[storeKey] = (store[storeKey] || []).map((existing) => {
        if (existing.id !== id) return existing;
        updated = { ...existing, ...row };
        return updated;
      });
      writeStore(store);
      return updated;
    },

    async delete(id) {
      const store = readStore();
      store[storeKey] = (store[storeKey] || []).filter((row) => row.id !== id);
      writeStore(store);
    },
  };
}

const demoAgentEntity = {
  async filter() {
    return listAllDemoAppUsers().map((u) => ({
      id: u.id,
      email: u.email,
      display_name: u.name,
      active: u.active !== false,
      blocked: u.blocked === true,
      needs_password_setup: u.needsPasswordSetup !== false && !u.password,
<<<<<<< HEAD
      password_plain: u.password || null,
=======
>>>>>>> 842dd9e (Initial commit)
    }));
  },
  async list() {
    return demoAgentEntity.filter();
  },
  async create(row) {
    const u = createDemoAppUser({ email: row.email, name: row.display_name });
    return {
      id: u.id,
      email: u.email,
      display_name: u.name,
      active: true,
      blocked: false,
      needs_password_setup: true,
<<<<<<< HEAD
      password_plain: null,
=======
>>>>>>> 842dd9e (Initial commit)
    };
  },
  async update(id, row) {
    const u = updateDemoAppUser(id, {
      email: row.email,
      name: row.display_name,
      active: row.active,
      blocked: row.blocked,
    });
    return {
      id: u.id,
      email: u.email,
      display_name: u.name,
      active: u.active !== false,
      blocked: u.blocked === true,
      needs_password_setup: u.needsPasswordSetup !== false && !u.password,
<<<<<<< HEAD
      password_plain: u.password || null,
=======
>>>>>>> 842dd9e (Initial commit)
    };
  },
  async delete(id) {
    softDeleteDemoAppUser(id);
  },
};

export function createDemoDataClient() {
  const entities = {};
  for (const entityName of Object.keys(ENTITY_KEYS)) {
    entities[entityName] = createEntity(entityName);
  }
  entities.Agent = demoAgentEntity;

  return {
    entities,
    auth: {
      me: async () => ({ id: "demo-admin", role: "admin", full_name: "מנהל דמו" }),
      logout: () => {},
      redirectToLogin: () => {},
    },
  };
}
