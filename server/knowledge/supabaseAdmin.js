import { createClient } from "@supabase/supabase-js";

let adminClient = null;

export function getSupabaseUrl() {
  const raw = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  return raw.replace(/\/+$/, "");
}

export function getSupabaseServiceKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function isPgVectorConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) return null;
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
