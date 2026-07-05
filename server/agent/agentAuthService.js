import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, getSupabaseUrl } from "../knowledge/supabaseAdmin.js";
import { agentHasModule } from "./agentModuleAccess.js";

function getSupabaseAnonKey() {
  return String(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function mapAgentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name,
    authUserId: row.auth_user_id || null,
    needsPasswordSetup: row.needs_password_setup === true,
    phone: row.phone || "",
    active: row.active !== false && !row.deleted_at,
    blocked: row.blocked === true,
    isAdmin: row.is_admin === true,
    crmRole: row.crm_role || "none",
    modules:
      row.modules === undefined || row.modules === null
        ? null
        : Array.isArray(row.modules)
          ? row.modules
          : null,
  };
}

const AGENT_AUTH_COLUMNS =
  "id, email, display_name, auth_user_id, needs_password_setup, phone, active, blocked, deleted_at, modules, is_admin, crm_role";

export async function getAgentByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_AUTH_COLUMNS)
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    console.warn("[agentAuthService] getAgentByEmail failed", error.message);
    return null;
  }
  return mapAgentRow(data);
}

export async function getAgentById(agentId) {
  const id = String(agentId || "").trim();
  if (!id) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_AUTH_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[agentAuthService] getAgentById failed", error.message);
    return null;
  }
  return mapAgentRow(data);
}

export async function getAgentByAuthUserId(authUserId) {
  const id = String(authUserId || "").trim();
  if (!id) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_AUTH_COLUMNS)
    .eq("auth_user_id", id)
    .maybeSingle();

  if (error) {
    console.warn("[agentAuthService] getAgentByAuthUserId failed", error.message);
    return null;
  }
  return mapAgentRow(data);
}

function randomInternalPassword() {
  return `Agt_${crypto.randomUUID().replace(/-/g, "")}!9`;
}

/**
 * Create auth.users if missing, link auth_user_id, confirm email.
 * @param {object} agent — row from getAgentById / getAgentByEmail
 * @param {string} [password] — optional initial password
 */
export async function provisionAuthUserForAgent(agent, password) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");

  const email = normalizeEmail(agent?.email);
  if (!email || email.endsWith("@pending.local")) {
    throw new Error("invalid_agent_email");
  }

  let authUserId = agent.authUserId || null;

  if (!authUserId) {
    const initialPassword = password || randomInternalPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { agent_id: agent.id, display_name: agent.displayName },
    });

    if (error) {
      if (String(error.message || "").toLowerCase().includes("already")) {
        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listErr) throw listErr;
        const existing = (listData?.users || []).find(
          (u) => normalizeEmail(u.email) === email
        );
        if (!existing?.id) throw error;
        authUserId = existing.id;
      } else {
        throw error;
      }
    } else {
      authUserId = data.user?.id || null;
    }
  }

  if (!authUserId) throw new Error("auth_user_missing");

  const { error: linkErr } = await supabase
    .from("agents")
    .update({ auth_user_id: authUserId })
    .eq("id", agent.id);

  if (linkErr) throw linkErr;

  return { authUserId, agentId: agent.id };
}

export async function adminUpdateAgentPassword(authUserId, password) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password: String(password),
  });
  if (error) throw error;
}

export async function markAgentPasswordSetupComplete(agentId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("agents")
    .update({ needs_password_setup: false })
    .eq("id", agentId);

  if (error) throw error;
}

export async function markAgentNeedsPasswordSetup(agentId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("supabase_not_configured");

  const { error } = await supabase
    .from("agents")
    .update({ needs_password_setup: true })
    .eq("id", agentId);

  if (error) throw error;
}

/** האם יש משתמש ב-Supabase Auth — לא רק דגל needs_password_setup בטבלה. */
export async function resolveAgentAuthUser(agent) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !agent) return { exists: false, authUserId: null };

  const email = normalizeEmail(agent.email);
  if (!email) return { exists: false, authUserId: null };

  if (agent.authUserId) {
    const { data, error } = await supabase.auth.admin.getUserById(agent.authUserId);
    if (!error && data?.user?.id) {
      return { exists: true, authUserId: data.user.id };
    }
  }

  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.warn("[agentAuthService] listUsers failed", listErr.message);
    return { exists: false, authUserId: null };
  }

  const existing = (listData?.users || []).find((u) => normalizeEmail(u.email) === email);
  if (!existing?.id) {
    return { exists: false, authUserId: null };
  }

  if (agent.authUserId !== existing.id) {
    await supabase.from("agents").update({ auth_user_id: existing.id }).eq("id", agent.id);
  }

  return { exists: true, authUserId: existing.id };
}

export function agentRequiresFirstLogin(agent, authState) {
  if (!agent) return false;
  if (agent.needsPasswordSetup) return true;
  return !authState?.exists;
}

export async function verifyBearerAgent(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const admin = getSupabaseAdmin();
  let data = null;
  let error = null;

  if (admin) {
    const adminResult = await admin.auth.getUser(token);
    data = adminResult.data;
    error = adminResult.error;
  } else {
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    if (!url || !anonKey) return null;
    const anonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonResult = await anonClient.auth.getUser(token);
    data = anonResult.data;
    error = anonResult.error;
  }

  if (error || !data?.user?.id) return null;

  let agent = await getAgentByAuthUserId(data.user.id);
  if (!agent && data.user.email) {
    agent = await getAgentByEmail(data.user.email);
    if (agent?.id && agent.authUserId !== data.user.id) {
      const linkAdmin = getSupabaseAdmin();
      if (linkAdmin) {
        await linkAdmin
          .from("agents")
          .update({ auth_user_id: data.user.id })
          .eq("id", agent.id);
        agent = { ...agent, authUserId: data.user.id };
      }
    }
  }
  if (!agent || !agent.active || agent.blocked) return null;

  return { agent, authUser: data.user, accessToken: token };
}

/** Optional server-only second factor (ADMIN_PIN). When unset, JWT+is_admin is sufficient. */
export function verifyAdminPin(body) {
  const configured = String(process.env.ADMIN_PIN || "").trim();
  if (!configured) return true;
  return String(body?.adminPin || "").trim() === configured;
}

/**
 * Primary admin gate: Bearer JWT → agents row → is_admin === true.
 * ADMIN_PIN is an optional second factor when set server-side.
 */
export async function verifyAdminAgent(req, body = {}) {
  const auth = await verifyBearerAgent(req);
  if (!auth?.agent?.isAdmin) return null;
  if (!verifyAdminPin(body)) return null;
  return auth;
}

/** Knowledge API: authenticated agent with admin or knowledge_chat module (legacy: knowledge). */
export async function verifyKnowledgeAccess(req) {
  const auth = await verifyBearerAgent(req);
  if (!auth?.agent) return null;
  if (auth.agent.isAdmin) return auth;
  const modules = Array.isArray(auth.agent.modules) ? auth.agent.modules : [];
  if (modules.includes("knowledge_chat") || modules.includes("knowledge")) return auth;
  return null;
}

/** AI Agent API: authenticated agent with admin or ai_agent module (legacy: knowledge_chat). */
export async function verifyAiAgentAccess(req) {
  const auth = await verifyBearerAgent(req);
  if (!auth?.agent) return null;
  if (auth.agent.isAdmin) return auth;
  if (agentHasModule(auth.agent.modules, "ai_agent")) return auth;
  return null;
}
