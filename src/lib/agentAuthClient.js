import { supabase } from "@/api/supabase";

const AGENT_AUTH_API = "/api/agent-auth";
const AGENT_API_TIMEOUT_MS = 15000;

function withAgentApiTimeout(promise, ms = AGENT_API_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("agent_api_timeout")), ms);
    }),
  ]);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AGENT_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getBearerToken() {
  if (!supabase) return null;
  const { data } = await withAgentApiTimeout(supabase.auth.getSession());
  return data?.session?.access_token || null;
}

/** Build fetch headers with optional Bearer token for protected API routes. */
export async function getAgentBearerHeaders(extra = {}) {
  const headers = { ...extra };
  const token = await getBearerToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function mapAgentApiTransportError(err) {
  if (err?.name === "AbortError" || String(err?.message || err) === "agent_api_timeout") {
    return {
      ok: false,
      error: "timeout",
      message: "החיבור לשרת ארך זמן רב מדי — נסו שוב בעוד רגע",
    };
  }
  return {
    ok: false,
    error: "request_failed",
    message: "לא הצלחנו להתחבר לשרת",
  };
}

async function postAgentAuth(
  body,
  { requireBearer = false, accessToken = null, timeoutMs = AGENT_API_TIMEOUT_MS } = {}
) {
  const headers = { "Content-Type": "application/json" };
  let token = accessToken;
  try {
    token = accessToken || (await withAgentApiTimeout(getBearerToken(), timeoutMs));
  } catch (err) {
    return mapAgentApiTransportError(err);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (requireBearer) {
    return { ok: false, error: "unauthorized", message: "נדרשת התחברות" };
  }

  let response;
  try {
    response = await fetchWithTimeout(
      AGENT_AUTH_API,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      timeoutMs
    );
  } catch (err) {
    return mapAgentApiTransportError(err);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: data.error || "request_failed",
      message: data.message || "הבקשה נכשלה",
      template: data.template ?? null,
      maxLength: data.maxLength ?? null,
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
  return postAgentAuth(
    {
      action: "admin_set_password",
      agentId,
      password,
      forceSetup,
    },
    { requireBearer: true }
  );
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
  return postAgentAuth(
    {
      action: "provision_auth",
      agentId,
    },
    { requireBearer: true }
  );
}

export async function apiAdminCreateBreakRegistration(payload) {
  const result = await postAgentAuth(
    {
      action: "admin_create_break_registration",
      agent_name: payload.agent_name,
      break_type: payload.break_type,
      time_slot: payload.time_slot,
      date: payload.date,
    },
    { requireBearer: true }
  );
  if (!result.ok) {
    throw new Error(result.message || "לא הצלחנו לשמור את ההרשמה");
  }
  return result.registration;
}

export async function apiAdminDeleteBreakRegistration(id) {
  const result = await postAgentAuth(
    {
      action: "admin_delete_break_registration",
      id,
    },
    { requireBearer: true }
  );
  if (!result.ok) {
    throw new Error(result.message || "לא הצלחנו להסיר את ההרשמה");
  }
  return result;
}

export async function apiSendReviewSms({ phone }) {
  return postAgentAuth(
    {
      action: "send_review_sms",
      phone,
    },
    { requireBearer: true }
  );
}

export async function apiGetReviewSmsConfig() {
  return postAgentAuth({ action: "get_review_sms_settings" }, { requireBearer: true });
}

export async function apiUpdateReviewSmsSettings({ googleReviewSmsUrl }) {
  return postAgentAuth(
    {
      action: "update_review_sms_settings",
      google_review_sms_url: googleReviewSmsUrl,
    },
    { requireBearer: true }
  );
}

export async function apiAdminListAuditLog({ limit = 50, offset = 0, filterAction = null } = {}) {
  return postAgentAuth(
    {
      action: "admin_list_audit_log",
      limit,
      offset,
      filterAction,
    },
    { requireBearer: true }
  );
}

export async function apiAdminSmsStatsByAgent({ days = 30, fromDate = null, toDate = null } = {}) {
  return postAgentAuth(
    {
      action: "admin_sms_stats_by_agent",
      days,
      fromDate,
      toDate,
    },
    { requireBearer: true }
  );
}

/** Fire-and-forget security audit for admin agent / CRM changes (production). */
export function apiLogAdminAgentChange({ agentId, changeType, metadata = {} } = {}) {
  void postAgentAuth(
    {
      action: "admin_log_agent_change",
      agentId,
      changeType,
      metadata,
    },
    { requireBearer: true }
  );
}

/** Mint short-lived encrypted SIP credential token via POST /api/agent-auth. */
export async function apiSipTokenMint({ agentName = null } = {}) {
  return postAgentAuth(
    {
      action: "sip_token_mint",
      agent: agentName,
    },
    { requireBearer: true }
  );
}

/** Redeem one-time SIP credential token for WSS password. */
export async function apiSipTokenRedeem(credentialToken) {
  return postAgentAuth(
    {
      action: "sip_token_redeem",
      credentialToken,
    },
    { requireBearer: true }
  );
}
