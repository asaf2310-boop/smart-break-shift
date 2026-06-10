import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Mail, MonitorPlay, ShieldAlert } from "lucide-react";
import { demoModeEnabled, demoSendRealEmailEnabled } from "@/api/demoClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { createCallLog, createEmailLog, getCustomerById } from "@/lib/crmStore";
import { useScreenShareSession } from "@/contexts/ScreenShareSessionContext";
import {
  buildScreenShareGuestUrl,
  buildScreenShareMailtoUrl,
  createScreenSession,
  DEMO_SCREEN_SHARE_EMAIL_MESSAGE,
  ensureGuestLinkReady,
  GUEST_LINK_CLOUD_PENDING_MESSAGE,
  endSession,
  getActiveScreenSessionForAgent,
  getLastEmailLogForSession,
  getSession,
  listSessionsForCustomer,
  markAgentPeerOpened,
  sendScreenShareEmail,
  startSessionCloudPoll,
  subscribeScreenShare,
} from "@/lib/screenShareStore";
import EmailStatusBanner from "@/components/remote/EmailStatusBanner";
import EmailDiagnosticButton from "@/components/remote/EmailDiagnosticButton";
import SessionEmailStatus from "@/components/remote/SessionEmailStatus";

const DEMO_BANNER =
  "שלב א — צפייה בדפדפן בלבד (PeerJS). דמו: PeerServer ציבורי; לפרודקשן יש לארח PeerServer או Supabase Realtime.";

function isValidEmail(value) {
  const trimmed = String(value || "").trim();
  return trimmed.includes("@") && trimmed.length > 3;
}

