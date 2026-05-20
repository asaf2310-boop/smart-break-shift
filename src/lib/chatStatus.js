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

export function resolveAgentStatus(agentName, presenceMap, breakRegistrations, now = new Date()) {
  const presence = presenceMap.get(agentName);
  if (!presence?.last_seen_at) {
    return { key: "offline", label: "לא מחובר", tone: "slate" };
  }

  const delta = now.getTime() - new Date(presence.last_seen_at).getTime();
  if (delta > OFFLINE_AFTER_MS) {
    return { key: "offline", label: "לא מחובר", tone: "slate" };
  }

  if (isAgentOnBreakNow(agentName, breakRegistrations, now)) {
    return { key: "break", label: "בהפסקה", tone: "amber" };
  }

  return { key: "available", label: "זמין", tone: "emerald" };
}

export function statusClass(tone) {
  if (tone === "emerald") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (tone === "amber") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}
