const DEMO_STORE_KEY = "smart-break-shift-demo-store-v1";

export const demoModeEnabled = import.meta.env.VITE_DEMO_MODE === "true";

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
  };
}

function readStore() {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (raw) return JSON.parse(raw);
  const seed = createSeedStore();
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(seed));
  return seed;
}

function writeStore(store) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
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

export function createDemoDataClient() {
  const entities = {};
  for (const entityName of Object.keys(ENTITY_KEYS)) {
    entities[entityName] = createEntity(entityName);
  }

  return {
    entities,
    auth: {
      me: async () => ({ id: "demo-admin", role: "admin", full_name: "מנהל דמו" }),
      logout: () => {},
      redirectToLogin: () => {},
    },
  };
}