export default function ScreenSharePanel({
  agentName,
  crmCustomerId,
  customerName,
  customerEmail: customerEmailProp,
  hideEmailStatusBanner = false,
  onSessionActiveChange,
}) {
  const { toast } = useToast();
  const { openSessionView, backgroundSessionId } = useScreenShareSession();
  const [emailTo, setEmailTo] = useState("");
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [emailLogRevision, setEmailLogRevision] = useState(0);

  const defaultCustomerEmail = useMemo(() => {
    if (customerEmailProp) return String(customerEmailProp).trim();
    if (crmCustomerId) return getCustomerById(crmCustomerId)?.email?.trim() || "";
    return "";
  }, [customerEmailProp, crmCustomerId]);

  useEffect(() => {
    setEmailTo(defaultCustomerEmail);
  }, [defaultCustomerEmail]);

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
      setEmailLogRevision((n) => n + 1);
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

  const lastEmailLog = useMemo(() => {
    if (!session?.id) return null;
    return getLastEmailLogForSession(session.id);
  }, [session?.id, session?.emailSentAt, emailLogRevision]);

  const linkReady = Boolean(session?.agentPeerReadyAt);

  const guestUrl = useMemo(() => {
    if (!session?.id || !linkReady) return "";
    return buildScreenShareGuestUrl(session);
  }, [session, linkReady]);

  const mailtoHref = useMemo(
    () =>
      guestUrl
        ? buildScreenShareMailtoUrl({
            to: emailTo,
            customerName,
            agentName,
            guestUrl,
          })
        : null,
    [emailTo, customerName, agentName, guestUrl]
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

  const sendGuestLinkEmail = useCallback(
    async (activeSession, url) => {
      const result = await sendScreenShareEmail({
        to: emailTo,
        sessionId: activeSession.id,
        crmCustomerId,
        agentName,
        customerName,
        guestUrl: url,
      });
      const { log, simulated, message } = result;
      if (crmCustomerId) {
        createEmailLog({
          customer_id: crmCustomerId,
          to_email: log.to,
          subject: log.subject,
          body: log.body,
          agent_name: agentName,
          status: simulated ? "simulated" : "sent",
        });
      }
      if (simulated) {
        toast({
          title: demoSendRealEmailEnabled
            ? "המייל לא נשלח"
            : "סשן פעיל — הקישור מוכן",
          description: message || DEMO_SCREEN_SHARE_EMAIL_MESSAGE,
          variant: demoSendRealEmailEnabled ? "destructive" : undefined,
        });
      } else if (demoSendRealEmailEnabled) {
        toast({
          title: "סשן פעיל — הקישור מוכן",
          description: "נשלח במייל",
        });
      } else {
        toast({
          title: "סשן התחיל והקישור נשלח",
          description: `קישור שיתוף מסך נשלח ל-${log.to}. השאירו מסך זה פתוח.`,
        });
      }
    },
    [emailTo, crmCustomerId, agentName, customerName, toast]
  );

  const handleOpenAgentSession = async () => {
    if (!isValidEmail(emailTo)) {
      toast({
        title: "מייל לא תקין",
        description: "הזינו כתובת מייל תקינה של הלקוח",
        variant: "destructive",
      });
      return;
    }

    setOpening(true);
    try {
      let activeSession = session;
      if (!activeSession?.id || activeSession.status === "ended") {
        const created = createScreenSession({
          crmCustomerId,
          agentName,
          customerEmail: emailTo,
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
      openSessionView(opened.id);
      toast({
        title: "סשן נפתח",
        description: "ממתינים לחיבור — לאחר «מוכן לקישור» שלחו את הקישור ללקוח",
      });
    } finally {
      setOpening(false);
    }
  };

  const handleSendGuestLink = async () => {
    if (!session?.id) return;
    if (!linkReady) {
      toast({
        title: "המתינו לחיבור",
        description: "פתחו את סשן הצפייה והמתינו עד שיופיע «מוכן לקישור» לפני שליחה",
        variant: "destructive",
      });
      return;
    }
    if (!isValidEmail(emailTo)) {
      toast({
        title: "מייל לא תקין",
        description: "הזינו כתובת מייל תקינה של הלקוח",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const ready = await ensureGuestLinkReady(session);
      if (!ready.ok) {
        toast({
          title: "הקישור לא מוכן",
          description: "לא ניתן ליצור קישור קצר — נסו שוב",
          variant: "destructive",
        });
        return;
      }
      const linkedSession = ready.session || session;
      if (linkedSession !== session) setSession(linkedSession);
      const url = buildScreenShareGuestUrl(linkedSession);
      if (!url) {
        toast({
          title: "הקישור לא מוכן",
          description: "לא ניתן ליצור קישור — נסו שוב",
          variant: "destructive",
        });
        return;
      }
      await sendGuestLinkEmail(linkedSession, url);
      if (!ready.cloudSynced) {
        toast({
          title: "הקישור נשלח",
          description: GUEST_LINK_CLOUD_PENDING_MESSAGE,
        });
      }
    } catch (err) {
      setEmailLogRevision((n) => n + 1);
      const rateLimited = err.status === 429;
      const rateLimitLabel = err.limit ? `${err.limit} לשעה` : "מהשרת";
      toast({
        title: rateLimited ? `מגבלת שליחה (${rateLimitLabel})` : "לא הצליח",
        description: (
          <span>
            {err.message ||
              (rateLimited
                ? "יותר מדי שליחות מהדפדפן הזה — נסו שוב בעוד שעה או השתמשו ב-mailto"
                : "בדקו את כתובת המייל והרשת")}
            {session?.id && mailtoHref ? (
              <>
                {" "}
                — או{" "}
                <a href={mailtoHref} className="underline font-medium">
                  פתחו mailto
                </a>
              </>
            ) : null}
          </span>
        ),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleResendEmail = async () => {
    if (!session?.id || !guestUrl) return;
    if (!isValidEmail(emailTo)) {
      toast({
        title: "מייל לא תקין",
        description: "הזינו כתובת מייל תקינה של הלקוח",
        variant: "destructive",
      });
      return;
    }
    setResending(true);
    try {
      const ready = await ensureGuestLinkReady(session);
      if (!ready.ok) {
        toast({
          title: "הקישור לא מוכן",
          description: "לא ניתן לשלוח קישור — נסו שוב",
          variant: "destructive",
        });
        return;
      }
      const linkedSession = ready.session || session;
      if (linkedSession !== session) setSession(linkedSession);
      const url = buildScreenShareGuestUrl(linkedSession);
      if (!url) {
        toast({
          title: "הקישור לא מוכן",
          description: "לא ניתן לשלוח קישור — נסו שוב",
          variant: "destructive",
        });
        return;
      }
      await sendGuestLinkEmail(linkedSession, url);
      if (!ready.cloudSynced) {
        toast({
          title: "הקישור נשלח",
          description: GUEST_LINK_CLOUD_PENDING_MESSAGE,
        });
      }
      setEmailLogRevision((n) => n + 1);
    } catch (err) {
      setEmailLogRevision((n) => n + 1);
      const rateLimited = err.status === 429;
      const rateLimitLabel = err.limit ? `${err.limit} לשעה` : "מהשרת";
      toast({
        title: rateLimited ? `מגבלת שליחה (${rateLimitLabel})` : "לא הצליח לשלוח שוב",
        description: err.message || "בדקו את כתובת המייל והרשת",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const handleCopyLink = async () => {
    if (!session?.id) return;
    if (!linkReady) {
      toast({
        title: "המתינו לחיבור",
        description: "פתחו את סשן הצפייה והמתינו עד שיופיע «מוכן לקישור»",
        variant: "destructive",
      });
      return;
    }
    try {
      const ready = await ensureGuestLinkReady(session);
      if (!ready.ok) {
        toast({
          title: "הקישור לא מוכן",
          description: "לא ניתן להעתיק קישור — נסו שוב",
          variant: "destructive",
        });
        return;
      }
      const linkedSession = ready.session || session;
      if (linkedSession !== session) setSession(linkedSession);
      const url = buildScreenShareGuestUrl(linkedSession) || guestUrl;
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "הועתק",
        description: ready.cloudSynced
          ? "קישור הלקוח הועתק"
          : `קישור הלקוח הועתק. ${GUEST_LINK_CLOUD_PENDING_MESSAGE}`,
      });
    } catch {
      const url = buildScreenShareGuestUrl(session);
      toast({
        title: "לא הועתק",
        description: url || guestUrl,
        variant: "destructive",
      });
    }
  };

  const handleEndSession = useCallback(() => {
    if (session?.id) endSession(session.id);
    setSession(null);
    toast({ title: "הסתיים", description: "סשן צפייה במסך נסגר" });
  }, [session?.id, toast]);

  return (
    <div className="space-y-4" dir="rtl">
      {!hideEmailStatusBanner && <EmailStatusBanner />}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 flex items-start gap-2 text-teal-950 text-xs leading-relaxed">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-teal-700" />
        <span>{DEMO_BANNER}</span>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
        שלב א: <strong>פתחו סשן צפייה</strong> (החיבור מוכן) → שלחו קישור ללקוח → הלקוח מאשר
        ומשתף מסך — <strong>צפייה בלבד</strong>, ללא התקנת תוכנה. ניתן לסגור חלון זה ולהמשיך
        לעבוד — תקבלו התראה כשהלקוח יתחבר.
      </p>

      {!session?.agentPeerOpenedAt ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="space-y-1.5">
            <Label htmlFor="ss-email">מייל לקוח</Label>
            <Input
              id="ss-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="customer@example.com"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="text-left font-mono text-sm"
              dir="ltr"
            />
          </div>
          <div className="flex justify-end">
            <EmailDiagnosticButton />
          </div>
          <Button
            type="button"
            onClick={handleOpenAgentSession}
            disabled={!isValidEmail(emailTo) || opening}
            className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
          >
            <MonitorPlay className="w-4 h-4" />
            {opening ? "פותח סשן..." : "פתח סשן צפייה"}
          </Button>
          <p className="text-xs text-slate-500 leading-relaxed">
            הקישור ללקוח ייווצר רק אחרי שהחיבור מוכן — לא לפני.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {!linkReady && !session.guestStreamConnectedAt && !session.consentAt && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
              מפעיל חיבור לקבלת שיתוף מסך — המתינו עד שיופיע «מוכן לקישור» לפני שליחה ללקוח.
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
              מוכן לקישור — שלחו ללקוח את הקישור למטה.
            </p>
          )}
          {linkReady && !session.consentAt && lastEmailLog?.status === "sent" && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
              הקישור נשלח במייל — ממתין שהלקוח יפתח, יאשר וישתף מסך.
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
          <SessionEmailStatus
            log={lastEmailLog}
            sessionEmailSentAt={session.emailSentAt}
          />

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="space-y-1.5">
              <Label htmlFor="ss-email-resend">מייל לקוח (לשליחה מחדש)</Label>
              <Input
                id="ss-email-resend"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="text-left font-mono text-sm"
                dir="ltr"
              />
            </div>
            <Button
              type="button"
              onClick={handleSendGuestLink}
              disabled={!isValidEmail(emailTo) || sending || resending || !linkReady}
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <Mail className="w-4 h-4" />
              {sending
                ? "שולח..."
                : lastEmailLog?.status === "sent"
                  ? "שלח שוב במייל"
                  : demoSendRealEmailEnabled
                    ? "שלח קישור במייל"
                    : demoModeEnabled
                      ? "שלח קישור (דמו)"
                      : "שלח קישור במייל"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResendEmail}
              disabled={!isValidEmail(emailTo) || resending || sending || !linkReady}
              className="w-full gap-2 border-teal-300 text-teal-900 hover:bg-teal-50"
            >
              <Mail className="w-4 h-4" />
              {resending ? "שולח שוב..." : "שלח שוב במייל"}
            </Button>
          </div>

          {mailtoHref && (
            <a
              href={mailtoHref}
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800 hover:bg-teal-100"
            >
              <Mail className="w-4 h-4" />
              פתח בלקוח דוא״ל (mailto)
            </a>
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
