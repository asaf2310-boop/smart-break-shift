import { demoModeEnabled } from "@/api/demoClient";
import { createCallLog, crmDemoAvailable } from "@/lib/crmStore";
import { getAgentNamesList } from "@/constants/scheduling";

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

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export const AGENT_TELEPHONY_STATUS = {
  available: { key: "available", label: "זמין", tone: "emerald" },
  lunch: { key: "lunch", label: "הפסקת צהריים", tone: "amber" },
  short_break: { key: "short_break", label: "הפסקת 10", tone: "amber" },
  comfort: { key: "comfort", label: "נוחיות", tone: "sky" },
  on_call: { key: "on_call", label: "בשיחה", tone: "rose" },
  offline: { key: "offline", label: "לא מחובר", tone: "slate" },
};

const DEMO_STATUS_KEYS = [
  AGENT_TELEPHONY_STATUS.available.key,
  AGENT_TELEPHONY_STATUS.lunch.key,
  AGENT_TELEPHONY_STATUS.short_break.key,
  AGENT_TELEPHONY_STATUS.comfort.key,
  AGENT_TELEPHONY_STATUS.offline.key,
];

const DEMO_QUEUE_PHONES = [
  { phone: "050-2148871", customer_name: "לקוח בתור" },
  { phone: "052-9081123", customer_name: "פנייה חוזרת" },
  { phone: "03-5550198", customer_name: null },
  { phone: "054-7712044", customer_name: "שירות — חשבון" },
];

let demoTickerId = null;
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
    queueCalls = DEMO_QUEUE_PHONES.slice(0, 2).map((row, index) => ({
      id: `queue_seed_${index}`,
      phone: row.phone,
      customer_name: row.customer_name,
      waiting_seconds: 35 + index * 22,
    }));
    changed = true;
  }

  if (
    !centerStats.incoming &&
    !centerStats.answered &&
    !centerStats.abandoned
  ) {
    centerStats = {
      incoming: 18,
      answered: 11,
      abandoned: 2,
      waiting: queueCalls.length,
    };
    changed = true;
  }

  if (changed) {
    writePersisted({ agentStatusByName: nextStatus, queueCalls, centerStats });
  } else {
    syncCenterWaiting();
  }

  if (!demoOnCallAgents.size && agents.length) {
    demoOnCallAgents = new Set([agents[0]]);
  }
}

