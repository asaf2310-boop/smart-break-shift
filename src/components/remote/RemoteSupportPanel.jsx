import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  Monitor,
  MonitorPlay,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScreenSharePanel from "@/components/remote/ScreenSharePanel";
import { useToast } from "@/components/ui/use-toast";
import { createCallLog, createEmailLog, getCustomerById } from "@/lib/crmStore";
import {
  buildConsentUrl,
  buildRustDeskDeepLink,
  buildRustDeskMailtoUrl,
  CONSENT_TEXT_DEFAULT,
  createSession,
  endSession,
  formatConnectionDetails,
  logConsent,
  remoteSupportFeaturesAvailable,
  sendRustDeskDownloadEmail,
} from "@/lib/remoteSupportStore";

const PANEL_DEMO_BANNER =
  "דמו — בחרו למטה: שלב א צפייה בדפדפן (ללא התקנה) או שליטה מלאה ב-RustDesk.";

const RUSTDESK_DEMO_BANNER =
  "לפרודקשן: שרת RustDesk עצמי (hbbs/hbbr) + מדיניות אבטחה; אל תשמרו סיסמאות ב-localStorage.";

function normalizeRustDeskId(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 9);
}

export default function RemoteSupportPanel({
  agentName,
  crmCustomerId,
  customerName,
  customerEmail: customerEmailProp,
  compact = false,
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [supportMode, setSupportMode] = useState("screen");
  const [step, setStep] = useState(1);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [rustDeskId, setRustDeskId] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sendingRustDeskEmail, setSendingRustDeskEmail] = useState(false);

  const defaultCustomerEmail = useMemo(() => {
    if (customerEmailProp) return String(customerEmailProp).trim();
    if (crmCustomerId) return getCustomerById(crmCustomerId)?.email?.trim() || "";
    return "";
  }, [customerEmailProp, crmCustomerId]);

  const resetWizard = useCallback(() => {
    setSupportMode("screen");
    setStep(1);
    setVoiceConsent(false);
    setRustDeskId("");
    setPassword("");
    setSession(null);
    setCopied(false);
  }, []);

  useEffect(() => {
    if (!open) resetWizard();
  }, [open, resetWizard]);

  useEffect(() => {
    if (open) setEmailTo(defaultCustomerEmail);
  }, [open, defaultCustomerEmail]);

  const consentUrl = useMemo(() => {
    if (!session?.id) return "";
    return buildConsentUrl(session.id);
  }, [session?.id]);

  const deepLink = useMemo(
    () => buildRustDeskDeepLink(rustDeskId, password),
    [rustDeskId, password]
  );

  if (!remoteSupportFeaturesAvailable()) return null;

  const idValid = normalizeRustDeskId(rustDeskId).length === 9;

  const handleOpen = () => {
    if (!agentName) {
      toast({
        title: "נדרשת התחברות",
        description: "יש להתחבר כנציג לפני תמיכה מרחוק",
        variant: "destructive",
      });
      return;
    }
    setSupportMode("screen");
    setStep(1);
    setOpen(true);
  };

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSupportMode("screen");
      setStep(1);
    }
  };

  const handleNextFromConsent = () => {
    if (!voiceConsent) {
      toast({
        title: "נדרש אישור",
        description: "סמנו שהלקוח אישר בקול לפני המשך",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleStartSession = () => {
    const normalizedId = normalizeRustDeskId(rustDeskId);
    if (normalizedId.length !== 9) {
      toast({
        title: "מזהה לא תקין",
        description: "מזהה RustDesk צריך להכיל 9 ספרות",
        variant: "destructive",
      });
      return;
    }
    const created = createSession({
      crmCustomerId,
      agentName,
      rustDeskId: normalizedId,
      password,
    });
    logConsent(created.id, { consentText: CONSENT_TEXT_DEFAULT, source: "agent" });
    setSession(created);
    setRustDeskId(normalizedId);
    setStep(3);

    if (crmCustomerId) {
      createCallLog({
        customer_id: crmCustomerId,
        call_type: "chat",
        summary: `תמיכה מרחוק (RustDesk) — מזהה ${normalizedId}. אישור נציג בקול. סשן: ${created.id}`,
        agent_name: agentName,
        duration_minutes: null,
        referral_topic: null,
      });
    }

    toast({
      title: "סשן נרשם",
      description: customerName
        ? `תיעוד נשמר עבור ${customerName}`
        : "פרטי החיבור מוכנים",
    });
  };

  const handleCopyDetails = async () => {
    const details = formatConnectionDetails({
      rustDeskId: normalizeRustDeskId(rustDeskId),
      password,
      consentAt: session?.consentAt || new Date().toISOString(),
    });
    const extra = consentUrl ? `\nקישור אישור ללקוח: ${consentUrl}` : "";
    try {
      await navigator.clipboard.writeText(`${details}${extra}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "הועתק", description: "פרטי החיבור הועתקו ללוח" });
    } catch {
      toast({
        title: "לא הועתק",
        description: "העתיקו ידנית את השדות",
        variant: "destructive",
      });
    }
  };

  const handleOpenRustDesk = () => {
    if (!deepLink) return;
    window.location.href = deepLink;
    toast({
      title: "נפתח RustDesk",
      description: "אם לא נפתח — התקינו RustDesk או העתיקו את המזהה ידנית",
    });
  };

  const handleEndSession = () => {
    if (session?.id) endSession(session.id);
    toast({ title: "הסתיים", description: "הסשן נסגר וסיסמה הוסרה מהאחסון המקומי" });
    setOpen(false);
  };

  const emailConsentUrl = session?.id ? consentUrl : null;

  const mailtoHref = useMemo(
    () =>
      buildRustDeskMailtoUrl({
        to: emailTo,
        customerName,
        agentName,
        consentUrl: emailConsentUrl,
      }),
    [emailTo, customerName, agentName, emailConsentUrl]
  );

  const handleSendRustDeskEmail = async () => {
    setSendingRustDeskEmail(true);
    try {
      const result = await sendRustDeskDownloadEmail({
        to: emailTo,
        sessionId: session?.id || null,
        crmCustomerId,
        agentName,
        customerName,
        consentUrl: emailConsentUrl,
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
          description: `קישור הורדת RustDesk נשלח ל-${log.to}`,
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
      setSendingRustDeskEmail(false);
    }
  };

  const showEmailBlock = step === 1 ? voiceConsent : step >= 2;

  const renderEmailBlock = () => (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="space-y-1.5">
        <Label htmlFor="rs-email">מייל לקוח</Label>
        <Input
          id="rs-email"
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
        onClick={handleSendRustDeskEmail}
        disabled={!emailTo.trim().includes("@") || sendingRustDeskEmail}
        className="w-full gap-2 border-indigo-200 text-indigo-800 hover:bg-indigo-50"
      >
        <Mail className="w-4 h-4" />
        {sendingRustDeskEmail ? "שולח..." : "שלח במייל קישור להורדת RustDesk"}
      </Button>
      {mailtoHref && (
        <a
          href={mailtoHref}
          className="block text-center text-xs text-indigo-600 hover:underline"
        >
          פתח בלקוח דוא״ל (mailto)
        </a>
      )}
      {emailConsentUrl && (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          המייל יכלול גם קישור אישור: {emailConsentUrl}
        </p>
      )}
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        onClick={handleOpen}
        className={
          compact
            ? "w-full gap-2 border-teal-300 text-teal-800 hover:bg-teal-50"
            : "gap-2 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md"
        }
      >
        <Monitor className="w-4 h-4" />
        תמיכה מרחוק
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg rounded-2xl gap-0 p-0 overflow-hidden" dir="rtl">
          <div className="bg-violet-50 border-b border-violet-200 px-4 py-2 flex items-start gap-2 text-violet-950 text-xs leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-violet-700" />
            <span>{PANEL_DEMO_BANNER}</span>
          </div>

          <div className="p-5 space-y-4">
            <DialogHeader className="text-right space-y-1">
              <DialogTitle className="flex items-center gap-2 justify-end text-lg">
                <Monitor className="w-5 h-5 text-indigo-600" />
                תמיכה מרחוק
              </DialogTitle>
              <DialogDescription>
                {customerName
                  ? `לקוח: ${customerName} · `
                  : ""}
                שני מצבים: צפייה בדפדפן (שלב א) או RustDesk
              </DialogDescription>
            </DialogHeader>

            <Tabs
              value={supportMode}
              onValueChange={setSupportMode}
              defaultValue="screen"
              className="w-full"
              dir="rtl"
            >
              <p className="text-xs font-semibold text-slate-600 text-center mb-1">
                בחרו מצב תמיכה
              </p>
              <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-slate-100">
                <TabsTrigger
                  value="screen"
                  className="text-xs sm:text-sm py-2.5 gap-1 data-[state=active]:bg-teal-600 data-[state=active]:text-white"
                >
                  <MonitorPlay className="w-3.5 h-3.5 shrink-0" />
                  צפייה במסך (דפדפן)
                </TabsTrigger>
                <TabsTrigger
                  value="rustdesk"
                  className="text-xs sm:text-sm py-2.5 gap-1 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                >
                  <Monitor className="w-3.5 h-3.5 shrink-0" />
                  שליטה מלאה — RustDesk
                </TabsTrigger>
              </TabsList>
              <p className="text-[11px] text-center text-slate-500 mt-1">
                {supportMode === "screen"
                  ? "שלב א — צפייה בלבד, ללא התקנה"
                  : "שליטה מלאה בעכבר ומקלדת"}
              </p>

              <TabsContent value="screen" className="mt-4 space-y-0">
                <ScreenSharePanel
                  agentName={agentName}
                  crmCustomerId={crmCustomerId}
                  customerName={customerName}
                  customerEmail={customerEmailProp}
                />
              </TabsContent>

              <TabsContent value="rustdesk" className="mt-4 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2 text-amber-950 text-xs leading-relaxed">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>{RUSTDESK_DEMO_BANNER}</span>
            </div>
            <div className="flex gap-1 justify-center">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    step >= n ? "bg-indigo-500" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4 text-sm text-slate-700">
                <p className="leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                  הסבירו ללקוח: יש להתקין{" "}
                  <a
                    href="https://rustdesk.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-semibold underline"
                  >
                    RustDesk
                  </a>
                  , לשתף מזהה (9 ספרות) וסיסמה חד-פעמית, ולאשר גישה מרחוק לטיפול בתקלה בלבד.
                </p>
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
                  <Checkbox
                    checked={voiceConsent}
                    onCheckedChange={(v) => setVoiceConsent(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span className="font-medium text-slate-800">הלקוח אישר בקול</span>
                </label>
                {showEmailBlock && renderEmailBlock()}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rs-id">מזהה RustDesk (9 ספרות)</Label>
                  <Input
                    id="rs-id"
                    inputMode="numeric"
                    placeholder="123456789"
                    value={rustDeskId}
                    onChange={(e) => setRustDeskId(normalizeRustDeskId(e.target.value))}
                    className="font-mono text-left"
                    dir="ltr"
                    maxLength={9}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rs-pw">סיסמה חד-פעמית (אופציונלי)</Label>
                  <Input
                    id="rs-pw"
                    type="password"
                    autoComplete="off"
                    placeholder="מהלקוח ב-RustDesk"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="font-mono text-left"
                    dir="ltr"
                  />
                  <p className="text-xs text-slate-500">
                    בדמו נשמרת ב-localStorage — בפרודקשן להימנע משמירה ארוכת טווח.
                  </p>
                </div>
                {showEmailBlock && renderEmailBlock()}
              </div>
            )}

            {step === 3 && session && (
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 font-mono text-left" dir="ltr">
                  <p>ID: {session.rustDeskId}</p>
                  {password && <p>Password: {password}</p>}
                </div>
                {consentUrl && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 break-all">
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{consentUrl}</span>
                  </div>
                )}
                <p className="text-xs text-slate-500 leading-relaxed">
                  אם הקישור <code className="text-[11px]">rustdesk://</code> לא נפתח — פתחו את אפליקציית
                  RustDesk → «חיבור» → הדביקו מזהה וסיסמה.
                </p>
                {showEmailBlock && renderEmailBlock()}
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
              {step === 1 && (
                <Button type="button" onClick={handleNextFromConsent} className="w-full">
                  המשך
                </Button>
              )}
              {step === 2 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="w-full"
                  >
                    חזרה
                  </Button>
                  <Button
                    type="button"
                    onClick={handleStartSession}
                    disabled={!idValid}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    התחל סשן ותעד
                  </Button>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Button type="button" variant="outline" onClick={handleCopyDetails} className="gap-1">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      העתק פרטים
                    </Button>
                    <Button
                      type="button"
                      onClick={handleOpenRustDesk}
                      disabled={!deepLink}
                      className="gap-1 bg-teal-600 hover:bg-teal-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                      פתח RustDesk
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleEndSession}
                    className="w-full"
                  >
                    סיים סשן
                  </Button>
                </>
              )}
            </DialogFooter>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
