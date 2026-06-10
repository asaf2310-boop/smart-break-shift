import { demoModeEnabled } from "@/api/demoClient";
import { createCallLog, crmDemoAvailable, getCustomerByPhone } from "@/lib/crmStore";
import { getAgentNamesList } from "@/constants/scheduling";
import {
  answerSipCall,
  connectSip,
  dialSipOutbound,
  disconnectSip,
  getConfiguredProvider,
  hangupSipCall,
  initSipTelephony,
  toggleSipMute,
} from "@/lib/telephonyProvider";
export const TELEPHONY_STORAGE_KEY = "smart-break-shift-telephony-v1";
export const TELEPHONY_CHANGE_EVENT = "telephony-store-changed";

export const CALL_STATUS = {
  idle: { value: "idle", label: "מוכן" },
  dialing: { value: "dialing", label: "מחייג…" },
  ringing: { value: "ringing", label: "מצלצל…" },
  connected: { value: "connected", label: "בשיחה" },
  ended: { value: "ended", label: "הסתיים" },
};

const RING_MS = 1800;
const CONNECT_AFTER_RING_MS = 1200;
const DIAL_MS = 600;

let activeCall = null;
let phaseTimer = null;
/** @type {null | Record<string, unknown>} */
let pendingDisposition = null;
let sipEventsBound = false;

function shouldUseRealSip() {
  return !demoModeEnabled && getConfiguredProvider() === "sip";
}

function handleSipProviderEvent(event) {
  if (!shouldUseRealSip()) return;

  switch (event.type) {
    case "registration":
      emitChange();
      break;
    case "inbound-ringing": {
      if (
        activeCall &&
        ![CALL_STATUS.ended.value, CALL_STATUS.idle.value].includes(activeCall.status)
      ) {
        return;
      }
      clearPhaseTimer();
      const phone = String(event.phone || "").trim() || "unknown";
      const customerMeta = resolveInboundCustomerMeta({ phone });
      activeCall = {
        id: event.sessionId || makeId("sip_in"),
        direction: "inbound",
        phone,
        status: CALL_STATUS.ringing.value,
        ...customerMeta,
        agent_name: getCurrentAgentNameHint(),
        started_at: new Date().toISOString(),
        connected_at: null,
        ended_at: null,
        muted: false,
        simulated: false,
      };
      emitChange();
      break;
    }
    case "outbound-progress": {
      if (!activeCall) {
        activeCall = {
          id: event.sessionId || makeId("sip_out"),
          direction: "outbound",
          phone: String(event.phone || "").trim(),
          status:
            event.status === "ringing"
              ? CALL_STATUS.ringing.value
              : CALL_STATUS.dialing.value,
          customer_id: null,
          customer_name: null,
          customer_company: null,
          agent_name: getCurrentAgentNameHint(),
          started_at: new Date().toISOString(),
          connected_at: null,
          ended_at: null,
          muted: false,
          simulated: false,
        };
      } else {
        setActive({
          status:
            event.status === "ringing"
              ? CALL_STATUS.ringing.value
              : CALL_STATUS.dialing.value,
        });
      }
      emitChange();
      break;
    }
    case "connected":
      clearPhaseTimer();
      setActive({
        status: CALL_STATUS.connected.value,
        connected_at: event.connectedAt || new Date().toISOString(),
        muted: false,
      });
      break;
    case "ended": {
      if (!activeCall) return;
      const connectedAt = activeCall.connected_at
        ? new Date(activeCall.connected_at).getTime()
        : null;
      const durationSeconds =
        connectedAt != null
          ? Math.max(0, Math.round((Date.now() - connectedAt) / 1000))
          : 0;
      const answered = activeCall.status === CALL_STATUS.connected.value;
      finishCall({ durationSeconds, answered });
      break;
    }
    case "mute":
      setActive({ muted: Boolean(event.muted) });
      break;
    default:
      break;
  }
}

/** Wire sip.js events once (production SIP). Called from SoftphoneWidget on mount. */
export function bindSipTelephonyEvents(remoteAudioEl = null) {
  if (sipEventsBound || !shouldUseRealSip()) return;
  sipEventsBound = true;
  initSipTelephony({
    remoteAudioEl,
    onEvent: handleSipProviderEvent,
  });
}

