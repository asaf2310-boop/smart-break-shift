import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { History, Loader2 } from "lucide-react";
import {
  formatReferralEventSummary,
  getReferralEventLabel,
  listReferralEvents,
} from "@/lib/crmStore";
import { cn } from "@/lib/utils";

const EVENT_COLORS = {
  created: "from-emerald-500 to-teal-600",
  assigned: "from-indigo-500 to-blue-600",
  claimed: "from-violet-500 to-purple-600",
  closed: "from-slate-500 to-slate-600",
  reopened: "from-amber-500 to-orange-600",
  comment: "from-cyan-500 to-sky-600",
  priority_changed: "from-pink-500 to-rose-600",
};

function formatDt(iso) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yy HH:mm");
  } catch {
    return "—";
  }
}

export default function ReferralEventsTimeline({
  referralId,
  compact = false,
  className,
  title = "יומן אירועים",
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReferralEvents(referralId)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [referralId]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-on-surface-variant py-2", className)}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        טוען יומן...
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className={cn("text-xs text-on-surface-variant py-2", className)}>
        אין אירועים מתועדים לפניה זו
      </p>
    );
  }

  return (
    <div className={cn(compact ? "mt-2" : "mt-3", className)} dir="rtl">
      {!compact && (
        <h4 className="text-xs font-semibold text-on-surface-variant mb-2 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          {title}
        </h4>
      )}
      <div className={cn("relative pr-3 border-r-2 border-outline/20", compact ? "space-y-2" : "space-y-3")}>
        {events.map((event, i) => {
          const gradient = EVENT_COLORS[event.event_type] || EVENT_COLORS.comment;
          const summary = formatReferralEventSummary(event);
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative mr-3"
            >
              <span
                className={cn(
                  "absolute -right-[17px] top-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br ring-2 ring-surface-container-lowest",
                  gradient
                )}
              />
              <div
                className={cn(
                  "rounded-xl border border-outline/15 bg-surface-container-lowest",
                  compact ? "px-2.5 py-2" : "px-3 py-2.5"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-primary">
                    {getReferralEventLabel(event.event_type)}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">{formatDt(event.created_at)}</span>
                </div>
                {summary && (
                  <p className={cn("text-xs text-on-surface leading-relaxed", compact && "line-clamp-2")}>
                    {summary}
                  </p>
                )}
                {event.actor_name && (
                  <p className="text-[10px] text-on-surface-variant mt-1">מבצע: {event.actor_name}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
