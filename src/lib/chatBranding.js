export const CHAT_BRANDING_STORAGE_KEY = "chat-branding-v1";
export const CHAT_BRANDING_DEFAULT_NAME = "צ'אט פנימי";
export const CHAT_SETTINGS_ROW_ID = "default";

const BRANDING_CHANGE_EVENT = "chat-branding-changed";

export function normalizeChatBranding(raw) {
  if (!raw) {
    return { displayName: null, imageUrl: null };
  }
  const displayName = String(raw.displayName ?? raw.display_name ?? "").trim();
  const imageUrl = String(raw.imageUrl ?? raw.image_url ?? "").trim();
  return {
    displayName: displayName || null,
    imageUrl: imageUrl || null,
  };
}

export function getEffectiveChatBranding(branding) {
  const normalized = normalizeChatBranding(branding);
  return {
    displayName: normalized.displayName || CHAT_BRANDING_DEFAULT_NAME,
    imageUrl: normalized.imageUrl,
    hasCustomName: Boolean(normalized.displayName),
    hasCustomImage: Boolean(normalized.imageUrl),
  };
}

export function readLocalChatBranding() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAT_BRANDING_STORAGE_KEY);
    if (!raw) return null;
    return normalizeChatBranding(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalChatBranding(branding) {
  const normalized = normalizeChatBranding(branding);
  const hasAny = normalized.displayName || normalized.imageUrl;
  if (!hasAny) {
    localStorage.removeItem(CHAT_BRANDING_STORAGE_KEY);
  } else {
    localStorage.setItem(CHAT_BRANDING_STORAGE_KEY, JSON.stringify(normalized));
  }
  window.dispatchEvent(new CustomEvent(BRANDING_CHANGE_EVENT));
}

export function subscribeChatBranding(onStoreChange) {
  const onStorage = (e) => {
    if (e.key === CHAT_BRANDING_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BRANDING_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BRANDING_CHANGE_EVENT, onStoreChange);
  };
}

export function mapSupabaseChatSettingsRow(row) {
  if (!row) return null;
  return normalizeChatBranding({
    display_name: row.display_name,
    image_url: row.image_url,
  });
}

export function toSupabaseChatSettingsPatch(branding) {
  const normalized = normalizeChatBranding(branding);
  return {
    display_name: normalized.displayName,
    image_url: normalized.imageUrl,
    updated_at: new Date().toISOString(),
  };
}
