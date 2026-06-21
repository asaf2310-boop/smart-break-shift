export const CUSTOMER_CHAT_BOT_FLOW_KEY = "smart-break-shift-customer-chat-bot-flow-v1";
export const CUSTOMER_CHAT_BOT_FLOW_CHANGE_EVENT = "customer-chat-bot-flow-changed";

/** @typedef {'start'|'message'|'choice'|'condition'|'transfer'|'end'} FlowStepType */

export const FLOW_STEP_TYPES = {
  start: {
    key: "start",
    label: "התחלה",
    description: "נקודת כניסה לתהליך — מופעלת בפתיחת שיחה",
  },
  message: {
    key: "message",
    label: "הודעה",
    description: "הודעת טקסט מהבוט (עם אפקט הקלדה)",
  },
  choice: {
    key: "choice",
    label: "בחירת לקוח",
    description: "כפתורי תשובה מהירה — מסע לענפים שונים",
  },
  condition: {
    key: "condition",
    label: "תנאי",
    description: "הסתעפות לפי נתוני השיחה (למשל מספר מסוף)",
  },
  transfer: {
    key: "transfer",
    label: "העברה לנציג",
    description: "חיבור לנציג אנושי עם הודעת מעבר",
  },
  end: {
    key: "end",
    label: "סיום",
    description: "סיום תהליך הבוט",
  },
};

export const FLOW_TRIGGER_TYPES = {
  session_start: {
    key: "session_start",
    label: "פתיחת שיחה",
    description: "התהליך מתחיל כשהלקוח פותח צ'אט",
  },
};

export const FLOW_CONDITION_VARIABLES = {
  merchant_ref_set: {
    key: "merchant_ref_set",
    label: "מספר מסוף / ח.פ הוזן",
    needsValue: false,
  },
  guest_message_contains: {
    key: "guest_message_contains",
    label: "הודעת הלקוח מכילה",
    needsValue: true,
    valuePlaceholder: "טקסט לחיפוש",
  },
};

