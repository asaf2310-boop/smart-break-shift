import { createSupabaseDataClient, isSupabaseBackend } from "./dataClient";
import { createDemoDataClient } from "./demoClient";
import { demoModeEnabled } from "./demoMode";

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
      ConstraintsWeekSettings: entity,
      ChatMessage: entity,
      ChatPresence: entity,
      ChatSettings: entity,
      Agent: entity,
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
  : isSupabaseBackend()
    ? createSupabaseDataClient()
    : createMissingBackendClient();

export const backendMode = demoModeEnabled ? "demo" : isSupabaseBackend() ? "supabase" : "missing";
