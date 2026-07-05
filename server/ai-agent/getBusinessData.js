import { getSupabaseAdmin } from "../knowledge/supabaseAdmin.js";

/** @typedef {{ table: string, filters?: Record<string, unknown>, limit?: number }} GetBusinessDataArgs */

export const ALLOWED_TABLES = ["customers", "appointments", "tickets", "services"];

/** @type {Record<string, string[]>} */
export const ALLOWED_COLUMNS = {
  customers: ["id", "name", "email", "phone", "status", "created_at", "updated_at"],
  appointments: [
    "id",
    "customer_id",
    "service_id",
    "scheduled_at",
    "status",
    "notes",
    "created_at",
    "updated_at",
  ],
  tickets: ["id", "customer_id", "subject", "status", "priority", "created_at", "updated_at"],
  services: ["id", "name", "description", "price", "duration_minutes", "active", "created_at"],
};

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const SAFE_VALUE_RE = /^[\w\s@.\-+:/(),א-ת]{0,200}$/u;

const TABLE_MISSING_RE =
  /relation.*does not exist|schema cache|could not find the table|pgrst205|42p01/i;

function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || "").toUpperCase();
  if (code === "PGRST205" || code === "42P01") return true;
  return TABLE_MISSING_RE.test(String(error.message || ""));
}

function isSafeFilterValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number" && Number.isFinite(value)) return true;
  if (typeof value === "boolean") return true;
  if (typeof value === "string") return SAFE_VALUE_RE.test(value);
  return false;
}

/**
 * @param {Record<string, unknown> | undefined} filters
 * @param {string} table
 */
function sanitizeFilters(filters, table) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return {};
  }
  const allowedCols = new Set(ALLOWED_COLUMNS[table] || []);
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    const col = String(key || "").trim();
    if (!col || !allowedCols.has(col)) continue;
    if (!isSafeFilterValue(value)) continue;
    out[col] = value;
  }
  return out;
}

/**
 * Read-only Supabase query for whitelisted tables.
 * @param {GetBusinessDataArgs} args
 */
export async function getBusinessData(args) {
  const table = String(args?.table || "").trim();
  if (!ALLOWED_TABLES.includes(table)) {
    return {
      ok: false,
      error: "table_not_allowed",
      message: `טבלה לא מורשית: ${table || "(ריק)"}. מותר: ${ALLOWED_TABLES.join(", ")}`,
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      error: "supabase_not_configured",
      message: "חיבור Supabase לא מוגדר בשרת (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(args?.limit) || DEFAULT_LIMIT),
  );
  const filters = sanitizeFilters(args?.filters, table);
  const columns = ALLOWED_COLUMNS[table].join(",");

  let query = supabase.from(table).select(columns).limit(limit);

  for (const [col, value] of Object.entries(filters)) {
    query = query.eq(col, value);
  }

  let data;
  let error;
  try {
    ({ data, error } = await query);
  } catch (err) {
    console.error("[getBusinessData] query threw", { table, message: err?.message });
    return {
      ok: false,
      error: "query_failed",
      message: "שגיאה בשאילתה — נסו שוב או פנו למנהל המערכת",
    };
  }

  if (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false,
        error: "table_missing",
        message: `הטבלה "${table}" אינה קיימת ב-Supabase. הריצו supabase/ai_agent_tables.sql.`,
      };
    }
    console.warn("[getBusinessData] query failed", {
      table,
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      error: "query_failed",
      message: error.message || "שגיאה בשאילתה",
    };
  }

  return {
    ok: true,
    table,
    count: Array.isArray(data) ? data.length : 0,
    rows: data || [],
  };
}

export const GET_BUSINESS_DATA_TOOL = {
  type: "function",
  function: {
    name: "getBusinessData",
    description:
      "שליפת נתונים עסקיים מ-Supabase (קריאה בלבד). השתמש כשצריך מידע על לקוחות, תורים, כרטיסים או שירותים.",
    parameters: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: ALLOWED_TABLES,
          description: "שם הטבלה",
        },
        filters: {
          type: "object",
          description: "מסננים (שוויון בלבד) — מפתח=עמודה, ערך=ערך",
          additionalProperties: true,
        },
        limit: {
          type: "integer",
          description: `מספר שורות מקסימלי (1–${MAX_LIMIT})`,
          minimum: 1,
          maximum: MAX_LIMIT,
        },
      },
      required: ["table"],
      additionalProperties: false,
    },
  },
};