export function isRealSipEnabled() {
  return shouldUseRealSip();
}let demoTickerId = null;
let demoOnCallAgents = new Set();

export const TELEPHONY_STATUS_SELECT_OPTIONS = [
  AGENT_TELEPHONY_STATUS.available,
  AGENT_TELEPHONY_STATUS.lunch,
  AGENT_TELEPHONY_STATUS.short_break,
  AGENT_TELEPHONY_STATUS.comfort,
];

const TELEPHONY_SESSION_KEY = "agent_telephony_connected";

function defaultCenterStats() {
  return { incoming: 0, answered: 0, abandoned: 0, waiting: 0 };
}

function normalizeCenterStats(raw) {
  const base = defaultCenterStats();
  if (!raw || typeof raw !== "object") return base;
  return {
    incoming: Math.max(0, Number(raw.incoming) || 0),
    answered: Math.max(0, Number(raw.answered) || 0),
    abandoned: Math.max(0, Number(raw.abandoned) || 0),
    waiting: Math.max(0, Number(raw.waiting) || 0),
  };
}

function normalizeQueueCalls(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === "object" && row.phone)
    .map((row, index) => ({
      id: row.id || `queue_${index}_${String(row.phone).replace(/\D/g, "")}`,
      phone: String(row.phone).trim(),
      customer_name: row.customer_name ? String(row.customer_name) : null,
      waiting_seconds: Math.max(0, Number(row.waiting_seconds) || 0),
    }));
}

function readPersisted() {
  try {
    const raw = localStorage.getItem(TELEPHONY_STORAGE_KEY);
    if (!raw) {
      return {
        callLogs: [],
        docked: false,
        agentStatusByName: {},
        queueCalls: [],
        centerStats: defaultCenterStats(),
      };
    }
    const parsed = JSON.parse(raw);
    const queueCalls = normalizeQueueCalls(parsed.queueCalls);
    const centerStats = normalizeCenterStats(parsed.centerStats);
    return {
      callLogs: Array.isArray(parsed.callLogs) ? parsed.callLogs : [],
      docked: Boolean(parsed.docked),
      agentStatusByName:
        parsed.agentStatusByName && typeof parsed.agentStatusByName === "object"
          ? parsed.agentStatusByName
          : {},
      queueCalls,
      centerStats: {
        ...centerStats,
        waiting: centerStats.waiting || queueCalls.length,
      },
    };
  } catch {
    return {
      callLogs: [],
      docked: false,
      agentStatusByName: {},
      queueCalls: [],
      centerStats: defaultCenterStats(),
    };
  }
}

function writePersisted(partial) {
  const current = readPersisted();
  const next = { ...current, ...partial };
  localStorage.setItem(TELEPHONY_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(TELEPHONY_CHANGE_EVENT));
}

function emitChange() {
  window.dispatchEvent(new CustomEvent(TELEPHONY_CHANGE_EVENT));
}

function syncCenterWaiting() {
  const data = readPersisted();
  const waiting = data.queueCalls.length;
  if (data.centerStats.waiting === waiting) return;
  writePersisted({
    centerStats: { ...data.centerStats, waiting },
  });
}

function isActiveCallForAgent(agentName) {
  if (!agentName || !activeCall) return false;
  if (activeCall.agent_name && activeCall.agent_name !== agentName) return false;
  return ![CALL_STATUS.idle.value, CALL_STATUS.ended.value].includes(activeCall.status);
}

function bumpCenterStat(field, delta = 1) {
  const { centerStats, queueCalls } = readPersisted();
  const next = {
    ...centerStats,
    [field]: Math.max(0, (centerStats[field] || 0) + delta),
    waiting: queueCalls.length,
  };
  writePersisted({ centerStats: next });
}

