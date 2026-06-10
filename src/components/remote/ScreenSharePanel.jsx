import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createCallLog } from "@/lib/crmStore";
import { useScreenShareSession } from "@/contexts/ScreenShareSessionContext";
import { cloudSessionSyncEnabled } from "@/lib/supportSessionsSync";
import {
  buildScreenShareGuestUrl,
  createScreenSession,
  ensureGuestLinkReady,
  endAgentScreenShareSession,
  getActiveScreenSessionForAgent,
  getSession,
  listSessionsForCustomer,
  markAgentPeerOpened,
  GUEST_LINK_CLOUD_PENDING_MESSAGE,
  startSessionCloudPoll,
  subscribeScreenShare,
} from "@/lib/screenShareStore";

export default function ScreenSharePanel({
  agentName,
  crmCustomerId,
  onSessionActiveChange,
}) {
  const { toast } = useToast();
  const { ensureBackgroundSession, openSessionView, backgroundSessionId } =
    useScreenShareSession();
  const [session, setSession] = useState(null);
  const [manualCopied, setManualCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [guestLinkUrl, setGuestLinkUrl] = useState("");
  const [guestLinkPreparing, setGuestLinkPreparing] = useState(false);
  const autoCopySessionRef = useRef(null);

  useEffect(() => {
    if (session?.id) return;
    let active = null;
    if (crmCustomerId) {
      active = listSessionsForCustomer(crmCustomerId).find((s) => s.status === "active");
    }
    if (!active && agentName) {
      active = getActiveScreenSessionForAgent(agentName);
    }
    if (active) setSession(active);
  }, [crmCustomerId, agentName, session?.id]);

  useEffect(() => {
    if (backgroundSessionId && !session?.id) {
      const linked = getSession(backgroundSessionId);
      if (linked?.status === "active") setSession(linked);
    }
  }, [backgroundSessionId, session?.id]);

  useEffect(() => {
    onSessionActiveChange?.(Boolean(session?.id && session?.status !== "ended"));
  }, [session?.id, session?.status, onSessionActiveChange]);

  useEffect(() => {
    if (!session?.id) return undefined;
    const refresh = () => {
      const latest = getSession(session.id);
      if (!latest || latest.status === "ended") {
        setSession(null);
      } else {
        setSession(latest);
      }
    };
    refresh();
    const stopCloudPoll =
      session.status === "active" ? startSessionCloudPoll(session.id) : () => {};
    const stopStore = subscribeScreenShare(refresh);
    return () => {
      stopCloudPoll();
      stopStore();
    };
  }, [session?.id, session?.status]);

  const linkReady = Boolean(session?.agentPeerReadyAt);

  const guestLinkShareable = Boolean(
    guestLinkUrl &&
      (!cloudSessionSyncEnabled() || session?.shortCodeCloudSynced)
  );

  const logSessionStart = useCallback(
    (created) => {
      if (!crmCustomerId) return;
      createCallLog({
        customer_id: crmCustomerId,
        call_type: "chat",
        summary: `צפייה במסך (דפדפן) — סשן ${created.id}. ממתין לאישור לקוח בקישור.`,
        agent_name: agentName,
        duration_minutes: null,
        referral_topic: null,
      });
    },
    [crmCustomerId, agentName]
  );

  const resolveShareableGuestUrl = useCallback(async (activeSession) => {
    const ready = await ensureGuestLinkReady(activeSession);
    if (!ready.ok) return { ok: false, url: "", session: activeSession, cloudSynced: false };

    const linkedSession = ready.session || activeSession;
    const url = buildScreenShareGuestUrl(linkedSession);
    const shareable =
      Boolean(url) &&
      (!cloudSessionSyncEnabled() || linkedSession.shortCodeCloudSynced);

    return {
      ok: shareable,
      url: shareable ? url : "",
      session: linkedSession,
      cloudSynced: ready.cloudSynced,
    };
  }, []);

  const copyGuestLink = useCallback(
    async (activeSession, { silent = false, showManualCopied = true } = {}) => {
      const resolved = await resolveShareableGuestUrl(activeSession);
      if (!resolved.ok || !resolved.url) {
        if (!silent) {
          toast({
            title: "הקישור לא מוכן",
            description: resolved.cloudSynced === false
              ? GUEST_LINK_CLOUD_PENDING_MESSAGE
              : "לא ניתן ליצור קישור — נסו שוב",
            variant: "destructive",
          });
        }
        return false;
      }
      if (resolved.session?.id) {
        const latest = getSession(resolved.session.id);
        if (latest) setSession(latest);
      }
      setGuestLinkUrl(resolved.url);
      await navigator.clipboard.writeText(resolved.url);
      if (showManualCopied) {
        setManualCopied(true);
        window.setTimeout(() => setManualCopied(false), 2000);
      }
      if (!silent) {
        toast({
          title: "הועתק",
          description: "קישור הלקוח הועתק — שלחו ללקוח",
        });
      }
      return true;
    },
    [resolveShareableGuestUrl, toast]
  );

  const handleOpenAgentSession = async () => {
    setOpening(true);
    try {
      let activeSession = session;
      if (!activeSession?.id || activeSession.status === "ended") {
        const created = createScreenSession({
          crmCustomerId,
          agentName,
          customerEmail: "",
        });
        activeSession = created;
        logSessionStart(created);
      }
      const opened = markAgentPeerOpened(activeSession.id);
      if (!opened) {
        toast({
          title: "לא ניתן לפתוח סשן",
          description: "נסו שוב",
          variant: "destructive",
        });
        return;
      }
      setSession(opened);
      setGuestLinkUrl("");
      autoCopySessionRef.current = null;
      ensureBackgroundSession(opened.id);
      toast({
        title: "סשן נפתח",
        description: "ממתינים לחיבור — הקישור יופיע להעתקה. לחצו «פתח צפייה» כשתרצו לראות את המסך",
      });
    } finally {
      setOpening(false);
    }
  };

  useEffect(() => {
    const sessionId = session?.id;
    if (!sessionId || !linkReady) {
      setGuestLinkUrl("");
      setGuestLinkPreparing(false);
      return undefined;
    }

    const alreadyShareable =
      Boolean(guestLinkUrl) &&
      (!cloudSessionSyncEnabled() || session.shortCodeCloudSynced);
    if (alreadyShareable) {
      setGuestLinkPreparing(false);
      return undefined;
    }

    let cancelled = false;
    setGuestLinkPreparing(true);

    void (async () => {
      const latest = getSession(sessionId) || session;
      const resolved = await resolveShareableGuestUrl(latest);
      if (cancelled) return;

      if (resolved.session?.id) {
        const refreshed = getSession(resolved.session.id);
        if (refreshed) setSession(refreshed);
      }

      if (resolved.ok && resolved.url) {
        setGuestLinkUrl(resolved.url);
        setGuestLinkPreparing(false);

        if (autoCopySessionRef.current !== sessionId) {
          autoCopySessionRef.current = sessionId;
          try {
            await navigator.clipboard.writeText(resolved.url);
            toast({
              title: "קישור מוכן",
              description: "הקישור הקצר הועתק ללוח — שלחו ללקוח",
            });
          } catch {
            toast({
              title: "קישור מוכן",
              description: "לחצו «העתק קישור» לשליחה ללקוח",
            });
          }
        }
        return;
      }

      if (!cancelled) setGuestLinkPreparing(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    session?.id,
    session?.shortCodeCloudSynced,
    session?.shortCode,
    linkReady,
    guestLinkUrl,
    resolveShareableGuestUrl,
    toast,
  ]);

  const handleCopyLink = async () => {
    if (!session?.id) return;
    if (!linkReady || guestLinkPreparing) {
      toast({
        title: "המתינו לקישור",
        description: "מכין קישור קצר — נסו שוב בעוד רגע",
        variant: "destructive",
      });
      return;
    }
    if (guestLinkUrl) {
      try {
        await navigator.clipboard.writeText(guestLinkUrl);
        setManualCopied(true);
        window.setTimeout(() => setManualCopied(false), 2000);
        toast({ title: "הועתק", description: "קישור הלקוח הועתק — שלחו ללקוח" });
      } catch {
        toast({ title: "לא הועתק", description: "נסו שוב", variant: "destructive" });
      }
      return;
    }
    try {
      await copyGuestLink(session, { showManualCopied: true });
    } catch {
      toast({
        title: "לא הועתק",
        description: "נסו שוב",
        variant: "destructive",
      });
    }
  };

  const handleEndSession = useCallback(() => {
    if (session?.id) endAgentScreenShareSession(session.id);
    setSession(null);
    setGuestLinkUrl("");
    autoCopySessionRef.current = null;
    toast({ title: "הסתיים", description: "סשן צפייה במסך נסגר" });
  }, [session?.id, toast]);

  return (
    <div className="space-y-4" dir="rtl">
      {!session?.agentPeerOpenedAt ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <Button
            type="button"
            onClick={handleOpenAgentSession}
            disabled={opening}
            className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
          >
            <MonitorPlay className="w-4 h-4" />
            {opening ? "פותח סשן..." : "פתח סשן צפייה"}
          </Button>
          <p className="text-xs text-slate-500 leading-relaxed text-center">
            לאחר הפתיחה ייווצר קישור להעתקה ללקוח
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {!linkReady && !session.guestStreamConnectedAt && !session.consentAt && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
              מפעיל חיבור — ממתין ל«מוכן לקישור»…
            </p>
          )}
          {!linkReady && (session.guestStreamConnectedAt || session.consentAt) && (
            <p className="text-sm text-teal-900 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 leading-relaxed font-medium">
              {session.guestStreamConnectedAt
                ? "לקוח מחובר — ממתין לווידאו בחלון הצפייה"
                : "הלקוח אישר — ממתין לשיתוף מסך"}
            </p>
          )}
          {linkReady && !session.consentAt && (
            <p className="text-sm text-teal-900 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 leading-relaxed font-medium">
              מוכן — העתיקו את הקישור ושלחו ללקוח
            </p>
          )}
          {session.consentAt && !session.recordingConsentAt && (
            <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 leading-relaxed">
              הלקוח אישר צפייה בלבד — כפתור «התחל הקלטה» יופעל רק אם הלקוח סימן «אישור הקלטה»
              בקישור.
            </p>
          )}
          {linkReady ? (
            guestLinkShareable ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-sm font-medium text-teal-900">קישור קצר מוכן ללקוח</p>
                {guestLinkUrl ? (
                  <p
                    className="text-xs text-slate-600 font-mono break-all whitespace-normal w-full text-left leading-relaxed select-all"
                    dir="ltr"
                  >
                    {guestLinkUrl}
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="w-full gap-1.5"
                >
                  {manualCopied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {manualCopied ? "הועתק" : "העתק קישור"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-600 rounded-lg border border-dashed border-slate-200 p-3 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                מכין קישור קצר ללקוח…
              </p>
            )
          ) : (
            <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 p-2 text-center">
              הקישור יופיע כשהחיבור מוכן
            </p>
          )}

          <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/80 p-3">
            {session.guestStreamConnectedAt ? (
              <p className="text-sm font-medium text-teal-900">
                הלקוח מחובר ומשתף מסך
              </p>
            ) : session.consentAt && session.agentPeerReadyAt ? (
              <p className="text-sm text-teal-900 font-medium">
                הלקוח משתף מסך — ממתין לווידאו
              </p>
            ) : session.consentAt ? (
              <p className="text-sm text-slate-700">הלקוח אישר — ממתין לשיתוף מסך</p>
            ) : (
              <p className="text-sm text-amber-800">ממתין שהלקוח יפתח את הקישור</p>
            )}
            <p className="text-xs text-slate-600 leading-relaxed">
              הסשן פעיל ברקע. ניתן לנווט בין מסכי המערכת — תופיע התראה כשהלקוח מתחבר.
            </p>
            <Button
              type="button"
              onClick={() => openSessionView(session.id, { openPanel: false })}
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <MonitorPlay className="w-4 h-4" />
              פתח צפייה במסך הלקוח
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleEndSession}
              className="w-full border-red-200 text-red-800 hover:bg-red-50"
            >
              סיים סשן ובטל קישור
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
