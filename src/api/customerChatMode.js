import { demoModeEnabled } from "./demoMode";

/**
 * צ'אט לקוחות + בוט — בדמו תמיד; בלייב: VITE_CUSTOMER_CHAT_ENABLED=true
 * (נתונים ב-localStorage עד חיבור Supabase)
 */
export const customerChatEnabled =
  demoModeEnabled || import.meta.env.VITE_CUSTOMER_CHAT_ENABLED === "true";