function seedDemoTelephonyDashboard(currentAgentName) {
  if (!demoModeEnabled) return;

  const data = readPersisted();
  const agents = getAgentNamesList().filter((n) => n !== currentAgentName);
  const nextStatus = { ...data.agentStatusByName };
  let changed = false;

  agents.forEach((name, index) => {
    if (!nextStatus[name]) {
      nextStatus[name] = DEMO_STATUS_KEYS[index % DEMO_STATUS_KEYS.length];
      changed = true;
    }
  });

  let queueCalls = data.queueCalls;
  let centerStats = data.centerStats;
  if (!queueCalls.length) {
    const seedCount = Math.min(4, DEMO_QUEUE_PHONES.length);
    queueCalls = DEMO_QUEUE_PHONES.slice(0, seedCount).map((row, index) => ({
      id: `queue_seed_${index}`,
      phone: row.phone,
      customer_name: row.customer_name,
      waiting_seconds: 28 + index * 18,    }));
    changed = true;
  }

  if (
    !centerStats.incoming &&
    !centerStats.answered &&
    !centerStats.abandoned
  ) {
    centerStats = {
      incoming: 42,
      answered: 31,
      abandoned: 4,      waiting: queueCalls.length,
    };
    changed = true;
  }

  if (changed) {
    writePersisted({ agentStatusByName: nextStatus, queueCalls, centerStats });
  } else {
    syncCenterWaiting();
  }

  if (!demoOnCallAgents.size && agents.length) {
    const onCallCount = Math.min(3, agents.length, DEMO_MAX_ON_CALL_AGENTS);
    demoOnCallAgents = new Set(agents.slice(0, onCallCount));  }
}

function tickDemoTelephonyDashboard() {
  if (!demoModeEnabled) return;

  const data = readPersisted();
  const agents = getAgentNamesList();

  if (Math.random() < 0.4 && agents.length) {
    const pick = agents[Math.floor(Math.random() * agents.length)];
    if (!isActiveCallForAgent(pick)) {
      if (demoOnCallAgents.size < DEMO_MAX_ON_CALL_AGENTS && Math.random() < 0.55) {
        demoOnCallAgents.add(pick);
      } else if (demoOnCallAgents.size > 0 && Math.random() < 0.45) {
        const busy = [...demoOnCallAgents];
        demoOnCallAgents.delete(busy[Math.floor(Math.random() * busy.length)]);
      }    }
  }

  let queueCalls = data.queueCalls.map((row) => ({
    ...row,
    waiting_seconds: (row.waiting_seconds || 0) + 4,
  }));

  let centerStats = { ...data.centerStats };

  if (Math.random() < 0.22 && queueCalls.length < DEMO_MAX_QUEUE) {    const template =
      DEMO_QUEUE_PHONES[Math.floor(Math.random() * DEMO_QUEUE_PHONES.length)];
    queueCalls.push({
      id: makeId("queue"),
      phone: template.phone,
      customer_name: template.customer_name,
      waiting_seconds: 6 + Math.floor(Math.random() * 12),
    });
    centerStats.incoming += 1;
  } else if (Math.random() < 0.2 && queueCalls.length) {
    queueCalls.shift();
    if (Math.random() < 0.6) centerStats.answered += 1;
    else centerStats.abandoned += 1;
  }

  if (Math.random() < 0.18) centerStats.incoming += 1;
  centerStats.waiting = queueCalls.length;
  writePersisted({ queueCalls, centerStats });
}

function ensureDemoTelephonyTicker() {
  if (!demoModeEnabled || typeof window === "undefined") return;
  seedDemoTelephonyDashboard(getCurrentAgentNameHint());
  if (demoTickerId) return;
  demoTickerId = window.setInterval(() => {
    tickDemoTelephonyDashboard();
    emitChange();
  }, 5000);
}

function getCurrentAgentNameHint() {
  try {
    return localStorage.getItem("agent_name") || "";
  } catch {
    return "";
  }
}

function stopDemoTelephonyTicker() {
  if (demoTickerId) {
    clearInterval(demoTickerId);
    demoTickerId = null;
  }
}

function clearPhaseTimer() {
  if (phaseTimer) {
    clearTimeout(phaseTimer);
    phaseTimer = null;
  }
}

export function telephonyDemoAvailable() {
  return demoModeEnabled;
}