function tickDemoTelephonyDashboard() {
  if (!demoModeEnabled) return;

  const data = readPersisted();
  const agents = getAgentNamesList();

  if (Math.random() < 0.35 && agents.length) {
    const pick = agents[Math.floor(Math.random() * agents.length)];
    if (!isActiveCallForAgent(pick)) {
      if (Math.random() < 0.5) demoOnCallAgents.add(pick);
      else demoOnCallAgents.delete(pick);
    }
  }

  let queueCalls = data.queueCalls.map((row) => ({
    ...row,
    waiting_seconds: (row.waiting_seconds || 0) + 4,
  }));

  let centerStats = { ...data.centerStats };

  if (Math.random() < 0.2 && queueCalls.length < 5) {
    const template =
      DEMO_QUEUE_PHONES[Math.floor(Math.random() * DEMO_QUEUE_PHONES.length)];
    queueCalls.push({
      id: makeId("queue"),
      phone: template.phone,
      customer_name: template.customer_name,
      waiting_seconds: 8,
    });
    centerStats.incoming += 1;
  } else if (Math.random() < 0.18 && queueCalls.length) {
    queueCalls.shift();
    if (Math.random() < 0.55) centerStats.answered += 1;
    else centerStats.abandoned += 1;
  }

  if (Math.random() < 0.25) centerStats.incoming += 1;

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

export function listTelephonyCallLogs(limit = 30) {
  const { callLogs } = readPersisted();
  return [...callLogs]
    .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
    .slice(0, limit);
}

export function isDocked() {
  return readPersisted().docked;
}

export function setDocked(docked) {
  writePersisted({ docked: Boolean(docked) });
}

function appendCallLog(entry) {
  const { callLogs } = readPersisted();
  writePersisted({ callLogs: [entry, ...callLogs].slice(0, 100) });
}

function setActive(patch) {
  activeCall = activeCall ? { ...activeCall, ...patch } : { ...patch };
  emitChange();
}

function finishCall({ durationSeconds = 0, answered = true } = {}) {
  if (!activeCall) return;
  clearPhaseTimer();

  const endedAt = new Date().toISOString();
  const log = {
    id: activeCall.id || makeId("tel"),
    direction: activeCall.direction,
    phone: activeCall.phone,
    status: CALL_STATUS.ended.value,
    customer_id: activeCall.customer_id || null,
    customer_name: activeCall.customer_name || null,
    agent_name: activeCall.agent_name || null,
    started_at: activeCall.started_at,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    answered,
    simulated: true,
  };

  appendCallLog(log);

  if (demoModeEnabled) {
    if (activeCall.direction === "inbound") {
      if (answered) bumpCenterStat("answered");
      else bumpCenterStat("abandoned");
    }
    if (activeCall.agent_name) demoOnCallAgents.delete(activeCall.agent_name);
    syncCenterWaiting();
  }

  if (
    crmDemoAvailable() &&
    activeCall.customer_id &&
    answered &&
    durationSeconds >= 0
  ) {
    try {
      const mins = Math.max(1, Math.round(durationSeconds / 60) || 1);
      createCallLog({
        customer_id: activeCall.customer_id,
        call_type: activeCall.direction === "inbound" ? "incoming" : "outgoing",
        summary: `שיחה מדומה (${activeCall.phone})`,
        agent_name: activeCall.agent_name || "נציג",
        duration_minutes: mins,
        occurred_at: activeCall.connected_at || activeCall.started_at,
      });
    } catch {
      /* CRM unavailable outside demo */
    }
  }

  setActive({
    status: CALL_STATUS.ended.value,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
  });

  phaseTimer = setTimeout(() => {
    activeCall = null;
    emitChange();
  }, 900);
}

function runOutboundPhases() {
  if (!activeCall || activeCall.direction !== "outbound") return;

  setActive({ status: CALL_STATUS.dialing.value });
  phaseTimer = setTimeout(() => {
    if (!activeCall) return;
    setActive({ status: CALL_STATUS.ringing.value });
    phaseTimer = setTimeout(() => {
      if (!activeCall) return;
      const connectedAt = new Date().toISOString();
      setActive({
        status: CALL_STATUS.connected.value,
        connected_at: connectedAt,
        muted: false,
      });
    }, RING_MS);
  }, DIAL_MS);
}

function runInboundPhases() {
  if (!activeCall || activeCall.direction !== "inbound") return;
  setActive({ status: CALL_STATUS.ringing.value });
  phaseTimer = setTimeout(() => {
    if (!activeCall) return;
    const connectedAt = new Date().toISOString();
    setActive({
      status: CALL_STATUS.connected.value,
      connected_at: connectedAt,
      muted: false,
    });
  }, RING_MS + CONNECT_AFTER_RING_MS);
}

/**
 * Start simulated outbound call (demo only).
 */
export function startOutboundCall({
  phone,
  agentName,
  customer_id = null,
  customer_name = null,
} = {}) {
  if (!demoModeEnabled) {
    throw new Error("שיחות מדומות זמינות רק ב-VITE_DEMO_MODE");
  }
  const normalized = String(phone || "").replace(/\s/g, "").trim();
  if (!normalized) throw new Error("הזינו מספר טלפון");

  if (activeCall && activeCall.status !== CALL_STATUS.ended.value) {
    hangUp();
  }

  clearPhaseTimer();
  const startedAt = new Date().toISOString();
  if (demoModeEnabled) {
    bumpCenterStat("incoming");
    demoOnCallAgents.add(agentName || getCurrentAgentNameHint());
  }

  activeCall = {
    id: makeId("tel_active"),
    direction: "outbound",
    phone: normalized,
    status: CALL_STATUS.dialing.value,
    customer_id,
    customer_name,
    agent_name: agentName || null,
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
export function simulateInboundCall({
  phone = "050-0000000",
  agentName,
  customer_id = null,
  customer_name = "לקוח דמו",
} = {}) {
  if (!demoModeEnabled) {
    throw new Error("שיחות מדומות זמינות רק ב-VITE_DEMO_MODE");
  }
  if (activeCall && ![CALL_STATUS.ended.value, CALL_STATUS.idle.value].includes(activeCall.status)) {
    return getActiveCall();
  }

  clearPhaseTimer();
  const startedAt = new Date().toISOString();
  if (demoModeEnabled) {
    bumpCenterStat("incoming");
    demoOnCallAgents.add(agentName || getCurrentAgentNameHint());
  }

  activeCall = {
    id: makeId("tel_active"),
    direction: "inbound",
    phone: String(phone).trim(),
    status: CALL_STATUS.ringing.value,
    customer_id,
    customer_name,
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

export function answerInbound() {
  if (!activeCall || activeCall.direction !== "inbound") return null;
  if (activeCall.status === CALL_STATUS.connected.value) return getActiveCall();
  clearPhaseTimer();
  const connectedAt = new Date().toISOString();
  setActive({
    status: CALL_STATUS.connected.value,
    connected_at: connectedAt,
  });
  return getActiveCall();
}

export function hangUp() {
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
}

export function toggleMute() {
  if (!activeCall || activeCall.status !== CALL_STATUS.connected.value) return false;
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
  } else {
    setAgentTelephonyConnected(true);
  }
}

export function connectAgentTelephonyAvailable(agentName) {
  setAgentTelephonyConnected(true);
  setAgentTelephonyStatus(agentName, AGENT_TELEPHONY_STATUS.available.key);
  if (demoModeEnabled) seedDemoTelephonyDashboard(agentName);
}

export { stopDemoTelephonyTicker };
