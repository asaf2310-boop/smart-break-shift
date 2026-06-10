import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { useChatPanel } from "@/context/ChatPanelContext";
import { useFloatingWidgetsLayer } from "@/context/FloatingWidgetsLayerContext";
import { useChatUnread } from "@/hooks/useChatUnread";
import InternalChatPanel from "@/components/chat/InternalChatPanel";
import ChatBrandingAvatar from "@/components/chat/ChatBrandingAvatar";
import { useChatBranding } from "@/hooks/useChatBranding";
import { dataClient } from "@/api/client";
import { getChatEntities, isLocalChatStore } from "@/api/localChatStore";
import { getStoredAgentName } from "@/constants/scheduling";
import { useAgentSession } from "@/hooks/useAgentSession";
import { getLiveQueryOptions } from "@/lib/liveQuery";
import { resolveAgentStatus, statusDotClass } from "@/lib/chatStatus";
import { CHAT_STATUS, isAgentChatConnected } from "@/lib/agentChatPresence";
import { CHAT_FLOAT_CHROME_CLASS } from "@/lib/floatingWidgetChrome";
import { hasTopAppNav } from "@/lib/appNavPaths";
import { isCustomerChatGuestPath } from "@/lib/customerChatPaths";

const CHAT_PANEL_HEIGHT_KEY = "chat-panel-height";
const MIN_CHAT_PANEL_HEIGHT = 320;
const APP_TOP_SAFE_REM = 2;
const CHAT_BUBBLE_REM = 3.5;
const CHAT_STACK_GAP_REM = 0.25;

