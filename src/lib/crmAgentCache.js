import { supabase } from "@/api/supabase";

let byId = new Map();
let byName = new Map();
let loadPromise = null;

export function clearAgentCache() {
  byId = new Map();
  byName = new Map();
  loadPromise = null;
}

export async function loadAgentCache() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("agents")
      .select("id, display_name")
      .eq("active", true)
      .is("deleted_at", null);
    if (error) throw error;
    byId = new Map();
    byName = new Map();
    for (const row of data || []) {
      const name = String(row.display_name || "").trim();
      if (!name) continue;
      byId.set(row.id, name);
      byName.set(name, row.id);
    }
  })();
  return loadPromise;
}

export function getAgentIdByName(name) {
  const key = String(name || "").trim();
  if (!key) return null;
  return byName.get(key) || null;
}

export function getAgentNameById(id) {
  if (!id) return "";
  return byId.get(id) || "";
}
