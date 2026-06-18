import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";

const SMS_ACTIONS = ["send_review_sms", "send_schedule_sms"];
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const PAGE_SIZE = 1000;

function startOfDayIso(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayIso(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function parseDateRange({ fromDate, toDate, days } = {}) {
  const now = new Date();
  let to = toDate ? new Date(toDate) : now;
  if (Number.isNaN(to.getTime())) to = now;

  let from;
  if (fromDate) {
    from = new Date(fromDate);
    if (Number.isNaN(from.getTime())) {
      from = new Date(now);
      from.setDate(from.getDate() - DEFAULT_DAYS);
    }
  } else {
    const safeDays = Math.min(MAX_DAYS, Math.max(1, Number(days) || DEFAULT_DAYS));
    from = new Date(now);
    from.setDate(from.getDate() - safeDays);
  }

  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  const fromDay = new Date(startOfDayIso(from));
  const toDay = new Date(startOfDayIso(to));
  const daySpan =
    Math.floor((toDay.getTime() - fromDay.getTime()) / 86400000) + 1;

  return {
    fromIso: startOfDayIso(from),
    toIso: endOfDayIso(to),
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
    days: Math.max(1, daySpan),
  };
}

function agentKey(agentId, agentName) {
  if (agentId) return `id:${agentId}`;
  const name = String(agentName || "").trim();
  return name ? `name:${name}` : "unknown";
}

function ensureAgentRow(map, key, { agentId = null, agentName = null } = {}) {
  if (!map.has(key)) {
    map.set(key, {
      agentId,
      agentName: agentName || null,
      total: 0,
      send_review_sms: 0,
      send_schedule_sms: 0,
    });
  }
  const row = map.get(key);
  if (agentId && !row.agentId) row.agentId = agentId;
  if (agentName && !row.agentName) row.agentName = agentName;
  return row;
}

function resolveScheduleTarget(row) {
  const meta = row.metadata || {};
  return {
    agentId: meta.targetAgentId || null,
    agentName: meta.targetAgentName || meta.agentName || null,
  };
}

function resolveReviewActor(row) {
  const meta = row.metadata || {};
  return {
    agentId: row.actor_agent_id || null,
    agentName: meta.actorName || row.agents?.display_name || null,
  };
}

async function fetchSmsAuditRows(supabase, fromIso, toIso) {
  const rows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("security_audit_log")
      .select("actor_agent_id, action, metadata, agents(display_name)")
      .in("action", SMS_ACTIONS)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

/**
 * Aggregate SMS counts per agent from security_audit_log (service role — admin API only).
 */
export async function getSmsStatsByAgent({ fromDate, toDate, days } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "supabase_not_configured" };

  const range = parseDateRange({ fromDate, toDate, days });

  let auditRows;
  try {
    auditRows = await fetchSmsAuditRows(supabase, range.fromIso, range.toIso);
  } catch (err) {
    console.warn("[smsStatsService] fetch failed", err.message);
    return { ok: false, error: "load_failed", message: "לא הצלחנו לטעון נתוני SMS" };
  }

  const byAgent = new Map();

  for (const row of auditRows) {
    const action = String(row.action || "").trim();
    if (!SMS_ACTIONS.includes(action)) continue;

    let target;
    if (action === "send_schedule_sms") {
      target = resolveScheduleTarget(row);
    } else {
      target = resolveReviewActor(row);
    }

    const key = agentKey(target.agentId, target.agentName);
    const stats = ensureAgentRow(byAgent, key, target);
    stats[action] += 1;
    stats.total += 1;
  }

  const agents = [...byAgent.values()].sort((a, b) => {
    const diff = Number(b.total) - Number(a.total);
    if (diff !== 0) return diff;
    return String(a.agentName || a.agentId || "").localeCompare(
      String(b.agentName || b.agentId || ""),
      "he"
    );
  });

  const totals = agents.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      send_review_sms: acc.send_review_sms + row.send_review_sms,
      send_schedule_sms: acc.send_schedule_sms + row.send_schedule_sms,
    }),
    { total: 0, send_review_sms: 0, send_schedule_sms: 0 }
  );

  return {
    ok: true,
    period: {
      fromDate: range.fromDate,
      toDate: range.toDate,
      days: range.days,
    },
    agents,
    totals,
    rowCount: auditRows.length,
  };
}
