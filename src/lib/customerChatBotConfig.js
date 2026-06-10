export const CUSTOMER_CHAT_BOT_CONFIG_KEY = "smart-break-shift-customer-chat-bot-v1";
export const CUSTOMER_CHAT_BOT_CONFIG_CHANGE_EVENT = "customer-chat-bot-config-changed";

export const BOT_MESSAGE_PHASES = {
  sessionStart: {
    key: "sessionStart",
    label: "בתחילת השיחה",
    description: "הודעות שהבוט שולח מיד כשהלקוח פותח צ'אט",
  },
  beforeAgent: {
    key: "beforeAgent",
    label: "לפני העברה לנציג",
    description: "הודעות לפני שהפנייה נכנסת לתור לנציג (למשל בקשת מספר מסוף או ח.פ.)",
  },
  afterBeforeAgent: {
    key: "afterBeforeAgent",
    label: "לאחר תשובת הלקוח — לפני נציג",
    description: "הודעות שנשלחות אחרי שהלקוח ענה (למשל מספר מסוף), לפני חיבור הנציג",
  },
};

export const DEFAULT_BOT_CONFIG = {
  version: 1,
  sessionStart: ["ברוכים הבאים לשירות ותמיכה של HYP"],
  beforeAgent: ["מה מספר המסוף או הח.פ שלך?"],
  afterBeforeAgent: ["נציג יתחבר אליכם בקרוב"],
};

function makeId() {
  return `bm_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeMessages(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === "string") {
        const body = item.trim();
        return body ? { id: makeId(), body } : null;
      }
      const body = String(item?.body || "").trim();
      if (!body) return null;
      return { id: item?.id || makeId(), body };
    })
    .filter(Boolean);
}

function normalizeConfig(raw) {
  if (!raw || raw.version !== 1) return { ...DEFAULT_BOT_CONFIG };
  return {
    version: 1,
    sessionStart: normalizeMessages(raw.sessionStart).map((m) => m.body),
    beforeAgent: normalizeMessages(raw.beforeAgent).map((m) => m.body),
    afterBeforeAgent: normalizeMessages(raw.afterBeforeAgent).map((m) => m.body),
  };
}

function readRaw() {
  try {
    const raw = localStorage.getItem(CUSTOMER_CHAT_BOT_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1) return normalizeConfig(parsed);
    }
  } catch {
    // ignore
  }
  const config = { ...DEFAULT_BOT_CONFIG };
  writeRaw(config);
  return config;
}

function writeRaw(config) {
  localStorage.setItem(CUSTOMER_CHAT_BOT_CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(CUSTOMER_CHAT_BOT_CONFIG_CHANGE_EVENT));
}

export function subscribeCustomerChatBotConfig(callback) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e) => {
    if (e.key === CUSTOMER_CHAT_BOT_CONFIG_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CUSTOMER_CHAT_BOT_CONFIG_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CUSTOMER_CHAT_BOT_CONFIG_CHANGE_EVENT, callback);
  };
}

export function getCustomerChatBotConfig() {
  return readRaw();
}

export function saveCustomerChatBotConfig(patch) {
  const current = readRaw();
  const next = normalizeConfig({
    version: 1,
    sessionStart: patch.sessionStart ?? current.sessionStart,
    beforeAgent: patch.beforeAgent ?? current.beforeAgent,
    afterBeforeAgent: patch.afterBeforeAgent ?? current.afterBeforeAgent,
  });
  writeRaw(next);
  return next;
}

export function resetCustomerChatBotConfig() {
  const config = { ...DEFAULT_BOT_CONFIG };
  writeRaw(config);
  return config;
}

function filterBodies(list) {
  return (list || []).map((body) => String(body || "").trim()).filter(Boolean);
}

/** Welcome + pre-agent questions (sent on session start, one by one) */
export function getBotIntroMessages() {
  const config = readRaw();
  return filterBodies([...config.sessionStart, ...config.beforeAgent]);
}

/** Sent after the guest replies with terminal / ח.פ. */
export function getBotAfterMerchantMessages() {
  const config = readRaw();
  return filterBodies(config.afterBeforeAgent);
}

/** @deprecated use getBotIntroMessages / getBotAfterMerchantMessages */
export function getBotMessagesForNewSession() {
  return [...getBotIntroMessages(), ...getBotAfterMerchantMessages()];
}
