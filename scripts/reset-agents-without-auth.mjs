/**
 * Reset agents without a valid Supabase Auth user → first-login required.
 *
 *   node scripts/reset-agents-without-auth.mjs --dry-run
 *   node scripts/reset-agents-without-auth.mjs
 *   node scripts/reset-agents-without-auth.mjs --name "אורפז דאבוש"
 *
 * Requires .env: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getSupabaseAdmin, isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import { resolveAgentAuthUser } from "../server/agent/agentAuthService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnvFile() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return "";
  return String(process.argv[idx + 1] || "").trim();
}

function mapAgent(row) {
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name,
    authUserId: row.auth_user_id || null,
    needsPasswordSetup: row.needs_password_setup === true,
    active: row.active !== false && !row.deleted_at,
    blocked: row.blocked === true,
  };
}

async function main() {
  loadEnvFile();

  const dryRun = process.argv.includes("--dry-run");
  const nameFilter = getArg("--name");

  if (!isPgVectorConfigured()) {
    console.error("Missing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("agents")
    .select("id, email, display_name, auth_user_id, needs_password_setup, active, blocked, deleted_at")
    .is("deleted_at", null);

  if (nameFilter) {
    query = query.ilike("display_name", `%${nameFilter}%`);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("Failed to load agents:", error.message);
    process.exit(1);
  }

  const agents = (rows || []).map(mapAgent).filter((a) => a.active && !a.blocked);
  console.log(`Checking ${agents.length} active agent(s)...`);

  let resetCount = 0;
  let okCount = 0;

  for (const agent of agents) {
    const label = `${agent.displayName || "(no name)"} <${agent.email || "no-email"}>`;
    const authState = await resolveAgentAuthUser(agent);

    if (authState.exists && agent.authUserId && !agent.needsPasswordSetup) {
      console.log(`OK   ${label} — linked to Auth`);
      okCount += 1;
      continue;
    }

    const reason = !authState.exists
      ? "no Supabase Auth user"
      : agent.needsPasswordSetup
        ? "needs_password_setup still true"
        : "auth_user_id missing or stale";

    if (dryRun) {
      console.log(`[dry-run] RESET ${label} — ${reason}`);
      resetCount += 1;
      continue;
    }

    const { error: updateErr } = await supabase
      .from("agents")
      .update({ needs_password_setup: true, auth_user_id: null })
      .eq("id", agent.id);

    if (updateErr) {
      console.error(`FAIL ${label}:`, updateErr.message);
      continue;
    }

    console.log(`RESET ${label} — ${reason}`);
    resetCount += 1;
  }

  console.log(`Done. linked=${okCount} reset=${resetCount}${dryRun ? " (dry-run)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