export function subscribeTelephony(listener) {
  ensureDemoTelephonyTicker();
  const handler = () => listener();
  window.addEventListener(TELEPHONY_CHANGE_EVENT, handler);
  return () => window.removeEventListener(TELEPHONY_CHANGE_EVENT, handler);
}

export function getActiveCall() {
  return activeCall ? { ...activeCall } : null;
}

export function getPendingDisposition() {
  return pendingDisposition ? { ...pendingDisposition } : null;
}
function finishCall({ durationSeconds = 0, answered = true } = {}) {
  if (!activeCall) return;
  clearPhaseTimer();

  const useDispositionFlow = demoModeEnabled || shouldUseRealSip();

  if (useDispositionFlow) {
    pendingDisposition = {
      id: activeCall.id,
      direction: activeCall.direction,
      phone: activeCall.phone,
      customer_id: activeCall.customer_id || null,
      customer_name: activeCall.customer_name || null,
      customer_company: activeCall.customer_company || null,
      agent_name: activeCall.agent_name || null,
      started_at: activeCall.started_at,
      connected_at: activeCall.connected_at,
      duration_seconds: durationSeconds,
      answered,
    };
    applyDemoCallEndSideEffects(activeCall, { answered });
    activeCall = null;
    emitChange();
    return;
  }

  const log = buildTelephonyLogEntry(activeCall, { durationSeconds, answered });
  appendCallLog(log);
  applyDemoCallEndSideEffects(activeCall, { answered });
  if (
    crmDemoAvailable() &&
    activeCall.customer_id &&
    answered &&
    durationSeconds >= 0
  ) {
    writeCrmCallFromDisposition(
      { ...activeCall, duration_seconds: durationSeconds, answered },
      { summary: `שיחה מדומה (${activeCall.phone})` }
    );
  }

  const endedAt = log.ended_at;  setActive({
    status: CALL_STATUS.ended.value,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
  });

  phaseTimer = setTimeout(() => {
    activeCall = null;
    emitChange();
  }, 900);
}

/** שמירת סיכום שיחה ל-CRM לאחר ניתוק (דמו) */
export function submitCallDisposition({ summary = "", referral_topic = null } = {}) {
  if (!pendingDisposition) return false;
  const call = pendingDisposition;
  appendCallLog(buildTelephonyLogEntry(call, { durationSeconds: call.duration_seconds, answered: call.answered }));
  writeCrmCallFromDisposition(call, { summary, referral_topic });
  pendingDisposition = null;
  emitChange();
  return true;
}

/** דילוג על תיעוד CRM — שומר רק ביומן טלפוניה */
export function dismissCallDisposition() {
  if (!pendingDisposition) return;
  const call = pendingDisposition;
  appendCallLog(buildTelephonyLogEntry(call, { durationSeconds: call.duration_seconds, answered: call.answered }));
  pendingDisposition = null;
  emitChange();
}
  phone,
  agentName,
  customer_id = null,
  customer_name = null,
} = {}) {
  const normalized = String(phone || "").replace(/\s/g, "").trim();
  if (!normalized) throw new Error("הזינו מספר טלפון");

  let resolvedCustomerId = customer_id;
  let resolvedCustomerName = customer_name;
  let resolvedCustomerCompany = null;
  if (!resolvedCustomerId) {
    const match = getCustomerByPhone(normalized);
    if (match) {
      resolvedCustomerId = match.id;
      resolvedCustomerName = match.name;
      resolvedCustomerCompany = match.company || null;
    }
  }

  if (activeCall && activeCall.status !== CALL_STATUS.ended.value) {
    await hangUp();
  }

  if (shouldUseRealSip()) {
    bindSipTelephonyEvents();
    const startedAt = new Date().toISOString();
    activeCall = {
      id: makeId("tel_active"),
      direction: "outbound",
      phone: normalized,
      status: CALL_STATUS.dialing.value,
      customer_id: resolvedCustomerId,
      customer_name: resolvedCustomerName,
      customer_company: resolvedCustomerCompany,
      agent_name: agentName || null,
      started_at: startedAt,
      connected_at: null,
      ended_at: null,
      muted: false,
      simulated: false,
    };
    emitChange();
    const result = await dialSipOutbound(normalized);
    if (!result.ok) {
      activeCall = null;
      emitChange();
      throw new Error(result.reason || "כשל בחיוג");
    }
    return getActiveCall();
  }

  if (!demoModeEnabled) {
    throw new Error("שיחות זמינות בדמו או עם SIP מוגדר (VITE_SIP_WS_URL)");  }

  clearPhaseTimer();
  const startedAt = new Date().toISOString();
  bumpCenterStat("incoming");
  demoOnCallAgents.add(agentName || getCurrentAgentNameHint());
  activeCall = {
    id: makeId("tel_active"),
    direction: "outbound",
    phone: normalized,
    status: CALL_STATUS.dialing.value,
    customer_id: resolvedCustomerId,
    customer_name: resolvedCustomerName,
    customer_company: resolvedCustomerCompany,    agent_name: agentName || null,
    started_at: startedAt,
    connected_at: null,
    ended_at: null,
    muted: false,
    simulated: true,
  };
  emitChange();
  runOutboundPhases();
  return getActiveCall();
}

