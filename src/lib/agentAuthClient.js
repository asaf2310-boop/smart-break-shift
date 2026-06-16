import { supabase } from "@/api/supabase";
import { getAdminPinForApi } from "@/lib/adminPinClient";

const AGENT_AUTH_API = "/api/agent-auth";

async function getBearerToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function postAgentAuth(body, { requireBearer = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = await getBearerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (requireBearer) {
    return { ok: false, error: "unauthorized", message: "נדרשת התחברות" };
  }

  const adminPin = getAdminPinForApi();
  const payload = adminPin ? { ...body, adminPin } : body;

  const response = await fetch(AGENT_AUTH_API, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: data.error || "request_failed",
      message: data.message || "הבקשה נכשלה",
    };
  }
  return { ok: true, ...data };
}

export async function apiCompleteAgentPasswordSetup() {
  return postAgentAuth({ action: "complete_setup" }, { requireBearer: true });
}

export async function apiAdminSetAgentPassword(agentId, password, { forceSetup = true } = {}) {
  return postAgentAuth({
    action: "admin_set_password",
    agentId,
    password,
    forceSetup,
  });
}

export async function apiRequestAgentPasswordReset(email) {
  return postAgentAuth({
    action: "request_password_reset",
    email,
  });
}

export async function apiProvisionAgentAuth(agentId) {
  return postAgentAuth({
    action: "provision_auth",
    agentId,
  });
}
