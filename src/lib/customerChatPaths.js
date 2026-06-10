/** Guest customer chat — no agent chrome (nav, FABs). */
export function isCustomerChatGuestPath(pathname, search = "") {
  if (pathname === "/chat/guest" || pathname.startsWith("/chat/guest/")) return true;
  if (pathname === "/chat" && search) {
    return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).has("token");
  }
  return false;
}

export function isAgentCustomerChatPath(pathname) {
  return pathname === "/customer-chat";
}
