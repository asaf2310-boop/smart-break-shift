import { supabase, supabaseConfigured } from "./supabase";

function table(name) {
  if (!supabase) throw new Error("Supabase לא מוגדר — הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY");
  return supabase.from(name);
}

function applyFilters(query, filters = {}) {
  let q = query;
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      q = q.eq(key, value);
    }
  }
  return q;
}

function createEntity(tableName) {
  return {
    async filter(filters = {}) {
      const { data, error } = await applyFilters(table(tableName).select("*"), filters);
      if (error) throw error;
      return data ?? [];
    },

    async list(order = "-created_at", limit = 100) {
      const desc = order.startsWith("-");
      const col = desc ? order.slice(1) : order;
      let q = table(tableName).select("*").order(col, { ascending: !desc }).limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },

    async create(row) {
      const { data, error } = await table(tableName).insert(row).select().single();
      if (error) throw error;
      return data;
    },

    async bulkCreate(rows) {
      if (!rows?.length) return [];
      const { data, error } = await table(tableName).insert(rows).select();
      if (error) throw error;
      return data ?? [];
    },

    async update(id, row) {
      const { data, error } = await table(tableName).update(row).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await table(tableName).delete().eq("id", id);
      if (error) throw error;
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
