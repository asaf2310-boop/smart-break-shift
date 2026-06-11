import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Maximize2, Minimize2, MonitorPlay, X } from "lucide-react";
import { remoteSupportEnabled } from "@/api/demoClient";
import { getStoredAgentName } from "@/constants/scheduling";
import { Button } from "@/components/ui/button";
import { dismissToastsByDedupeKey, toast } from "@/components/ui/use-toast";
import ScreenShareAgentView from "@/components/remote/ScreenShareAgentView";
import {
  REMOTE_SUPPORT_OPEN_EVENT,
  REMOTE_SUPPORT_PANEL_CLOSE_EVENT,
  getSession,
  listSessions,
  markAgentPeerOpened,
  startSessionCloudPoll,
  subscribeScreenShare,
} from "@/lib/screenShareStore";
import { isGuestInitiatedEnd } from "@/lib/screenShareSessionEnd";

const ScreenShareSessionContext = createContext(null);

export function useScreenShareSession() {
  return useContext(ScreenShareSessionContext) ?? {};
}

export function ScreenShareSessionProvider({ children }) {
  const agentName = getStoredAgentName();
  const [backgroundSessionId, setBackgroundSessionId] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewExpanded, setViewExpanded] = useState(false);
  const notifiedRef = useRef(new Set());

  const syncBackgroundSession = useCallback(() => {
    if (!agentName) {
      setBackgroundSessionId(null);
      return;
    }
    const active = listSessions().find(
      (s) =>
        s.status === "active" &&
        s.agentPeerOpenedAt &&
        String(s.agentName || "").trim() === String(agentName).trim()
    );
    if (active?.id) {
      setBackgroundSessionId((prev) => (prev === active.id ? prev : active.id));
      return;
    }
    setBackgroundSessionId((prev) => {
      if (!prev) return null;
      const s = getSession(prev);
      return s?.status === "active" ? prev : null;
    });
  }, [agentName]);

  useEffect(() => {
    if (!remoteSupportEnabled) return undefined;
    syncBackgroundSession();
    return subscribeScreenShare(syncBackgroundSession);
  }, [syncBackgroundSession]);

  useEffect(() => {
    if (!remoteSupportEnabled || !backgroundSessionId) return undefined;
    return startSessionCloudPoll(backgroundSessionId);
  }, [backgroundSessionId]);

  useEffect(() => {
    if (!remoteSupportEnabled || !backgroundSessionId) return undefined;
    const syncEndedFromStore = () => {
      const s = getSession(backgroundSessionId);
      if (!s || s.status !== "ended") return;
      if (isGuestInitiatedEnd(s.endedReason)) {
        dismissToastsByDedupeKey(`guest-stream-${backgroundSessionId}`);
        notifiedRef.current.delete(`${backgroundSessionId}:stream`);
      }
      setViewOpen(false);
      setViewExpanded(false);
      setBackgroundSessionId((prev) => (prev === backgroundSessionId && s.status === "ended" ? null : prev));
    };
    syncEndedFromStore();
    return subscribeScreenShare(syncEndedFromStore);
  }, [backgroundSessionId]);

  const ensureBackgroundSession = useCallback((sessionId) => {
    if (!sessionId) return;
    markAgentPeerOpened(sessionId);
    setBackgroundSessionId(sessionId);
  }, []);

  const openSessionView = useCallback(
    (sessionId, { openPanel = false, showView = true } = {}) => {
      if (!sessionId) return;
      ensureBackgroundSession(sessionId);
      if (!showView) return;
      setViewExpanded(false);
      setViewOpen(true);
      window.dispatchEvent(new CustomEvent(REMOTE_SUPPORT_PANEL_CLOSE_EVENT));
      if (openPanel) {
        window.dispatchEvent(
          new CustomEvent(REMOTE_SUPPORT_OPEN_EVENT, {
            detail: { sessionId },
          })
        );
      }
    },
    [ensureBackgroundSession]
  );

  useEffect(() => {
    if (!remoteSupportEnabled || !agentName) return undefined;

    const dismissGuestStreamToast = (sessionId) => {
      if (!sessionId) return;
      dismissToastsByDedupeKey(`guest-stream-${sessionId}`);
      notifiedRef.current.delete(`${sessionId}:stream`);
    };

    const checkGuestConnected = () => {
      for (const key of [...notifiedRef.current]) {
        const sessionId = key.replace(/:stream$/, "");
        const s = getSession(sessionId);
        if (
          !s ||
          s.status === "ended" ||
          !s.guestStreamConnectedAt ||
          String(s.agentName || "").trim() !== String(agentName).trim()
        ) {
          dismissGuestStreamToast(sessionId);
        }
      }

      const sessions = listSessions().filter(
        (s) =>
          s.status === "active" &&
          s.agentPeerOpenedAt &&
          String(s.agentName || "").trim() === String(agentName).trim()
      );
      for (const s of sessions) {
        const key = `${s.id}:stream`;
        if (!s.guestStreamConnectedAt || notifiedRef.current.has(key)) continue;
        notifiedRef.current.add(key);
        toast({
          title: "הלקוח התחבר",
          description: "שיתוף המסך פעיל — לחצו לצפייה בהשתלטות מרחוק",
          duration: 0,
          dedupeKey: `guest-stream-${s.id}`,
          action: (
            <Button
              type="button"
              size="sm"
              className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => {
                openSessionView(s.id, { openPanel: false });
              }}
            >
              <MonitorPlay className="w-3.5 h-3.5 ml-1" />
              פתח צפייה
            </Button>
          ),
        });
      }
    };

    checkGuestConnected();
    return subscribeScreenShare(checkGuestConnected);
  }, [agentName, openSessionView]);

  const handleEnded = useCallback((sessionId) => {
    setBackgroundSessionId((prev) => (prev === sessionId ? null : prev));
    setViewOpen(false);
    setViewExpanded(false);
    dismissToastsByDedupeKey(`guest-stream-${sessionId}`);
    notifiedRef.current.delete(`${sessionId}:stream`);
  }, []);

  const value = useMemo(
    () => ({
      backgroundSessionId,
      viewOpen,
      viewExpanded,
      setViewOpen,
      setViewExpanded,
      ensureBackgroundSession,
      openSessionView,
    }),
    [
      backgroundSessionId,
      viewOpen,
      viewExpanded,
      ensureBackgroundSession,
      openSessionView,
    ]
  );

  return (
    <ScreenShareSessionContext.Provider value={value}>
      {children}
      {remoteSupportEnabled && backgroundSessionId && (
          <div
            className={
              viewOpen
                ? viewExpanded
                  ? "fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-3 sm:p-6"
                  : "fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
                : "fixed left-[-9999px] top-0 w-[320px] h-[180px] overflow-hidden opacity-0 pointer-events-none"
            }
            aria-hidden={!viewOpen}
            dir="rtl"
          >
            <div
              className={
                viewOpen
                  ? viewExpanded
                    ? "relative flex w-full max-w-5xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl pointer-events-auto"
                    : "relative flex w-full max-w-[min(520px,calc(100vw-2rem))] h-[min(420px,58vh)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl pointer-events-auto"
                  : "w-[320px] h-[180px]"
              }
            >
              {viewOpen && (
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-teal-50 px-3 py-2 sm:px-4 sm:py-2.5 shrink-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                    <MonitorPlay className="h-4 w-4 shrink-0" />
                    צפייה במסך הלקוח
                  </div>
                  <div className="flex items-center gap-1">
                    {viewExpanded ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-8"
                        onClick={() => setViewExpanded(false)}
                      >
                        <Minimize2 className="h-3.5 w-3.5" />
                        הקטן
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-8"
                        onClick={() => setViewExpanded(true)}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        הגדל
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs h-8"
                      onClick={() => {
                        setViewOpen(false);
                        setViewExpanded(false);
                      }}
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                      מזער
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-label="סגור תצוגה"
                      onClick={() => {
                        setViewOpen(false);
                        setViewExpanded(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div
                className={
                  viewOpen
                    ? viewExpanded
                      ? "min-h-0 flex-1 overflow-y-auto p-4"
                      : "min-h-0 flex-1 overflow-y-auto p-3"
                    : "w-[320px] h-[180px]"
                }
              >
                <ScreenShareAgentView
                  sessionId={backgroundSessionId}
                  agentName={agentName}
                  viewOpen={viewOpen}
                  onEnded={() => handleEnded(backgroundSessionId)}
                />
              </div>
            </div>
          </div>
      )}
    </ScreenShareSessionContext.Provider>
  );
}
