import { getAgentNamesList } from "@/constants/scheduling";
import { useSupabaseBackend } from "@/api/dataClient";

const LOCAL_CHAT_KEY = "smart-break-shift-local-chat-v1";

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createSeed() {
  return {
    chatMessages: [
      {
        id: makeId("chat"),
        sender_name: "נציג 02",
        recipient_name: null,
        body: "בוקר טוב לכולם — צ'אט פנימי פעיל",
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
    chatPresence: getAgentNamesList().map((agent, index) => {
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
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_KEY);
    if (raw) {
      const store = JSON.parse(raw);
      let changed = false;
      store.chatPresence = (store.chatPresence || []).map((row) => {
        if (row.status) return row;
        changed = true;
        return { ...row, status: "offline" };
      });
      if (changed) writeStore(store);
      return store;
    }
  } catch {
    // ignore
  }
  const seed = createSeed();
  localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(seed));
  return seed;
}

function writeStore(store) {
  localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("local-chat-changed"));
}

function matchesFilters(row, filters) {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

function createEntity(storeKey) {
  return {
    async filter(filters = {}) {
      const rows = readStore()[storeKey] || [];
      return rows.filter((row) => matchesFilters(row, filters));
    },

    async list(order = "-created_at", limit = 200) {
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

const localChatEntities = {
  ChatMessage: createEntity("chatMessages"),
  ChatPresence: createEntity("chatPresence"),
};

/**
 * צ'אט מקומי בדפדפן — ברירת מחדל פעיל (טסט/דמו).
 * Supabase לצ'אט רק אם VITE_CHAT_USE_LOCAL=false ויש חיבור Supabase.
 */
export function useLocalChatStore() {
  if (import.meta.env.VITE_CHAT_USE_LOCAL === "false" && useSupabaseBackend()) {
    return false;
  }
  return true;
}

export function getChatEntities() {
  if (useLocalChatStore()) return localChatEntities;
  return null;
}
