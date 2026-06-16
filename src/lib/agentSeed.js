import { dataClient } from "@/api/client";
import { demoModeEnabled } from "@/api/demoClient";
import { isSupabaseBackend } from "@/api/dataClient";
import { DEFAULT_AGENT_MODULES } from "@/constants/agentModules";
import { REAL_AGENT_NAMES } from "@/constants/scheduling";
import { fetchAgentsFromSupabase } from "@/lib/agentsSupabase";

function pendingEmail(index) {
  return `agent-${index + 1}@pending.local`;
}

/**
 * אם טבלת agents ריקה — מזין את רשימת הנציגים מהשיבוץ.
 * אימייל placeholder עד עריכה במנהל.
 */
export async function ensureAgentsSeeded() {
  if (demoModeEnabled || !isSupabaseBackend() || !dataClient.entities.Agent) {
    return { seeded: 0, skipped: true };
  }

  try {
    const existing = await fetchAgentsFromSupabase({ activeOnly: true, limit: 10 });
    if (existing.length > 0) {
      return { seeded: 0, skipped: false };
    }

    const rows = REAL_AGENT_NAMES.map((displayName, index) => ({
      email: pendingEmail(index),
      display_name: displayName,
      active: true,
      blocked: false,
      needs_password_setup: true,
      modules: [...DEFAULT_AGENT_MODULES],
    }));

    await dataClient.entities.Agent.bulkCreate(rows);
    return { seeded: rows.length, skipped: false };
  } catch (err) {
    console.warn("[agentSeed] ensureAgentsSeeded failed", err);
    return { seeded: 0, skipped: true, error: err?.message || String(err) };
  }
}