/**
 * Simulate inbound ring (demo only).
 */
function resolveInboundCustomerMeta({ phone, customer_id, customer_name, customer_company }) {
  if (customer_id) {
    return {
      customer_id,
      customer_name: customer_name || null,
      customer_company: customer_company || null,
    };
  }
  const match = getCustomerByPhone(phone);
  if (!match) {
    return { customer_id: null, customer_name: null, customer_company: null };
  }
  return {
    customer_id: match.id,
    customer_name: match.name,
    customer_company: match.company || null,
  };
}

export function simulateInboundCall({
  phone = "050-1234567",
  agentName,
  customer_id = null,
  customer_name = null,
  customer_company = null,} = {}) {
  if (!demoModeEnabled) {
    throw new Error("שיחות מדומות זמינות רק ב-VITE_DEMO_MODE");
  }
  if (activeCall && ![CALL_STATUS.ended.value, CALL_STATUS.idle.value].includes(activeCall.status)) {
    return getActiveCall();
  }

  clearPhaseTimer();
  const startedAt = new Date().toISOString();
  const normalizedPhone = String(phone).trim();
  const customerMeta = resolveInboundCustomerMeta({
    phone: normalizedPhone,
    customer_id,
    customer_name,
    customer_company,
  });
    agent_name: agentName || null,
    started_at: startedAt,
    connected_at: null,
    ended_at: null,
    muted: false,
    simulated: true,
  };
  emitChange();
  runInboundPhases();
  return getActiveCall();
}

export async function answerInbound() {
  if (!activeCall || activeCall.direction !== "inbound") return null;
  if (activeCall.status === CALL_STATUS.connected.value) return getActiveCall();

  if (shouldUseRealSip()) {
    const result = await answerSipCall();
    if (!result.ok) return null;
    clearPhaseTimer();
    setActive({
      status: CALL_STATUS.connected.value,
      connected_at: new Date().toISOString(),
    });
    return getActiveCall();
  }
  clearPhaseTimer();
  const connectedAt = new Date().toISOString();
  setActive({
    status: CALL_STATUS.connected.value,
    connected_at: connectedAt,
  });
  return getActiveCall();
}

export async function hangUp() {
  if (!activeCall) return;

  if (shouldUseRealSip()) {
    await hangupSipCall();
    if (activeCall) {
      const connectedAt = activeCall.connected_at
        ? new Date(activeCall.connected_at).getTime()
        : null;
      const durationSeconds =
        connectedAt != null
          ? Math.max(0, Math.round((Date.now() - connectedAt) / 1000))
          : 0;
      const answered = activeCall.status === CALL_STATUS.connected.value;
      finishCall({ durationSeconds, answered });
    }
    return;
  }
  const connectedAt = activeCall.connected_at
    ? new Date(activeCall.connected_at).getTime()
    : null;
  const durationSeconds =
    connectedAt != null
      ? Math.max(0, Math.round((Date.now() - connectedAt) / 1000))
      : 0;
  const answered = activeCall.status === CALL_STATUS.connected.value;
  finishCall({ durationSeconds, answered });
}

