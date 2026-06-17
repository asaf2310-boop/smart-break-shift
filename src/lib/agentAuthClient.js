import { supabase } from "@/api/supabase";
import { getAdminPinForApi } from "@/lib/adminPinClient";

const AGENT_AUTH_API = "/api/agent-auth";

async function getBearerToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function postAgentAuth(body, { requireBearer = false, accessToken = null } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = accessToken || (await getBearerToken());
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

export async function apiCompleteAgentPasswordSetup(accessToken = null) {
  return postAgentAuth({ action: "complete_setup" }, { requireBearer: true, accessToken });
}

/** Links agents.auth_user_id to the signed-in Supabase user (service role). */
export async function apiSyncAgentAuth(accessToken = null) {
  return postAgentAuth({ action: "sync_auth" }, { requireBearer: true, accessToken });
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

export async function apiRequestFirstLogin(email) {
  return postAgentAuth({
    action: "request_first_login",
    email,
  });
}

export async function apiProvisionAgentAuth(agentId) {
  return postAgentAuth({
    action: "provision_auth",
    agentId,
  });
}

export async function apiAdminCreateBreakRegistration(payload) {
  const result = await postAgentAuth({
    action: "admin_create_break_registration",
    agent_name: payload.agent_name,
    break_type: payload.break_type,
    time_slot: payload.time_slot,
    date: payload.date,
  });
  if (!result.ok) {
    throw new Error(result.message || "לא הצלחנו לשמור את ההרשמה");
  }
  return result.registration;
}

export async function apiAdminDeleteBreakRegistration(id) {
  const result = await postAgentAuth({
    action: "admin_delete_break_registration",
    id,
  });
  if (!result.ok) {
    throw new Error(result.message || "לא הצלחנו להסיר את ההרשמה");
  }
  return result;
}
