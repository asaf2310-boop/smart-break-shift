import { eachDayOfInterval } from "date-fns";
import { parseDateStrLocal, resolveToCanonicalAgentName } from "@/constants/scheduling";

export function enumerateDateStrs(fromStr, toStr) {
  const start = parseDateStrLocal(fromStr);
  const end = parseDateStrLocal(toStr);
  if (end < start) return [];
  return eachDayOfInterval({ start, end }).map((d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
}

function areConsecutiveDates(endDate, nextDate) {
  return enumerateDateStrs(endDate, nextDate).length === 2;
}

/**
 * Groups per-day vacation rows into consecutive ranges with the same agent, status, and note.
 */
export function groupVacationRequests(requests) {
  const sorted = [...requests].sort((a, b) => {
    const agentCmp = resolveToCanonicalAgentName(a.agent_name).localeCompare(
      resolveToCanonicalAgentName(b.agent_name),
      "he"
    );
    if (agentCmp !== 0) return agentCmp;
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return a.date.localeCompare(b.date);
  });

  const groups = [];
  let current = null;

  for (const req of sorted) {
    const agentName = resolveToCanonicalAgentName(req.agent_name);
    const note = req.note || "";

    if (
      current &&
      current.agentName === agentName &&
      current.status === req.status &&
      current.note === note &&
      areConsecutiveDates(current.endDate, req.date)
    ) {
      current.endDate = req.date;
      current.ids.push(req.id);
      continue;
    }

    current = {
      agentName,
      status: req.status,
      note,
      startDate: req.date,
      endDate: req.date,
      ids: [req.id],
    };
    groups.push(current);
  }

  return groups;
}

export function formatVacationDateRange(startDate, endDate, formatDate) {
  if (startDate === endDate) {
    return formatDate(startDate);
  }
  return `מ ${formatDate(startDate)} עד ${formatDate(endDate)}`;
}
