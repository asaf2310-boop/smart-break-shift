import { AGENT_TELEPHONY_STATUS } from "@/lib/telephonyStore";

export function resolveTelephonyStatus(statusKey, connected = true) {
  if (!connected || statusKey === AGENT_TELEPHONY_STATUS.offline.key) {
    return AGENT_TELEPHONY_STATUS.offline;
  }
  return AGENT_TELEPHONY_STATUS[statusKey] || AGENT_TELEPHONY_STATUS.available;
}

export function telephonyStatusDotClass(tone) {
  if (tone === "emerald") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-400";
  if (tone === "sky") return "bg-sky-500";
  if (tone === "rose") return "bg-rose-500 animate-pulse";
  if (tone === "slate") return "bg-slate-400";
  return "bg-slate-400";
}

export function resolveTelephonyDisplayMeta(statusKey, connected = true) {
  if (statusKey === AGENT_TELEPHONY_STATUS.on_call.key) {
    return AGENT_TELEPHONY_STATUS.on_call;
  }
  return resolveTelephonyStatus(statusKey, connected);
}
