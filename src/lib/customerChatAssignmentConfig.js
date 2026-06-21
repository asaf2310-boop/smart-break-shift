export const CUSTOMER_CHAT_ASSIGNMENT_CONFIG_KEY = "smart-break-shift-customer-chat-assignment-v1";
export const CUSTOMER_CHAT_ASSIGNMENT_CONFIG_CHANGE_EVENT = "customer-chat-assignment-config-changed";

export const AGENT_ASSIGNMENT_MODES = {
  auto: {
    key: "auto",
    label: "הקצאה אוטומטית לנציגים",
    description: "שיחות חדשות מוקצות אוטומטית לנציגים זמינים לפי תור.",
  },
  pull: {
    key: "pull",
    label: "נציגים מושכים שיחות בעצמם",
    description: "שיחות נכנסות לתור המתנה — כל נציג לוחץ «קבל» כדי לקחת שיחה.",
  },
};

export const DEFAULT_ASSIGNMENT_CONFIG = {
  version: 1,
  mode: AGENT_ASSIGNMENT_MODES.pull.key,
};

function normalizeConfig(raw) {
  if (!raw || raw.version !== 1) return { ...DEFAULT_ASSIGNMENT_CONFIG };
  const mode =
    raw.mode === AGENT_ASSIGNMENT_MODES.auto.key ? AGENT_ASSIGNMENT_MODES.auto.key : AGENT_ASSIGNMENT_MODES.pull.key;
  return { version: 1, mode };
}

function readRaw() {
  try {
    const raw = localStorage.getItem(CUSTOMER_CHAT_ASSIGNMENT_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) return normalizeConfig(parsed);
    }
  } catch {
    // ignore
  }
  const config = { ...DEFAULT_ASSIGNMENT_CONFIG };
  writeRaw(config);
  return config;
}

function writeRaw(config) {
  localStorage.setItem(CUSTOMER_CHAT_ASSIGNMENT_CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(CUSTOMER_CHAT_ASSIGNMENT_CONFIG_CHANGE_EVENT));
}

export function subscribeCustomerChatAssignmentConfig(callback) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e) => {
    if (e.key === CUSTOMER_CHAT_ASSIGNMENT_CONFIG_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOMER_CHAT_ASSIGNMENT_CONFIG_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOMER_CHAT_ASSIGNMENT_CONFIG_CHANGE_EVENT, callback);
  };
}

export function getCustomerChatAssignmentConfig() {
  return readRaw();
}

export function getCustomerChatAssignmentMode() {
  return readRaw().mode;
}

export function isAutoAssignMode() {
  return getCustomerChatAssignmentMode() === AGENT_ASSIGNMENT_MODES.auto.key;
}

export function saveCustomerChatAssignmentConfig(patch) {
  const current = readRaw();
  const next = normalizeConfig({
    version: 1,
    mode: patch.mode ?? current.mode,
  });
  writeRaw(next);
  return next;
}

export function resetCustomerChatAssignmentConfig() {
  const config = { ...DEFAULT_ASSIGNMENT_CONFIG };
  writeRaw(config);
  return config;
}
