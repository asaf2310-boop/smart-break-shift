/** שם פרטי לתצוגה ללקוח (מלא או רק מילה ראשונה). */
export function getAgentFirstName(agentName) {
  const trimmed = String(agentName || "").trim();
  if (!trimmed) return "הנציג";
  const first = trimmed.split(/\s+/).filter(Boolean)[0];
  return first || "הנציג";
}
