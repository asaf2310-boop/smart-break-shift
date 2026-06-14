import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "@/api/supabase";
import { demoModeEnabled, DEMO_STORE_KEY } from "@/api/demoClient";
import { CHAT_BRANDING_STORAGE_KEY } from "@/lib/chatBranding";
import { clearAllScheduleCaches } from "@/lib/shiftScheduleQuery";

/** מפתחות react-query שמתעדכנים לפי טבלה ב-Supabase */
const TABLE_QUERY_PREFIXES = {
  break_registrations: ["break-registrations", "break-day"],
  break_settings: ["break-settings", "break-day"],
  shift_registrations: [
    "shift-registrations",
    "published-regs-editor",
    "shift-registrations-builder",
  ],
  shift_unavailabilities: [
    "shift-unavailabilities",
    "all-unavailabilities-week",
    "shift-unavailabilities-builder",
  ],
  vacation_requests: [
    "vacation-requests",
    "vacation-requests-admin",
    "all-vac-view",
    "vacation-requests-builder",
  ],
  constraint_confirmations: [
    "constraint-confirmations",
    "all-confirmations",
    "confirmations-builder",
  ],
  constraints_week_settings: ["constraints-week-settings"],
  chat_messages: ["chat-messages"],
  chat_presence: ["chat-presence"],
  chat_settings: ["chat-branding"],
  training_schedule_settings: ["training-schedule"],
  training_presentation_meta: ["training-presentation-meta"],
};

const TRAINING_REALTIME_HANDLERS = {
  training_schedule_settings: () => {
    import("@/lib/trainingScheduleStore").then(({ invalidateTrainingScheduleCache }) => {
      invalidateTrainingScheduleCache();
    });
  },
  training_presentation_meta: () => {
    import("@/lib/trainingPresentations").then(({ invalidateTrainingPresentationCache }) => {
      invalidateTrainingPresentationCache();
    });
  },
};

function invalidateByPrefixes(queryClient, prefixes) {
  if (!prefixes?.length) return;
  if (prefixes.includes("shift-registrations")) {
    clearAllScheduleCaches();
  }
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey?.[0];
      return typeof key === "string" && prefixes.includes(key);
    },
  });
}

/**
 * מסנכרן שינויים בין ממשק נציג לאדמין (ובין טאבים):
 * - Supabase Realtime כשזמין
 * - אירוע storage במצב דמו
 */
export function useLiveDataSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (demoModeEnabled) {
      const refresh = () => {
        clearAllScheduleCaches();
        queryClient.invalidateQueries();
      };
      const onStorage = (event) => {
        if (event.key === DEMO_STORE_KEY || event.key === CHAT_BRANDING_STORAGE_KEY) refresh();
      };
      const onBranding = () => {
        queryClient.invalidateQueries({ queryKey: ["chat-branding"] });
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener("demo-store-changed", refresh);
      window.addEventListener("local-chat-changed", refresh);
      window.addEventListener("chat-branding-changed", onBranding);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("demo-store-changed", refresh);
        window.removeEventListener("local-chat-changed", refresh);
        window.removeEventListener("chat-branding-changed", onBranding);
      };
    }

    if (!supabaseConfigured || !supabase) return undefined;

    const channel = supabase.channel("smart-break-live-sync");

    for (const table of Object.keys(TABLE_QUERY_PREFIXES)) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          invalidateByPrefixes(queryClient, TABLE_QUERY_PREFIXES[table]);
          TRAINING_REALTIME_HANDLERS[table]?.();
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
