import { demoModeEnabled } from "./demoMode";

/**
 * בסיס ידע AI — בדמו תמיד; בפרודקשן: VITE_KNOWLEDGE_ENABLED=true
 * דורש OPENAI_API_KEY ב-Vercel לתשובות GPT (אחרת חיפוש מילות מפתח מקומי)
 */
export const knowledgeEnabled =
  demoModeEnabled || import.meta.env.VITE_KNOWLEDGE_ENABLED === "true";
