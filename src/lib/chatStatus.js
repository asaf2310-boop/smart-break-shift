import { CHAT_STATUS } from "@/lib/agentChatPresence";

export const OFFLINE_AFTER_MS = 2 * 60 * 1000;

function parseSlotToMinutes(slot) {
  const [start, end] = String(slot || "").split("-");
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return null;
  return { start: sh * 60 + sm, end: eh * 60 + em };
}

function isAgentOnBreakNow(agentName, breakRegistrations, now) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return breakRegistrations.some((row) => {
    if (row.agent_name !== agentName) return false;
    const slot = parseSlotToMinutes(row.time_slot);
    if (!slot) return false;
    return nowMinutes >= slot.start && nowMinutes < slot.end;
  });
}

function isPresenceStale(presence, now) {
  if (!presence?.last_seen_at) return true;
  const delta = now.getTime() - new Date(presence.last_seen_at).getTime();
  return delta > OFFLINE_AFTER_MS;
}

export function resolveAgentStatus(agentName, presenceMap, breakRegistrations, now = new Date()) {
  const presence = presenceMap.get(agentName);
  const explicit = presence?.status;

  if (explicit === CHAT_STATUS.offline.key) {
    return CHAT_STATUS.offline;
  }

  if (!presence?.last_seen_at || isPresenceStale(presence, now)) {
    return CHAT_STATUS.offline;
  }

  if (explicit === CHAT_STATUS.break.key) {
    return CHAT_STATUS.break;
  }

  if (explicit === CHAT_STATUS.available.key) {
    return CHAT_STATUS.available;
  }

  if (isAgentOnBreakNow(agentName, breakRegistrations, now)) {
    return CHAT_STATUS.break;
  }

  return CHAT_STATUS.available;
}

export function statusDotClass(tone) {
  if (tone === "emerald") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-400";
  if (tone === "red") return "bg-red-500";
  return "bg-slate-400";
}
