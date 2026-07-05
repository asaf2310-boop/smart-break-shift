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

/** @param {string | undefined | null} code */
export function isAiAgentSchemaNotMigratedCode(code) {
  return code === "schema_not_migrated";
}

/** @param {Error & { code?: string }} err */
export function formatAiAgentSchemaError(err) {
  if (isAiAgentSchemaNotMigratedCode(err?.code)) {
    return AI_AGENT_SCHEMA_MIGRATION_MESSAGE_HE;
  }
  return err?.message || "שגיאה לא צפויה";
}
