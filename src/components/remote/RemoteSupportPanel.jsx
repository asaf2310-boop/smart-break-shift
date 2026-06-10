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
import EmailDiagnosticButton from "@/components/remote/EmailDiagnosticButton";
import { useToast } from "@/components/ui/use-toast";
import { createCallLog, createEmailLog, getCustomerById } from "@/lib/crmStore";
import {
  buildConsentUrl,
  ensureConsentLinkReady,
  buildRustDeskDeepLink,
  buildRustDeskMailtoUrl,
  createSession,
  endSession,
  formatConnectionDetails,
  getSession,
  listSessions as listRustDeskSessions,
  remoteSupportFeaturesAvailable,
  sendRustDeskDownloadEmail,
  subscribeRemoteSupport,
} from "@/lib/remoteSupportStore";
import {
  cloudSessionSyncEnabled,
  syncRustDeskSessionToCloud,
  syncScreenShareSessionToCloud,
} from "@/lib/supportSessionsSync";
import {
  listSessions as listScreenShareSessions,
  REMOTE_SUPPORT_OPEN_EVENT,
} from "@/lib/screenShareStore";

const PANEL_DEMO_BANNER =
  "דמו — בחרו למטה: שלב א צפייה בדפדפן (ללא התקנה) או שליטה מלאה ב-RustDesk.";

const RUSTDESK_DEMO_BANNER =
  "לפרודקשן: שרת RustDesk עצמי (hbbs/hbbr) + מדיניות אבטחה; אל תשמרו סיסמאות ב-localStorage.";

function isValidEmail(value) {
  const trimmed = String(value || "").trim();
  return trimmed.includes("@") && trimmed.length > 3;
}

function normalizeRustDeskId(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 9);
}

