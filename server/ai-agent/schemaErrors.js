/** Detect missing AI Agent document tables / PostgREST schema cache issues. */

const SCHEMA_ERROR_RE =
  /relation.*does not exist|schema cache|could not find the table|ai_agent_document|pgrst205|42p01/i;

/**
 * @param {string | { message?: string, code?: string } | null | undefined} error
 */
export function isAiAgentSchemaError(error) {
  if (!error) return false;
  const message = String(typeof error === "object" ? error.message : error || "");
  const code = String(typeof error === "object" ? error.code : "" || "").toUpperCase();
  if (code === "PGRST205" || code === "42P01") return true;
  return SCHEMA_ERROR_RE.test(message);
}

export const AI_AGENT_DOCUMENTS_MIGRATION_FILE = "supabase/ai_agent_documents.sql";

export const AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE =
  "יש להריץ את המיגרציה supabase/ai_agent_documents.sql ב-Supabase";

export const AI_AGENT_SCHEMA_MIGRATION_STEPS_HE = [
  "פתחו Supabase Dashboard → Project → SQL Editor",
  "העתיקו את כל התוכן מהקובץ supabase/ai_agent_documents.sql (במאגר Git)",
  "הדביקו ב-SQL Editor ולחצו Run",
  "אם אחרי ההרצה עדיין מופיעה שגיאת schema cache — הריצו: NOTIFY pgrst, 'reload schema';",
  "רעננו את דף הניהול בדפדפן",
];