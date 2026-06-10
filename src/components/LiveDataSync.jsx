import { useLiveDataSync } from "@/hooks/useLiveDataSync";
import { useAgentPresence } from "@/hooks/useAgentPresence";

/** רכיב ללא UI — מפעיל סנכרון חי בין נציג לאדמין */
export default function LiveDataSync() {
  useLiveDataSync();
  useAgentPresence();
  return null;
}