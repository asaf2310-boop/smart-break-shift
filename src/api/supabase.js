import { createClient } from "@supabase/supabase-js";

export function cleanEnvValue(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .find(Boolean) || "";
}

const url = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL);
const key = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabaseConfigured = Boolean(url && key);

export const supabase = supabaseConfigured
  ? createClient(url, key)
  : null;