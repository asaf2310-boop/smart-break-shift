import { createClient } from "@base44/sdk";
import { appParams } from "@/lib/app-params";
import { createSupabaseDataClient, useSupabaseBackend } from "./dataClient";
import { createDemoDataClient, demoModeEnabled } from "./demoClient";

function createBase44Client() {
  const { appId, token, functionsVersion, appBaseUrl } = appParams;
  return createClient({
    appId,
    token,
    functionsVersion,
    serverUrl: "",
    requiresAuth: false,
    appBaseUrl,
  });
}

/** תואם ל-SDK של Base44 — הקוד משתמש ב-base44.entities.* */
export const base44 = demoModeEnabled
  ? createDemoDataClient()
  : useSupabaseBackend()
    ? createSupabaseDataClient()
    : createBase44Client();

export const backendMode = demoModeEnabled ? "demo" : useSupabaseBackend() ? "supabase" : "base44";