export function makeFlowStepId(type) {
  return `${type}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function makeDefaultSteps() {
  const startId = makeFlowStepId("start");
  const welcomeId = makeFlowStepId("message");
  const askId = makeFlowStepId("message");
  const condId = makeFlowStepId("condition");
  const afterId = makeFlowStepId("message");
  const transferId = makeFlowStepId("transfer");
  const endId = makeFlowStepId("end");

  return {
    entryStepId: startId,
    steps: [
      { id: startId, type: "start", label: "התחלה", nextStepId: welcomeId },
      {
        id: welcomeId,
        type: "message",
        label: "ברכה",
        body: "ברוכים הבאים לשירות ותמיכה של HYP",
        nextStepId: askId,
      },
      {
        id: askId,
        type: "message",
        label: "בקשת מספר מסוף",
        body: "מה מספר המסוף או הח.פ שלך?",
        nextStepId: condId,
      },
      {
        id: condId,
        type: "condition",
        label: "מספר הוזן?",
        variable: "merchant_ref_set",
        value: "",
        nextStepIdWhenTrue: afterId,
        nextStepIdWhenFalse: null,
      },
      {
        id: afterId,
        type: "message",
        label: "לפני נציג",
        body: "נציג יתחבר אליכם בקרוב",
        nextStepId: transferId,
      },
      {
        id: transferId,
        type: "transfer",
        label: "העברה לנציג",
        handoffMessage: "מחבר אתכם לנציג…",
        nextStepId: endId,
      },
      { id: endId, type: "end", label: "סיום" },
    ],
  };
}

export const DEFAULT_BOT_FLOW = {
  version: 1,
  enabled: false,
  name: "תהליך ברירת מחדל",
  trigger: { type: "session_start" },
  ...makeDefaultSteps(),
};

function normalizeChoiceOption(raw) {
  if (!raw || typeof raw !== "object") return null;
  const label = String(raw.label || "").trim();
  if (!label) return null;
  return {
    id: raw.id || makeFlowStepId("opt"),
    label,
    nextStepId: raw.nextStepId || null,
  };
}

function normalizeStep(raw) {
  if (!raw || typeof raw !== "object" || !raw.id || !raw.type) return null;
  const base = {
    id: String(raw.id),
    type: raw.type,
    label: String(raw.label || FLOW_STEP_TYPES[raw.type]?.label || raw.type).trim(),
  };

  switch (raw.type) {
    case "start":
      return { ...base, nextStepId: raw.nextStepId || null };
    case "message":
      return {
        ...base,
        body: String(raw.body || "").trim(),
        nextStepId: raw.nextStepId || null,
      };
    case "choice":
      return {
        ...base,
        prompt: String(raw.prompt || "").trim(),
        options: (raw.options || []).map(normalizeChoiceOption).filter(Boolean),
        fallbackNextStepId: raw.fallbackNextStepId || null,
      };
    case "condition":
      return {
        ...base,
        variable: raw.variable || "merchant_ref_set",
        value: String(raw.value || "").trim(),
        nextStepIdWhenTrue: raw.nextStepIdWhenTrue || null,
        nextStepIdWhenFalse: raw.nextStepIdWhenFalse || null,
      };
    case "transfer":
      return {
        ...base,
        handoffMessage: String(raw.handoffMessage || "מחבר אתכם לנציג…").trim(),
        nextStepId: raw.nextStepId || null,
      };
    case "end":
      return base;
    default:
      return null;
  }
}

function normalizeFlow(raw) {
  if (!raw || raw.version !== 1) return { ...DEFAULT_BOT_FLOW, ...makeDefaultSteps() };
  const steps = (raw.steps || []).map(normalizeStep).filter(Boolean);
  const entryStepId =
    steps.some((s) => s.id === raw.entryStepId) ? raw.entryStepId : steps[0]?.id || null;
  return {
    version: 1,
    enabled: Boolean(raw.enabled),
    name: String(raw.name || DEFAULT_BOT_FLOW.name).trim() || DEFAULT_BOT_FLOW.name,
    trigger: { type: raw.trigger?.type || "session_start" },
    entryStepId,
    steps,
  };
}

function readRaw() {
  try {
    const raw = localStorage.getItem(CUSTOMER_CHAT_BOT_FLOW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) return normalizeFlow(parsed);
    }
  } catch {
    // ignore
  }
  const flow = normalizeFlow(DEFAULT_BOT_FLOW);
  writeRaw(flow);
  return flow;
}

function writeRaw(flow) {
  localStorage.setItem(CUSTOMER_CHAT_BOT_FLOW_KEY, JSON.stringify(flow));
  window.dispatchEvent(new CustomEvent(CUSTOMER_CHAT_BOT_FLOW_CHANGE_EVENT));
}

export function subscribeCustomerChatBotFlow(callback) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e) => {
    if (e.key === CUSTOMER_CHAT_BOT_FLOW_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOMER_CHAT_BOT_FLOW_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOMER_CHAT_BOT_FLOW_CHANGE_EVENT, callback);
  };
}

export function getCustomerChatBotFlow() {
  return readRaw();
}

export function isCustomerChatBotFlowEnabled() {
  return readRaw().enabled;
}

export function saveCustomerChatBotFlow(patch) {
  const current = readRaw();
  const next = normalizeFlow({
    version: 1,
    enabled: patch.enabled ?? current.enabled,
    name: patch.name ?? current.name,
    trigger: patch.trigger ?? current.trigger,
    entryStepId: patch.entryStepId ?? current.entryStepId,
    steps: patch.steps ?? current.steps,
  });
  writeRaw(next);
  return next;
}

export function resetCustomerChatBotFlow() {
  const flow = normalizeFlow({ ...DEFAULT_BOT_FLOW, ...makeDefaultSteps() });
  writeRaw(flow);
  return flow;
}

export function getFlowStepById(flow, stepId) {
  return flow?.steps?.find((s) => s.id === stepId) || null;
}

export function createEmptyFlowStep(type) {
  const id = makeFlowStepId(type);
  switch (type) {
    case "start":
      return { id, type, label: "התחלה", nextStepId: null };
    case "message":
      return { id, type, label: "הודעה חדשה", body: "", nextStepId: null };
    case "choice":
      return {
        id,
        type,
        label: "בחירה",
        prompt: "",
        options: [{ id: makeFlowStepId("opt"), label: "אפשרות 1", nextStepId: null }],
        fallbackNextStepId: null,
      };
    case "condition":
      return {
        id,
        type,
        label: "תנאי",
        variable: "merchant_ref_set",
        value: "",
        nextStepIdWhenTrue: null,
        nextStepIdWhenFalse: null,
      };
    case "transfer":
      return {
        id,
        type,
        label: "העברה לנציג",
        handoffMessage: "מחבר אתכם לנציג…",
        nextStepId: null,
      };
    case "end":
      return { id, type, label: "סיום" };
    default:
      return null;
  }
}