function readRemPx() {
  if (typeof document === "undefined") return 16;
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

const TOP_NAV_CHROME_REM = 4.5;
const BOTTOM_FAB_CHROME_REM = 1;

function getTopChromeRem(hasTopNav) {
  return hasTopNav ? TOP_NAV_CHROME_REM : APP_TOP_SAFE_REM;
}

function getReservedChromeRem(hasTopNav, panelOpen) {
  let rem = getTopChromeRem(hasTopNav) + BOTTOM_FAB_CHROME_REM;
  if (panelOpen) rem += CHAT_BUBBLE_REM + CHAT_STACK_GAP_REM;
  return rem;
}

function getMaxChatPanelHeight(
  viewportH = window.innerHeight,
  { hasTopNav = false, panelOpen = false } = {}
) {
  return Math.round(viewportH - getReservedChromeRem(hasTopNav, panelOpen) * readRemPx());
}

function getDefaultChatPanelHeight(
  viewportH = window.innerHeight,
  options = {}
) {
  const max = getMaxChatPanelHeight(viewportH, options);
  const from85vh = Math.round(viewportH * 0.85);
  const candidate = Math.min(from85vh, max);
  const withPreferred = Math.min(max, Math.max(candidate, 480));
  return Math.min(max, Math.max(MIN_CHAT_PANEL_HEIGHT, withPreferred));
}

function clampChatPanelHeight(
  height,
  viewportH = window.innerHeight,
  options = {}
) {
  const max = getMaxChatPanelHeight(viewportH, options);
  return Math.min(max, Math.max(MIN_CHAT_PANEL_HEIGHT, Math.round(height)));
}

function loadStoredChatPanelHeight() {
  try {
    const raw = sessionStorage.getItem(CHAT_PANEL_HEIGHT_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function saveChatPanelHeight(height) {
  try {
    sessionStorage.setItem(CHAT_PANEL_HEIGHT_KEY, String(height));
  } catch {
    /* quota / private mode */
  }
}

function pointerClientY(event) {
  if ("touches" in event && event.touches.length > 0) return event.touches[0].clientY;
  if ("changedTouches" in event && event.changedTouches.length > 0) {
    return event.changedTouches[0].clientY;
  }
  return event.clientY;
}

/** בועת צ'אט צפה — מופיעה בכל מסך, בלי טאב בסרגל */
export default function FloatingChatWidget() {
  const { pathname, search } = useLocation();
  const hasTopNav = hasTopAppNav(pathname);
  const { open, toggleChat, closeChat } = useChatPanel();
  const { bringToFront, getZIndex } = useFloatingWidgetsLayer();
  const { unreadTotal, hasUnread } = useChatUnread();
  const { effective: chatBranding } = useChatBranding();
  const heightOptions = useMemo(
    () => ({ hasTopNav, panelOpen: open }),
    [hasTopNav, open]
  );
  const { displayName } = useAgentSession();
  const agentName = displayName || getStoredAgentName();
  const chatEntities = getChatEntities() || dataClient.entities;
  const localChat = isLocalChatStore();
  const [chatConnected, setChatConnected] = useState(() => isAgentChatConnected());

  const [panelHeight, setPanelHeight] = useState(() => {
    const stored = loadStoredChatPanelHeight();
    if (stored != null) return clampChatPanelHeight(stored, window.innerHeight, heightOptions);
    return getDefaultChatPanelHeight(window.innerHeight, heightOptions);
  });

  const resizeRef = useRef({ active: false, startY: 0, startHeight: 0 });

  const maxPanelHeight =
    typeof window !== "undefined"
      ? getMaxChatPanelHeight(window.innerHeight, heightOptions)
      : 600;

  useEffect(() => {
    if (hasTopNav) {
      document.documentElement.setAttribute("data-top-nav", "");
    } else {
      document.documentElement.removeAttribute("data-top-nav");
    }
  }, [hasTopNav]);

  useEffect(() => {
    setPanelHeight((h) => clampChatPanelHeight(h, window.innerHeight, heightOptions));
  }, [heightOptions]);

  useEffect(() => {
    const onResize = () => {
      setPanelHeight((h) => clampChatPanelHeight(h, window.innerHeight, heightOptions));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [heightOptions]);

  const finishResize = useCallback(
    (nextHeight) => {
      const clamped = clampChatPanelHeight(nextHeight, window.innerHeight, heightOptions);
      setPanelHeight(clamped);
      saveChatPanelHeight(clamped);
    },
    [heightOptions]
  );

  const detachResizeListenersRef = useRef(null);

  const endResize = useCallback(() => {
    if (!resizeRef.current.active) return;
    resizeRef.current.active = false;
    detachResizeListenersRef.current?.();
    detachResizeListenersRef.current = null;
    setPanelHeight((h) => {
      const clamped = clampChatPanelHeight(h, window.innerHeight, heightOptions);
      saveChatPanelHeight(clamped);
      return clamped;
    });
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [heightOptions]);

  const onResizeMove = useCallback((event) => {
    if (!resizeRef.current.active) return;
    const clientY = pointerClientY(event);
    const delta = resizeRef.current.startY - clientY;
    const next = resizeRef.current.startHeight + delta;
    setPanelHeight(clampChatPanelHeight(next, window.innerHeight, heightOptions));
    event.preventDefault();
  }, [heightOptions]);

  const startResize = useCallback(
    (event) => {
      if (event.button != null && event.button !== 0) return;
      if (resizeRef.current.active) return;
      resizeRef.current = {
        active: true,
        startY: pointerClientY(event),
        startHeight: panelHeight,
      };
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";

      const onMove = (e) => onResizeMove(e);
      const onEnd = () => endResize();
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
      window.addEventListener("touchcancel", onEnd);
      detachResizeListenersRef.current = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
        window.removeEventListener("touchcancel", onEnd);
      };

      event.preventDefault();
    },
    [panelHeight, onResizeMove, endResize, heightOptions]
  );

  useEffect(
    () => () => {
      detachResizeListenersRef.current?.();
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    []
  );

  const onResizeKeyDown = useCallback(
    (event) => {
      const step = event.shiftKey ? 40 : 16;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        finishResize(panelHeight + step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        finishResize(panelHeight - step);
      }
    },
    [panelHeight, finishResize]
  );

  useEffect(() => {
    const onConnection = () => setChatConnected(isAgentChatConnected());
    window.addEventListener("agent-chat-connection", onConnection);
    return () => window.removeEventListener("agent-chat-connection", onConnection);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    bringToFront("chat");
    const onKey = (e) => {
      if (e.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeChat, bringToFront]);

  const handleToggleChat = useCallback(() => {
    bringToFront("chat");
    toggleChat();
  }, [bringToFront, toggleChat]);

  const handleChromePointerDown = useCallback(() => {
    if (open) bringToFront("chat");
  }, [open, bringToFront]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: presences = [] } = useQuery({
    queryKey: ["chat-presence", localChat ? "local" : "remote"],
    queryFn: () => chatEntities.ChatPresence.list("-updated_at", 100),
    ...getLiveQueryOptions(),
    enabled: Boolean(agentName) && !open,
  });

  const { data: todayBreaks = [] } = useQuery({
    queryKey: ["chat-break-status", todayStr],
    queryFn: () => dataClient.entities.BreakRegistration.filter({ date: todayStr }),
    ...getLiveQueryOptions(),
    enabled: Boolean(agentName) && !open,
  });

  const presenceMap = useMemo(
    () => new Map(presences.map((row) => [row.agent_name, row])),
    [presences]
  );

  const myStatus = useMemo(() => {
    if (!agentName || !chatConnected) return CHAT_STATUS.offline;
    return resolveAgentStatus(agentName, presenceMap, todayBreaks);
  }, [agentName, chatConnected, presenceMap, todayBreaks]);

  const badgeLabel =
    unreadTotal > 99 ? "99+" : unreadTotal > 0 ? String(unreadTotal) : null;

  if (isCustomerChatGuestPath(pathname, search)) return null;

  return (
    <div
      dir="ltr"
      className={CHAT_FLOAT_CHROME_CLASS}
      style={{ zIndex: getZIndex("chat") }}
      onMouseDown={handleChromePointerDown}
    >
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={chatBranding.displayName}
          style={{ height: panelHeight }}
          className="pointer-events-auto w-[min(calc(100vw-2rem),520px)] min-w-[320px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in-0 duration-200"
        >
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="גרור לשינוי גובה החלון"
            aria-valuenow={panelHeight}
            aria-valuemin={MIN_CHAT_PANEL_HEIGHT}
            aria-valuemax={maxPanelHeight}
            tabIndex={0}
            title="גרור לשינוי גובה"
            className="group shrink-0 flex items-center justify-center h-3 cursor-ns-resize touch-none select-none border-b border-slate-100 hover:bg-slate-50 active:bg-slate-100"
            onMouseDown={startResize}
            onTouchStart={startResize}
            onKeyDown={onResizeKeyDown}
          >
            <span
              className="block w-10 h-1 rounded-full bg-slate-300 group-hover:bg-slate-400 transition-colors"
              aria-hidden
            />
          </div>
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <InternalChatPanel />
          </div>
        </div>
      )}

      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        {!open && agentName && unreadTotal === 0 && (
          <span
            className={`w-3 h-3 rounded-full ring-2 ring-white shadow-sm ${statusDotClass(myStatus.tone)}`}
            title={myStatus.label}
            aria-label={`סטטוס: ${myStatus.label}`}
          />
        )}
        {!open && unreadTotal > 0 && (
          <span
            className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold leading-none ring-2 ring-white shadow-sm"
            aria-label={`${unreadTotal} הודעות שלא נקראו`}
          >
            {badgeLabel}
          </span>
        )}

        <button
          type="button"
          onClick={handleToggleChat}
          aria-expanded={open}
          aria-label={
            open
              ? "סגור צ'אט"
              : hasUnread
                ? `פתח צ'אט — ${unreadTotal} הודעות שלא נקראו`
                : `פתח ${chatBranding.displayName} — ${myStatus.label}`
          }
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform overflow-hidden"
        >
          {open ? (
            <X className="w-6 h-6" />
          ) : chatBranding.imageUrl ? (
            <img
              src={chatBranding.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <MessageCircle className="w-6 h-6" />
          )}
        </button>
      </div>
    </div>
  );
}