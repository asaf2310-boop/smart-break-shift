import { customerChatEnabled, demoModeEnabled } from "@/api/demoClient";

const PRODUCTION_TOP_NAV_PATHS = ["/breaks", "/shifts", "/training", "/metrics", "/remote-support"];

const DEMO_TOP_NAV_PATHS = ["/crm", "/knowledge", "/customer-chat"];

const LIVE_CUSTOMER_CHAT_PATHS = customerChatEnabled && !demoModeEnabled ? ["/customer-chat"] : [];

/** Routes that show the main tab bar (logo is embedded in AppNav). */
export const TOP_NAV_PATHS = new Set([
  ...PRODUCTION_TOP_NAV_PATHS,
  ...LIVE_CUSTOMER_CHAT_PATHS,
  ...(demoModeEnabled ? DEMO_TOP_NAV_PATHS : []),
]);

export function hasTopAppNav(pathname) {
  return TOP_NAV_PATHS.has(pathname);
}

/** Agent login / logged-in home — single large hero logo, no corner mark. */
export function isAgentEntryPath(pathname) {
  return pathname === "/";
}

/** Routes with a dark page background — corner mark uses wordmark, not PNG. */
const DARK_BRAND_HEADER_PATHS = new Set();

export function isDarkBrandHeaderPath(pathname) {
  return DARK_BRAND_HEADER_PATHS.has(pathname);
}
