/** Shared layout for floating chat / softphone (physical corners on RTL pages). */

export const FAB_SIZE_REM = 3.5;
export const FAB_STACK_GAP_REM = 0.75;

/** LTR chrome: pins controls to physical viewport corners regardless of page dir. */
export const CHAT_FLOAT_CHROME_CLASS =
  "floating-chat-chrome fixed right-4 z-[90] flex flex-col items-end justify-end gap-3 pointer-events-none bottom-[var(--app-bottom-chrome)]";

export const PHONE_FLOAT_CHROME_CLASS =
  "floating-phone-chrome fixed left-4 z-[88] flex flex-col items-start justify-end gap-3 pointer-events-none bottom-[var(--app-bottom-chrome)]";

/** Telephony sidebar — personal ("שלי") view fits without inner scroll at default size. */
export const TELEPHONY_SIDEBAR_PANEL_CLASS =
  "min-h-[min(420px,85vh)] max-h-[min(85vh,42rem)]";
