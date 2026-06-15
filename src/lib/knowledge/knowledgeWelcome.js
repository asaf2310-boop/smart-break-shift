import { advancedHebrewPostProcess } from "@/lib/knowledge/sanitizeHebrewText";
import { formatAssistantDisplayMarkdown } from "@/lib/knowledgeAi";

export const KNOWLEDGE_WELCOME_FALLBACK_RAW =
  "שלום! שאלו כאן שאלות על המסמכים. כל תשובה תציין את המקור.";

/** Local welcome (no API) — sanitized for display. */
export function getLocalKnowledgeWelcome() {
  return formatAssistantDisplayMarkdown(advancedHebrewPostProcess(KNOWLEDGE_WELCOME_FALLBACK_RAW));
}
