import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "@/api/supabase";
import { demoModeEnabled, DEMO_STORE_KEY } from "@/api/demoClient";

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
};

function invalidateByPrefixes(queryClient, prefixes) {
  if (!prefixes?.length) return;
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
      const refresh = () => queryClient.invalidateQueries();
      const onStorage = (event) => {
        if (event.key === DEMO_STORE_KEY) refresh();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener("demo-store-changed", refresh);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("demo-store-changed", refresh);
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
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
