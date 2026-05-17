import { supabaseConfigured } from "./supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function assertSupabaseConfigured() {
  if (!supabaseConfigured) {
    throw new Error("Supabase לא מוגדר — הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY");
  }
}

function buildUrl(tableName, filters = {}, params = {}) {
  assertSupabaseConfigured();
  const url = new URL(`${supabaseUrl}/rest/v1/${tableName}`);
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, `eq.${value}`);
    }
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function requestHeaders(extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: requestHeaders(options.headers),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function createEntity(tableName) {
  return {
    async filter(filters = {}) {
      return (await requestJson(buildUrl(tableName, filters, { select: "*" }))) ?? [];
    },

    async list(order = "-created_at", limit = 100) {
      const desc = order.startsWith("-");
      const col = desc ? order.slice(1) : order;
      return (await requestJson(buildUrl(tableName, {}, {
        select: "*",
        order: `${col}.${desc ? "desc" : "asc"}`,
        limit,
      }))) ?? [];
    },

    async create(row) {
      const data = await requestJson(buildUrl(tableName, {}, { select: "*" }), {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      return data?.[0] ?? data;
    },

    async bulkCreate(rows) {
      if (!rows?.length) return [];
      return (await requestJson(buildUrl(tableName, {}, { select: "*" }), {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rows),
      })) ?? [];
    },

    async update(id, row) {
      const data = await requestJson(buildUrl(tableName, { id }, { select: "*" }), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      return data?.[0] ?? data;
    },

    async delete(id) {
      await requestJson(buildUrl(tableName, { id }), {
        method: "DELETE",
      });
    },
  };
}

const ENTITY_TABLES = {
  BreakRegistration: "break_registrations",
  BreakSettings: "break_settings",
  ShiftRegistration: "shift_registrations",
  ShiftUnavailability: "shift_unavailabilities",
  VacationRequest: "vacation_requests",
  ConstraintConfirmation: "constraint_confirmations",
};

export function createSupabaseDataClient() {
  const entities = {};
  for (const [name, tableName] of Object.entries(ENTITY_TABLES)) {
    entities[name] = createEntity(tableName);
  }
  return {
    entities,
    auth: {
      me: async () => null,
      logout: () => {},
      redirectToLogin: () => {},
    },
  };
}

export function useSupabaseBackend() {
  return supabaseConfigured;
}