export default function RemoteSupportPanel({
  agentName,
  crmCustomerId,
  customerName,
  customerEmail: customerEmailProp,
  compact = false,
  hideEmailStatusBanner = false,
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [supportMode, setSupportMode] = useState("screen");
  const [step, setStep] = useState(1);
  const [rustDeskId, setRustDeskId] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sendingRustDeskEmail, setSendingRustDeskEmail] = useState(false);
  const [startingRustDeskSession, setStartingRustDeskSession] = useState(false);
  const [screenSessionActive, setScreenSessionActive] = useState(false);

  const defaultCustomerEmail = useMemo(() => {
    if (customerEmailProp) return String(customerEmailProp).trim();
    if (crmCustomerId) return getCustomerById(crmCustomerId)?.email?.trim() || "";
    return "";
  }, [customerEmailProp, crmCustomerId]);

  const resetWizard = useCallback(() => {
    setSupportMode("screen");
    setStep(1);
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

  useEffect(() => {
    const onOpenRequest = () => {
      setOpen(true);
      setSupportMode("screen");
    };
    window.addEventListener(REMOTE_SUPPORT_OPEN_EVENT, onOpenRequest);
    return () => window.removeEventListener(REMOTE_SUPPORT_OPEN_EVENT, onOpenRequest);
  }, []);

  useEffect(() => {
    if (!open || !cloudSessionSyncEnabled()) return;
    for (const session of listScreenShareSessions()) {
      syncScreenShareSessionToCloud(session);
    }
    for (const session of listRustDeskSessions()) {
      syncRustDeskSessionToCloud(session);
    }
  }, [open]);

  useEffect(() => {
    if (!session?.id) return undefined;
    const refresh = () => {
      const latest = getSession(session.id);
      if (latest) setSession(latest);
    };
    refresh();
    return subscribeRemoteSupport(refresh);
  }, [session?.id]);

  const consentUrl = useMemo(() => {
    if (!session?.id) return "";
    return buildConsentUrl(session);
  }, [session]);

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

  const sendRustDeskLinkEmail = async (consentUrlForEmail, sessionIdForLog = null) => {
    const result = await sendRustDeskDownloadEmail({
      to: emailTo,
      sessionId: sessionIdForLog,
      crmCustomerId,
      agentName,
      customerName,
      consentUrl: consentUrlForEmail,
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
        title: "סשן פעיל — הקישור מוכן",
        description: message || "בדמו: הקישור מוכן — העתיקו את הקישור או פתחו mailto",
      });
    } else {
      toast({
        title: "סשן התחיל והקישור נשלח",
        description: `קישור RustDesk נשלח ל-${log.to}`,
      });
    }
  };

  const handleStartSessionAndSend = async () => {
    const normalizedId = normalizeRustDeskId(rustDeskId);
    if (normalizedId.length !== 9) {
      toast({
        title: "מזהה לא תקין",
        description: "מזהה RustDesk צריך להכיל 9 ספרות",
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

    setStartingRustDeskSession(true);
    try {
      const created = createSession({
        crmCustomerId,
        agentName,
        rustDeskId: normalizedId,
        password,
        customerEmail: emailTo,
      });
      setSession(created);
      setRustDeskId(normalizedId);

      if (crmCustomerId) {
        createCallLog({
          customer_id: crmCustomerId,
          call_type: "chat",
          summary: `תמיכה מרחוק (RustDesk) — מזהה ${normalizedId}. ממתין לאישור לקוח בקישור. סשן: ${created.id}`,
          agent_name: agentName,
          duration_minutes: null,
          referral_topic: null,
        });
      }

      const ready = await ensureConsentLinkReady(created);
      if (!ready.ok) {
        toast({
          title: "הקישור לא מוכן",
          description: "לא ניתן לשלוח קישור אישור — נסו שוב",
          variant: "destructive",
        });
        return;
      }
      const linkedSession = ready.session || created;
      if (linkedSession !== created) setSession(linkedSession);
      const consentUrlForEmail = buildConsentUrl(linkedSession);
      if (!consentUrlForEmail) {
        toast({
          title: "הקישור לא מוכן",
          description: "לא ניתן לשלוח קישור אישור — נסו שוב",
          variant: "destructive",
        });
        return;
      }
      await sendRustDeskLinkEmail(consentUrlForEmail, linkedSession.id);
      if (!ready.cloudSynced) {
        toast({
          title: "הקישור נשלח",
          description:
            "הסנכרון לענן עדיין בתהליך — אם הלקוח לא מצליח לפתוח את הקישור, נסו שוב בעוד רגע",
        });
      }
      setStep(3);
    } catch (err) {
      const rateLimited = err.status === 429;
      toast({
        title: rateLimited ? "מגבלת שליחה" : "לא הצליח",
        description: err.message || "בדקו מייל, מזהה RustDesk והרשת",
        variant: "destructive",
      });
    } finally {
      setStartingRustDeskSession(false);
    }
  };

  const handleCopyDetails = async () => {
    const details = formatConnectionDetails({
      rustDeskId: normalizeRustDeskId(rustDeskId),
      password,
      consentAt: session?.consentAt,
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
          title: "הקישור מוכן (דמו)",
          description: message || "בדמו: הקישור מוכן — העתיקו את הקישור או פתחו mailto",
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

  const renderEmailInput = () => (
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
  );

  const renderDownloadEmailBlock = () => (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      {renderEmailInput()}
      <div className="flex justify-end">
        <EmailDiagnosticButton />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={handleSendRustDeskEmail}
        disabled={!isValidEmail(emailTo) || sendingRustDeskEmail}
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
    </div>
  );

  const renderSessionMailtoSecondary = () =>
    mailtoHref ? (
      <a
        href={mailtoHref}
        className="flex items-center justify-center gap-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 hover:bg-indigo-100"
      >
        <Mail className="w-4 h-4" />
        פתח בלקוח דוא״ל (mailto)
      </a>
    ) : null;

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
        <DialogContent
          className={`rounded-2xl gap-0 p-0 overflow-hidden ${
            supportMode === "screen"
              ? "sm:max-w-3xl max-h-[95vh] overflow-y-auto"
              : "sm:max-w-lg"
          }`}
          dir="rtl"
        >
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
                שני מצבים: צפייה בדפדפן או RustDesk
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
                  ? "צפייה בלבד, ללא התקנה"
                  : "שליטה מלאה בעכבר ומקלדת"}
              </p>

              <TabsContent value="screen" className="mt-4 space-y-0">
                <ScreenSharePanel
                  agentName={agentName}
                  crmCustomerId={crmCustomerId}
                  customerName={customerName}
                  customerEmail={customerEmailProp}
                  hideEmailStatusBanner={hideEmailStatusBanner}
                  onSessionActiveChange={setScreenSessionActive}
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
                  , לשתף מזהה (9 ספרות) וסיסמה חד-פעמית, ולאשר גישה מרחוק בקישור האישור שנשלח במייל.
                </p>
                {renderDownloadEmailBlock()}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                {renderEmailInput()}
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
                {renderSessionMailtoSecondary()}
                {!session.consentAt && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                    ממתין לאישור הלקוח בקישור — שלחו קישור אישור במייל; האישור נרשם בדף{" "}
                    <code className="text-[11px]">/support/consent/…</code>
                  </p>
                )}
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
              {step === 1 && (
                <Button type="button" onClick={() => setStep(2)} className="w-full">
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
                    onClick={handleStartSessionAndSend}
                    disabled={!idValid || !isValidEmail(emailTo) || startingRustDeskSession}
                    className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Mail className="w-4 h-4" />
                    {startingRustDeskSession
                      ? "מפעיל סשן ושולח..."
                      : "התחל סשן ושלח קישור במייל"}
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
