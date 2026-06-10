import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Minimize2, MonitorPlay, X } from "lucide-react";
import { remoteSupportEnabled } from "@/api/demoClient";
import { getStoredAgentName } from "@/constants/scheduling";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import ScreenShareAgentView from "@/components/remote/ScreenShareAgentView";
import {
  REMOTE_SUPPORT_OPEN_EVENT,
  getSession,
  listSessions,
  subscribeScreenShare,
} from "@/lib/screenShareStore";

const ScreenShareSessionContext = createContext(null);

export function useScreenShareSession() {
  return useContext(ScreenShareSessionContext) ?? {};
}

export function ScreenShareSessionProvider({ children }) {
  const agentName = getStoredAgentName();
  const [backgroundSessionId, setBackgroundSessionId] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
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
      setBackgroundSessionId(active.id);
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
    if (!remoteSupportEnabled || !agentName) return undefined;

    const checkGuestConnected = () => {
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
                setBackgroundSessionId(s.id);
                setViewOpen(true);
                window.dispatchEvent(
                  new CustomEvent(REMOTE_SUPPORT_OPEN_EVENT, {
                    detail: {
                      sessionId: s.id,
                      crmCustomerId: s.crmCustomerId,
                    },
                  })
                );
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
  }, [agentName]);

  const handleEnded = useCallback((sessionId) => {
    setBackgroundSessionId((prev) => (prev === sessionId ? null : prev));
    setViewOpen(false);
    notifiedRef.current.delete(`${sessionId}:stream`);
  }, []);

  const openSessionView = useCallback((sessionId, { openPanel = true } = {}) => {
    if (!sessionId) return;
    setBackgroundSessionId(sessionId);
    setViewOpen(true);
    if (openPanel) {
      window.dispatchEvent(
        new CustomEvent(REMOTE_SUPPORT_OPEN_EVENT, {
          detail: { sessionId },
        })
      );
    }
  }, []);

  const value = useMemo(
    () => ({
      backgroundSessionId,
      viewOpen,
      setViewOpen,
      openSessionView,
    }),
    [backgroundSessionId, viewOpen, openSessionView]
  );

  return (
    <ScreenShareSessionContext.Provider value={value}>
      {children}
      {remoteSupportEnabled && backgroundSessionId && (
        <div
          className={
            viewOpen
              ? "fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-3 sm:p-6"
              : "fixed left-[-9999px] top-0 w-[320px] h-[180px] overflow-hidden opacity-0 pointer-events-none"
          }
          aria-hidden={!viewOpen}
          dir="rtl"
        >
          <div
            className={
              viewOpen
                ? "relative flex w-full max-w-5xl max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                : "w-[320px] h-[180px]"
            }
          >
            {viewOpen && (
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-teal-50 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                  <MonitorPlay className="h-4 w-4" />
                  צפייה בהשתלטות מרחוק
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => setViewOpen(false)}
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    מזער — המשך לעבוד
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="סגור תצוגה"
                    onClick={() => setViewOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className={viewOpen ? "overflow-y-auto p-4" : "w-[320px] h-[180px]"}>
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
