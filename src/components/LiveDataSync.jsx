import { useLiveDataSync } from "@/hooks/useLiveDataSync";

/** רכיב ללא UI — מפעיל סנכרון חי בין נציג לאדמין */
export default function LiveDataSync() {
  useLiveDataSync();
  return null;
}
