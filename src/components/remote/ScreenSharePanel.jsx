import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Mail, MonitorPlay, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { createCallLog, createEmailLog, getCustomerById } from "@/lib/crmStore";
import {
  buildScreenShareGuestUrl,
  buildScreenShareMailtoUrl,
  createScreenSession,
  endSession,
  getSession,
  sendScreenShareEmail,
  subscribeScreenShare,
} from "@/lib/screenShareStore";
import ScreenShareAgentView from "@/components/remote/ScreenShareAgentView";
import EmailStatusBanner from "@/components/remote/EmailStatusBanner";

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
}) {
  const { toast } = useToast();
  const [emailTo, setEmailTo] = useState("");
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const defaultCustomerEmail = useMemo(() => {
    if (customerEmailProp) return String(customerEmailProp).trim();
    if (crmCustomerId) return getCustomerById(crmCustomerId)?.email?.trim() || "";
    return "";
  }, [customerEmailProp, crmCustomerId]);

  useEffect(() => {
    setEmailTo(defaultCustomerEmail);
  }, [defaultCustomerEmail]);

  useEffect(() => {
    if (!session?.id) return undefined;
    const refresh = () => {
      const latest = getSession(session.id);
      if (latest) setSession(latest);
    };
    refresh();
    return subscribeScreenShare(refresh);
  }, [session?.id]);

  const guestUrl = useMemo(() => {
    if (!session?.id) return "";
    return buildScreenShareGuestUrl(session.id);
  }, [session?.id]);

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
          title: "סשן פעיל — נרשם בדמו",
          description:
            message || "לא הוגדר Resend — השתמשו ב-mailto או פרסמו ב-Vercel",
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

  const handleStartSessionAndSend = async () => {
    if (!isValidEmail(emailTo)) {
      toast({
        title: "מייל לא תקין",
        description: "הזינו כתובת מייל תקינה של הלקוח",
        variant: "destructive",
      });
      return;
    }

    setStarting(true);
    try {
      let activeSession = session;
      if (!activeSession?.id) {
        const created = createScreenSession({
          crmCustomerId,
          agentName,
          customerEmail: emailTo,
        });
        activeSession = created;
        setSession(created);
        logSessionStart(created);
      }

      const url = buildScreenShareGuestUrl(activeSession.id);
      await sendGuestLinkEmail(activeSession, url);
    } catch (err) {
      toast({
        title: "לא הצליח",
        description: (
          <span>
            {err.message || "בדקו את כתובת המייל והרשת"}
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
      setStarting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!guestUrl) return;
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "הועתק", description: "קישור הלקוח הועתק" });
    } catch {
      toast({
        title: "לא הועתק",
        description: guestUrl,
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
        שלב א: הלקוח פותח קישור בדפדפן, מאשר ומשתף מסך — <strong>צפייה בלבד</strong>, ללא
        התקנת תוכנה. הנציג חייב להשאיר חלון זה פתוח בזמן הצפייה.
      </p>

      {!session ? (
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
          <Button
            type="button"
            onClick={handleStartSessionAndSend}
            disabled={!isValidEmail(emailTo) || starting}
            className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
          >
            <MonitorPlay className="w-4 h-4" />
            {starting ? "מפעיל סשן ושולח..." : "התחל סשן ושלח קישור במייל"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!session.consentAt && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
              ממתין לאישור הלקוח בקישור — הקישור נשלח במייל; האישור נרשם כשהלקוח מאשר בדף
              שיתוף המסך.
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-600 break-all rounded-lg border border-slate-200 p-2 bg-slate-50">
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono text-left flex-1" dir="ltr">
              {guestUrl}
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
          {mailtoHref && (
            <a
              href={mailtoHref}
              className="flex items-center justify-center gap-2 w-full rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800 hover:bg-teal-100"
            >
              <Mail className="w-4 h-4" />
              פתח בלקוח דוא״ל (mailto)
            </a>
          )}

          <ScreenShareAgentView sessionId={session.id} onEnded={handleEndSession} />
        </div>
      )}
    </div>
  );
}
