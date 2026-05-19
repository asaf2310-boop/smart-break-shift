import { createSupabaseDataClient, useSupabaseBackend } from "./dataClient";
import { createDemoDataClient, demoModeEnabled } from "./demoClient";

function createMissingBackendClient() {
  const error = new Error("לא מוגדר חיבור נתונים. הגדר Supabase או VITE_DEMO_MODE=true.");
  const entity = {
    filter: async () => { throw error; },
    list: async () => { throw error; },
    create: async () => { throw error; },
    bulkCreate: async () => { throw error; },
    update: async () => { throw error; },
    delete: async () => { throw error; },
  };

  return {
    entities: {
      BreakRegistration: entity,
      BreakSettings: entity,
      ShiftRegistration: entity,
      ShiftUnavailability: entity,
      VacationRequest: entity,
      ConstraintConfirmation: entity,
    },
    auth: {
      me: async () => null,
      logout: () => {},
      redirectToLogin: () => {},
    },
  };
}

export const dataClient = demoModeEnabled
  ? createDemoDataClient()
  : useSupabaseBackend()
    ? createSupabaseDataClient()
    : createMissingBackendClient();

export const backendMode = demoModeEnabled ? "demo" : useSupabaseBackend() ? "supabase" : "missing";
