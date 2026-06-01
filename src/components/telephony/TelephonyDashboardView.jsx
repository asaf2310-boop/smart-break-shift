import React, { useCallback, useEffect, useState } from "react";
import { LayoutDashboard, Users, PhoneIncoming, BarChart3, ChevronDown } from "lucide-react";
import {
  AGENT_TELEPHONY_STATUS,
  getCenterStats,
  getQueueCalls,
  listAgentTelephonyDashboardRows,
  subscribeTelephony,
} from "@/lib/telephonyStore";
import {
  resolveTelephonyDisplayMeta,
  telephonyStatusDotClass,
} from "@/lib/telephonyStatus";

function formatQueueWait(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 1) return `${s} שנ׳`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const LONG_WAIT_SEC = 60;

function queueWaitTone(maxWaitSec, hasWaiting) {
  if (!hasWaiting) return "neutral";
  if (maxWaitSec >= LONG_WAIT_SEC) return "urgent";
  return "warn";
}

const WAIT_TONE = {
  neutral: {
    card: "border-outline/20 bg-surface-container-low",
    count: "text-foreground",
    label: "text-on-surface-variant",
  },
  warn: {
    card: "border-amber-300/80 bg-amber-50 shadow-sm shadow-amber-200/40",
    count: "text-amber-950",
    label: "text-amber-900",
  },
  urgent: {
    card: "border-red-300/80 bg-red-50 shadow-sm shadow-red-200/40",
    count: "text-red-950 animate-pulse",
    label: "text-red-900",
  },
};

export default function TelephonyDashboardView({ agentName, isDemo }) {
  const [agents, setAgents] = useState(() =>
    listAgentTelephonyDashboardRows(agentName)
  );
  const [queue, setQueue] = useState(() => getQueueCalls());
  const [stats, setStats] = useState(() => getCenterStats());
  const [agentsOpen, setAgentsOpen] = useState(false);

  const refresh = useCallback(() => {
    setAgents(listAgentTelephonyDashboardRows(agentName));
    setQueue(getQueueCalls());
    setStats(getCenterStats());
  }, [agentName]);

  useEffect(() => subscribeTelephony(refresh), [refresh]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const waitingCount = stats.waiting ?? queue.length;
  const maxWaitSec = queue.reduce(
    (max, row) => Math.max(max, row.waiting_seconds || 0),
    0
  );
  const waitTone = WAIT_TONE[queueWaitTone(maxWaitSec, waitingCount > 0)];

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-4 h-4 text-teal-700 shrink-0" />
        <p className="m3-label-medium text-on-surface-variant">דשבורד מוקד</p>
        {isDemo && (
          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full mr-auto">
            סימולציה חיה
          </span>
        )}
      </div>

      <section
        className={`rounded-2xl border-2 px-4 py-4 ${waitTone.card}`}
        aria-live="polite"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <PhoneIncoming
            className={`w-5 h-5 shrink-0 ${
              waitingCount > 0 ? "text-amber-600 animate-pulse" : "text-on-surface-variant"
            }`}
          />
          <p className={`text-sm font-bold ${waitTone.label}`}>ממתינות כרגע</p>
        </div>
        <p
          className={`text-center text-5xl font-extrabold tabular-nums leading-none ${waitTone.count}`}
        >
          {waitingCount}
        </p>
        {waitingCount > 0 && maxWaitSec > 0 && (
          <p className={`text-center text-[11px] mt-2 font-semibold ${waitTone.label}`}>
            המתנה ארוכה ביותר: {formatQueueWait(maxWaitSec)}
          </p>
        )}

        {queue.length === 0 ? (
          <p className="text-xs text-on-surface-variant text-center mt-3 py-2 rounded-xl bg-white/50">
            אין שיחות בתור
          </p>
        ) : (
          <ul className="space-y-1 mt-3 max-h-32 overflow-y-auto">
            {queue.map((row) => {
              const sec = row.waiting_seconds || 0;
              const rowUrgent = sec >= LONG_WAIT_SEC;
              return (
                <li
                  key={row.id}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                    rowUrgent
                      ? "border-red-200/80 bg-red-50/90"
                      : "border-amber-200/60 bg-white/70"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
                      rowUrgent ? "bg-red-500" : "bg-amber-400"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold text-foreground truncate" dir="ltr">
                      {row.phone}
                    </p>
                    {row.customer_name && (
                      <p className="text-[10px] text-on-surface-variant truncate">
                        {row.customer_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] shrink-0 tabular-nums font-bold ${
                      rowUrgent ? "text-red-800" : "text-amber-900"
                    }`}
                  >
                    {formatQueueWait(sec)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-outline/10 bg-surface-container-low/60 px-2 py-2">
        <div className="flex items-center justify-center gap-1 mb-1.5">
          <BarChart3 className="w-3 h-3 text-on-surface-variant" />
          <p className="text-[10px] font-semibold text-on-surface-variant">סיכום מוקד (היום)</p>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div className="rounded-lg border border-outline/10 bg-surface-container-lowest px-1.5 py-1.5 text-center">
            <p className="text-[9px] text-on-surface-variant">נכנסות</p>
            <p className="text-sm font-bold tabular-nums text-foreground">{stats.incoming}</p>
          </div>
          <div className="rounded-lg border border-emerald-200/50 bg-emerald-50/60 px-1.5 py-1.5 text-center">
            <p className="text-[9px] text-emerald-800">נענות</p>
            <p className="text-sm font-bold tabular-nums text-emerald-900">{stats.answered}</p>
          </div>
          <div className="rounded-lg border border-amber-200/50 bg-amber-50/60 px-1.5 py-1.5 text-center">
            <p className="text-[9px] text-amber-900">ננטשות</p>
            <p className="text-sm font-bold tabular-nums text-amber-950">{stats.abandoned}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-outline/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setAgentsOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 px-2 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low/80"
          aria-expanded={agentsOpen}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-right">נציגים במוקד ({agents.length})</span>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${agentsOpen ? "rotate-180" : ""}`}
          />
        </button>
        {agentsOpen && (
          <div className="px-2 pb-2 border-t border-outline/10">
            {agents.length === 0 ? (
              <p className="text-[10px] text-on-surface-variant text-center py-2">
                אין נציגים נוספים
              </p>
            ) : (
              <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                {agents.map(({ agentName: name, statusKey }) => {
                  const meta =
                    resolveTelephonyDisplayMeta(
                      statusKey,
                      statusKey !== AGENT_TELEPHONY_STATUS.offline.key
                    ) || AGENT_TELEPHONY_STATUS.offline;
                  return (
                    <li
                      key={name}
                      className="flex items-center gap-2 py-0.5 px-1 rounded-lg hover:bg-surface-container-low/80"
                    >
                      <span
                        className={`w-1.5 h-1.5 shrink-0 rounded-full ${telephonyStatusDotClass(meta.tone)}`}
                        aria-hidden
                      />
                      <span className="text-[11px] font-semibold text-foreground truncate flex-1">
                        {name}
                      </span>
                      <span className="text-[9px] text-on-surface-variant shrink-0">
                        {meta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
