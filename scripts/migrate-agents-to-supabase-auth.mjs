/**
 * CLI — migrate agents from password_plain to Supabase Auth.
 *   node scripts/migrate-agents-to-supabase-auth.mjs
 *   node scripts/migrate-agents-to-supabase-auth.mjs --dry-run
 *
 * Requires .env: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getSupabaseAdmin, isPgVectorConfigured } from "../server/knowledge/supabaseAdmin.js";
import {
  adminUpdateAgentPassword,
  provisionAuthUserForAgent,
} from "../server/agent/agentAuthService.js";

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

function mapAgent(row) {
  return {
    id: row.id,
    email: row.email || "",
    displayName: row.display_name,
    authUserId: row.auth_user_id || null,
  };
}

async function main() {
  loadEnvFile();

  const dryRun = process.argv.includes("--dry-run");

  if (!isPgVectorConfigured()) {
    console.error("Missing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("agents")
    .select("id, email, display_name, auth_user_id, password_plain, active, deleted_at")
    .not("password_plain", "is", null);

  if (error) {
    console.error("Failed to load agents:", error.message);
    process.exit(1);
  }

  const candidates = (rows || []).filter((r) => {
    const email = String(r.email || "").trim().toLowerCase();
    return email && !email.endsWith("@pending.local") && String(r.password_plain || "").length >= 6;
  });

  console.log(`Found ${candidates.length} agent(s) with password_plain to migrate`);
  if (!candidates.length) {
    console.log("Nothing to do.");
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const row of candidates) {
    const agent = mapAgent(row);
    const password = String(row.password_plain);
    const label = `${agent.displayName} <${agent.email}>`;

    if (dryRun) {
      console.log(`[dry-run] would migrate ${label}`);
      ok += 1;
      continue;
    }

    try {
      const provisioned = await provisionAuthUserForAgent(agent, password);
      if (provisioned.authUserId && provisioned.authUserId !== agent.authUserId) {
        await adminUpdateAgentPassword(provisioned.authUserId, password);
      } else if (provisioned.authUserId) {
        await adminUpdateAgentPassword(provisioned.authUserId, password);
      }

      const { error: clearErr } = await supabase
        .from("agents")
        .update({ password_plain: null, needs_password_setup: false })
        .eq("id", agent.id);

      if (clearErr) throw clearErr;

      console.log(`OK ${label} → auth_user_id=${provisioned.authUserId}`);
      ok += 1;
    } catch (err) {
      console.error(`FAIL ${label}:`, err.message || err);
      failed += 1;
    }
  }

  console.log(`Done. success=${ok} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