export async function toggleMute() {
  if (!activeCall || activeCall.status !== CALL_STATUS.connected.value) return false;

  if (shouldUseRealSip()) {
    const result = await toggleSipMute();
    if (result.ok) setActive({ muted: result.muted });
    return Boolean(result.muted);
  }
  setActive({ muted: !activeCall.muted });
  return activeCall.muted;
}

export function getStatusLabel(status) {
  return CALL_STATUS[status]?.label || status || "";
}

export function isAgentTelephonyConnected() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(TELEPHONY_SESSION_KEY) !== "false";
}

export function setAgentTelephonyConnected(connected) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TELEPHONY_SESSION_KEY, connected ? "true" : "false");
  emitChange();
}

/** מפת סטטוס טלפוניה לכל נציג (נשמר ב-localStorage). */
export function getAgentTelephonyStatusMap() {
  const { agentStatusByName } = readPersisted();
  return { ...agentStatusByName };
}

export function getQueueCalls() {
  ensureDemoTelephonyTicker();
  return [...readPersisted().queueCalls];
}

export function getCenterStats() {
  ensureDemoTelephonyTicker();
  const { centerStats, queueCalls } = readPersisted();
  return {
    ...centerStats,
    waiting: queueCalls.length,
  };
}

export function listAgentTelephonyDashboardRows(currentAgentName) {
  ensureDemoTelephonyTicker();
  seedDemoTelephonyDashboard(currentAgentName);
  return getAgentNamesList()
    .filter((name) => name !== currentAgentName)
    .map((name) => ({
      agentName: name,
      statusKey: resolveAgentTelephonyDisplayKey(name, currentAgentName),
    }));
}

export function resolveAgentTelephonyDisplayKey(agentName, currentAgentName = "") {
  if (!agentName) return AGENT_TELEPHONY_STATUS.offline.key;
  if (isActiveCallForAgent(agentName)) return AGENT_TELEPHONY_STATUS.on_call.key;
  if (demoModeEnabled && demoOnCallAgents.has(agentName)) {
    return AGENT_TELEPHONY_STATUS.on_call.key;
  }
  if (agentName === currentAgentName) {
    return getAgentTelephonyStatus(agentName);
  }
  const { agentStatusByName } = readPersisted();
  const stored = agentStatusByName[agentName];
  if (stored && AGENT_TELEPHONY_STATUS[stored] && stored !== AGENT_TELEPHONY_STATUS.on_call.key) {
    return stored;
  }
  return AGENT_TELEPHONY_STATUS.offline.key;
}

export function getAgentTelephonyStatus(agentName) {
  if (!agentName) return AGENT_TELEPHONY_STATUS.offline.key;
  const currentHint = getCurrentAgentNameHint();
  if (agentName === currentHint && !isAgentTelephonyConnected()) {
    return AGENT_TELEPHONY_STATUS.offline.key;
  }
  const { agentStatusByName } = readPersisted();
  const stored = agentStatusByName[agentName];
  if (stored && AGENT_TELEPHONY_STATUS[stored] && stored !== AGENT_TELEPHONY_STATUS.on_call.key) {
    return stored;
  }
  if (agentName === currentHint && isAgentTelephonyConnected()) {
    return AGENT_TELEPHONY_STATUS.available.key;
  }
  return AGENT_TELEPHONY_STATUS.offline.key;
}

export function setAgentTelephonyStatus(agentName, statusKey) {
  if (!agentName) return;
  const { agentStatusByName } = readPersisted();
  const next = { ...agentStatusByName, [agentName]: statusKey };
  writePersisted({ agentStatusByName: next });
  if (statusKey === AGENT_TELEPHONY_STATUS.offline.key) {
    setAgentTelephonyConnected(false);
    if (shouldUseRealSip()) {
      disconnectSip().finally(() => emitChange());
    }  if (demoModeEnabled) seedDemoTelephonyDashboard(agentName);
}

export { stopDemoTelephonyTicker };
