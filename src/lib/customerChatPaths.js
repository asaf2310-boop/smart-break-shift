/** Guest customer chat — no agent chrome (nav, FABs). */
export function isCustomerChatGuestPath(pathname, search = "") {
  if (pathname === "/chat/guest" || pathname.startsWith("/chat/guest/")) return true;
  if (pathname === "/chat" && search) {
    return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).has("token");
  }
  return false;
}

/** Screen share / remote support guest — no agent chrome or internal chat polling. */
export function isRemoteSupportGuestPath(pathname) {
  if (pathname.startsWith("/support/screen/")) return true;
  if (pathname.startsWith("/support/consent/")) return true;
  if (pathname.startsWith("/j/")) return true;
  return false;
}

/** Wealthy Guide public SMS links — no agent chrome. */
export function isWealthyGuideGuestPath(pathname) {
  return (
    pathname.startsWith("/guide/manual-charge/") || pathname.startsWith("/guide/payment-link/")
  );
}

/** Public guest flows that should not load agent widgets or Supabase chat tables. */
export function isGuestChromeHiddenPath(pathname, search = "") {
  return (
    isCustomerChatGuestPath(pathname, search) ||
    isRemoteSupportGuestPath(pathname) ||
    isWealthyGuideGuestPath(pathname)
  );
}

export function isAgentCustomerChatPath(pathname) {
  return pathname === "/customer-chat";
}
