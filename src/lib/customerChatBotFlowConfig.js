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

export const FLOW_INPUT_MODES = {
  buttons: {
    key: "buttons",
    label: "כפתורים (אפשרויות מוגדרות)",
    description: "תשובות מהירה בכפתורים",
  },
  text: {
    key: "text",
    label: "הקלדה עם אימות",
    description: "שדה טקסט עם כללי אימות (אימייל, טלפון וכו')",
  },
  freeText: {
    key: "freeText",
    label: "טקסט חופשי",
    description: "טקסט חופשי עם כללי אימות אופציונליים",
  },
};

export const FLOW_VALIDATION_TYPES = {
  none: { key: "none", label: "ללא אימות", needsValue: false },
  email: { key: "email", label: "פורמט אימייל", needsValue: false },
  phone: { key: "phone", label: "פורמט טלפון", needsValue: false },
  number: {
    key: "number",
    label: "מספר ספציפי",
    needsValue: true,
    valuePlaceholder: "למשל: 12345",
  },
  exactText: {
    key: "exactText",
    label: "טקסט מדויק",
    needsValue: true,
    valuePlaceholder: "הטקסט הנדרש במדויק",
  },
  containsText: {
    key: "containsText",
    label: "טקסט מכיל",
    needsValue: true,
    valuePlaceholder: "מקטע שחייב להופיע בטקסט",
  },
};

export const FLOW_INVALID_HANDLERS = {
  retry: { key: "retry", label: "נסה שוב באותו שלב" },
  goBack: { key: "goBack", label: "חזור לשלב הקודם" },
};

export const DEFAULT_INVALID_INPUT_MESSAGE = "הקלט שהזנת אינו תקין. נסה/י שוב.";

export const FLOW_CAPTURE_FIELDS = {
  merchant_ref: {
    key: "merchant_ref",
    label: "מסוף / ח.פ",
  },
  guest_email: {
    key: "guest_email",
    label: "אימייל",
  },
  guest_phone: {
    key: "guest_phone",
    label: "טלפון",
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

function normalizeInputMode(raw) {
  const mode = raw?.inputMode || "buttons";
  return FLOW_INPUT_MODES[mode] ? mode : "buttons";
}

function normalizeValidationType(raw) {
  const type = raw?.validationType || "none";
  return FLOW_VALIDATION_TYPES[type] ? type : "none";
}

function normalizeOnInvalid(raw) {
  const handler = raw?.onInvalid || "retry";
  return FLOW_INVALID_HANDLERS[handler] ? handler : "retry";
}

function normalizeChoiceStep(raw) {
  const inputMode = normalizeInputMode(raw);
  const maxRetriesRaw = Number(raw?.maxRetries);
  return {
    id: raw.id,
    type: "choice",
    label: raw.label,
    prompt: String(raw.prompt || "").trim(),
    inputMode,
    options: (raw.options || []).map(normalizeChoiceOption).filter(Boolean),
    fallbackNextStepId: raw.fallbackNextStepId || null,
    nextStepId: raw.nextStepId || null,
    validationType: normalizeValidationType(raw),
    validationValue: String(raw.validationValue || "").trim(),
    captureField: FLOW_CAPTURE_FIELDS[raw.captureField] ? raw.captureField : null,
    allowImageAttachment: Boolean(raw.allowImageAttachment),
    onInvalid: normalizeOnInvalid(raw),
    maxRetries: Number.isFinite(maxRetriesRaw) && maxRetriesRaw >= 0 ? maxRetriesRaw : 3,
    invalidMessage: String(raw.invalidMessage || DEFAULT_INVALID_INPUT_MESSAGE).trim(),
  };
}

function scrubStepReference(step, deletedStepId) {
  const scrub = (id) => (id === deletedStepId ? null : id);
  if (step.type === "start" || step.type === "message" || step.type === "transfer") {
    return { ...step, nextStepId: scrub(step.nextStepId) };
  }
  if (step.type === "choice") {
    return {
      ...step,
      fallbackNextStepId: scrub(step.fallbackNextStepId),
      nextStepId: scrub(step.nextStepId),
      options: (step.options || []).map((o) => ({ ...o, nextStepId: scrub(o.nextStepId) })),
    };
  }
  if (step.type === "condition") {
    return {
      ...step,
      nextStepIdWhenTrue: scrub(step.nextStepIdWhenTrue),
      nextStepIdWhenFalse: scrub(step.nextStepIdWhenFalse),
    };
  }
  return step;
}

function scrubInvalidStepReferences(steps) {
  const validIds = new Set(steps.map((s) => s.id));
  const keep = (id) => (id && validIds.has(id) ? id : null);
  return steps.map((step) => {
    if (step.type === "start" || step.type === "message" || step.type === "transfer") {
      return { ...step, nextStepId: keep(step.nextStepId) };
    }
    if (step.type === "choice") {
      return {
        ...step,
        fallbackNextStepId: keep(step.fallbackNextStepId),
        nextStepId: keep(step.nextStepId),
        options: (step.options || []).map((o) => ({ ...o, nextStepId: keep(o.nextStepId) })),
      };
    }
    if (step.type === "condition") {
      return {
        ...step,
        nextStepIdWhenTrue: keep(step.nextStepIdWhenTrue),
        nextStepIdWhenFalse: keep(step.nextStepIdWhenFalse),
      };
    }
    return step;
  });
}

function resolveEntryStepId(steps, preferredId) {
  if (preferredId && steps.some((s) => s.id === preferredId)) return preferredId;
  return steps.find((s) => s.type === "start")?.id || steps[0]?.id || null;
}

/** @param {ReturnType<typeof getCustomerChatBotFlow>} flow */
export function removeFlowStep(flow, stepId) {
  if (!flow?.steps?.length || flow.steps.length <= 1) return flow;
  if (!flow.steps.some((s) => s.id === stepId)) return flow;

  const steps = flow.steps
    .filter((s) => s.id !== stepId)
    .map((s) => scrubStepReference(s, stepId));
  const entryStepId =
    flow.entryStepId === stepId
      ? resolveEntryStepId(steps, null)
      : resolveEntryStepId(steps, flow.entryStepId);

  return { ...flow, steps, entryStepId };
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
      return normalizeChoiceStep({ ...base, ...raw });
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
  const steps = scrubInvalidStepReferences((raw.steps || []).map(normalizeStep).filter(Boolean));
  const entryStepId = resolveEntryStepId(steps, raw.entryStepId);
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
        inputMode: "buttons",
        options: [{ id: makeFlowStepId("opt"), label: "אפשרות 1", nextStepId: null }],
        fallbackNextStepId: null,
        nextStepId: null,
        validationType: "none",
        validationValue: "",
        allowImageAttachment: false,
        onInvalid: "retry",
        maxRetries: 3,
        invalidMessage: DEFAULT_INVALID_INPUT_MESSAGE,
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
