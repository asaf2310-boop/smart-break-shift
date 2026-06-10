import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createCallLog } from "@/lib/crmStore";
import { useScreenShareSession } from "@/contexts/ScreenShareSessionContext";
import {
  buildScreenShareGuestUrl,
  createScreenSession,
  ensureGuestLinkReady,
  endSession,
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
  const { openSessionView, backgroundSessionId } = useScreenShareSession();
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [autoCopiedForSession, setAutoCopiedForSession] = useState(null);

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

  const guestUrl = useMemo(() => {
    if (!session?.id || !linkReady) return "";
    return buildScreenShareGuestUrl(session);
  }, [session, linkReady]);

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

  const copyGuestLink = useCallback(
    async (activeSession, { silent = false } = {}) => {
      const ready = await ensureGuestLinkReady(activeSession);
      if (!ready.ok) {
        if (!silent) {
          toast({
            title: "הקישור לא מוכן",
            description: "לא ניתן ליצור קישור — נסו שוב",
            variant: "destructive",
          });
        }
        return false;
      }
      const linkedSession = ready.session || activeSession;
      if (linkedSession !== session) setSession(linkedSession);
      const url = buildScreenShareGuestUrl(linkedSession);
      if (!url) {
        if (!silent) {
          toast({
            title: "הקישור לא מוכן",
            description: "לא ניתן ליצור קישור — נסו שוב",
            variant: "destructive",
          });
        }
        return false;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (!silent) {
        toast({
          title: "הועתק",
          description: ready.cloudSynced
            ? "קישור הלקוח הועתק — שלחו ללקוח"
            : `קישור הלקוח הועתק. ${GUEST_LINK_CLOUD_PENDING_MESSAGE}`,
        });
      }
      return true;
    },
    [session, toast]
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
      setAutoCopiedForSession(null);
      openSessionView(opened.id);
      toast({
        title: "סשן נפתח",
        description: "ממתינים לחיבור — הקישור יופיע להעתקה",
      });
    } finally {
      setOpening(false);
    }
  };

  useEffect(() => {
    if (!session?.id || !linkReady || autoCopiedForSession === session.id) return;
    let cancelled = false;
    void (async () => {
      const ok = await copyGuestLink(session, { silent: true });
      if (!cancelled && ok) {
        setAutoCopiedForSession(session.id);
        toast({
          title: "קישור מוכן",
          description: "הקישור הועתק ללוח — שלחו ללקוח",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, linkReady, autoCopiedForSession, copyGuestLink, toast]);

  const handleCopyLink = async () => {
    if (!session?.id) return;
    if (!linkReady) {
      toast({
        title: "המתינו לחיבור",
        description: "המתינו עד שיופיע «מוכן לקישור»",
        variant: "destructive",
      });
      return;
    }
    try {
      await copyGuestLink(session);
    } catch {
      toast({
        title: "לא הועתק",
        description: guestUrl || "נסו שוב",
        variant: "destructive",
      });
    }
  };

  const handleEndSession = useCallback(() => {
    if (session?.id) endSession(session.id);
    setSession(null);
    setAutoCopiedForSession(null);
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
            <div className="flex items-center gap-2 text-xs text-slate-600 break-all rounded-lg border border-slate-200 p-2 bg-slate-50">
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-left flex-1" dir="ltr">
                {guestUrl || "טוען קישור…"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="shrink-0 gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                העתק
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 p-2 text-center">
              הקישור יופיע כאן כשהחיבור מוכן
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
              onClick={() => openSessionView(session.id)}
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
