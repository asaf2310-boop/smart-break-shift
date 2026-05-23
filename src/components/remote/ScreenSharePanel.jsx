import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Mail, MonitorPlay, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { createCallLog, createEmailLog, getCustomerById } from "@/lib/crmStore";
import {
  buildScreenShareGuestUrl,
  buildScreenShareMailtoUrl,
  createScreenSession,
  endSession,
  sendScreenShareEmail,
} from "@/lib/screenShareStore";
import ScreenShareAgentView from "@/components/remote/ScreenShareAgentView";
import EmailStatusBanner from "@/components/remote/EmailStatusBanner";

const DEMO_BANNER =
  "שלב א — צפייה בדפדפן בלבד (PeerJS). דמו: PeerServer ציבורי; לפרודקשן יש לארח PeerServer או Supabase Realtime.";

export default function ScreenSharePanel({
  agentName,
  crmCustomerId,
  customerName,
  customerEmail: customerEmailProp,
  hideEmailStatusBanner = false,
}) {
  const { toast } = useToast();
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const defaultCustomerEmail = useMemo(() => {
    if (customerEmailProp) return String(customerEmailProp).trim();
    if (crmCustomerId) return getCustomerById(crmCustomerId)?.email?.trim() || "";
    return "";
  }, [customerEmailProp, crmCustomerId]);

  useEffect(() => {
    setEmailTo(defaultCustomerEmail);
  }, [defaultCustomerEmail]);

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

  const handleCreateSession = () => {
    if (!voiceConsent) {
      toast({
        title: "נדרש אישור",
        description: "סמנו שהלקוח אישר בקול לפני יצירת סשן",
        variant: "destructive",
      });
      return;
    }
    const created = createScreenSession({
      crmCustomerId,
      agentName,
      customerEmail: emailTo,
    });
    setSession(created);

    if (crmCustomerId) {
      createCallLog({
        customer_id: crmCustomerId,
        call_type: "chat",
        summary: `צפייה במסך (דפדפן) — סשן ${created.id}. אישור נציג בקול.`,
        agent_name: agentName,
        duration_minutes: null,
        referral_topic: null,
      });
    }

    toast({
      title: "סשן צפייה נוצר",
      description: "שלחו ללקוח את הקישור והשאירו מסך זה פתוח",
    });
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

  const handleSendEmail = async () => {
    if (!session?.id) {
      toast({
        title: "צרו סשן קודם",
        description: "לחצו «התחל סשן צפייה» לפני שליחת מייל",
        variant: "destructive",
      });
      return;
    }
    setSendingEmail(true);
    try {
      const result = await sendScreenShareEmail({
        to: emailTo,
        sessionId: session.id,
        crmCustomerId,
        agentName,
        customerName,
        guestUrl,
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
          title: "נרשם בדמו",
          description: message || "לא הוגדר Resend — השתמשו ב-mailto או פרסמו ב-Vercel",
        });
      } else {
        toast({
          title: "נשלח למייל",
          description: `קישור שיתוף מסך נשלח ל-${log.to}`,
        });
      }
    } catch (err) {
      toast({
        title: "לא נשלח",
        description: (
          <span>
            {err.message || "בדקו את כתובת המייל"}
            {mailtoHref ? (
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
      setSendingEmail(false);
    }
  };

  const handleEndSession = useCallback(() => {
    if (session?.id) endSession(session.id);
    setSession(null);
    toast({ title: "הסתיים", description: "סשן צפייה במסך נסגר" });
  }, [session?.id, toast]);

  const renderEmailBlock = () => (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
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
        variant="outline"
        onClick={handleSendEmail}
        disabled={!emailTo.trim().includes("@") || !session?.id || sendingEmail}
        className="w-full gap-2 border-teal-200 text-teal-800 hover:bg-teal-50"
      >
        <Mail className="w-4 h-4" />
        {sendingEmail ? "שולח..." : "שלח במייל קישור שיתוף מסך"}
      </Button>
      {mailtoHref && session?.id && (
        <a
          href={mailtoHref}
          className="block text-center text-xs text-teal-600 hover:underline"
        >
          פתח בלקוח דוא״ל (mailto)
        </a>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {!hideEmailStatusBanner && <EmailStatusBanner />}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 flex items-start gap-2 text-teal-950 text-xs leading-relaxed">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-teal-700" />
        <span>{DEMO_BANNER}</span>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
        שלב א: הלקוח פותח קישור בדפדפן, מאשר ומשתף מסך — <strong>צפייה בלבד</strong>, ללא
        התקנת תוכנה. הנציג חייב להשאיר חלון זה פתוח בזמן הצפייה.
      </p>

      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-teal-200 bg-teal-50/40 p-3">
        <Checkbox
          checked={voiceConsent}
          onCheckedChange={(v) => setVoiceConsent(Boolean(v))}
          className="mt-0.5"
        />
        <span className="font-medium text-slate-800 text-sm">הלקוח אישר בקול</span>
      </label>

      {voiceConsent && renderEmailBlock()}

      {!session ? (
        <Button
          type="button"
          onClick={handleCreateSession}
          disabled={!voiceConsent}
          className="w-full gap-2 bg-teal-600 hover:bg-teal-700"
        >
          <MonitorPlay className="w-4 h-4" />
          התחל סשן צפייה
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 break-all rounded-lg border border-slate-200 p-2 bg-slate-50">
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono text-left flex-1" dir="ltr">
              {guestUrl}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0 gap-1">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              העתק
            </Button>
          </div>

          {voiceConsent && renderEmailBlock()}

          <ScreenShareAgentView sessionId={session.id} onEnded={handleEndSession} />
        </div>
      )}
    </div>
  );
}
