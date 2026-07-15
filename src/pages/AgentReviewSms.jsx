import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, MessageSquare, MessageSquareText, Send, ChevronRight } from "lucide-react";
import { demoModeEnabled } from "@/api/demoClient";
import { useToast } from "@/components/ui/use-toast";
import HypPageLayout from "@/components/hyp/HypPageLayout";
import { hypHeaderIconClass } from "@/lib/hypPage";
import { getAgentSession } from "@/lib/agentAuth";
import { getCachedBearerToken } from "@/lib/agentAuthClient";
import { useAgentSession } from "@/hooks/useAgentSession";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatAgentPhoneDisplay, normalizeAgentPhone } from "@/lib/agentPhone";
import {
  buildReviewSmsPreview,
  fetchReviewSmsConfig,
  getInitialReviewSmsConfigState,
  REVIEW_SMS_MAX_LENGTH,
  sendReviewSms,
  validateReviewSmsLength,
} from "@/lib/reviewSms";
import {
  SMS_TEMPLATES,
  TEMPLATE_SMS_MAX_LENGTH,
  buildTemplateSmsMessage,
  validateTemplateSmsLength,
  areTemplateFieldsFilled,
} from "@/lib/smsTemplates";
import { apiSendTemplateSms } from "@/lib/agentAuthClient";

function hasStoredAgentSession() {
  const session = getAgentSession();
  return Boolean(session?.email && session?.userId && session?.needsPasswordSetup !== true);
}

function TemplateCard({ template, isActive, onClick }) {
  const Icon = template.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-right rounded-2xl border p-4 transition-all duration-200 ${
        isActive
          ? "border-indigo-300 bg-indigo-50/80 shadow-md shadow-indigo-100/50 ring-2 ring-indigo-200/60"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={hypHeaderIconClass(
            `bg-gradient-to-br ${template.iconColor} shadow-lg ${template.iconShadow}`
          )}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isActive ? "text-indigo-900" : "text-slate-800"}`}>
            {template.label}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mt-0.5 line-clamp-1">
            {template.description}
          </p>
        </div>
        <ChevronRight
          className={`w-4 h-4 shrink-0 transition-transform ${
            isActive ? "text-indigo-500 rotate-90" : "text-slate-300"
          }`}
        />
      </div>
    </button>
  );
}

function TemplateFieldsForm({ template, values, onChange, disabled }) {
  if (!template?.fields?.length) return null;

  return (
    <div className="space-y-3">
      {template.fields.map((field) => (
        <div key={field.key}>
          <label
            htmlFor={`field-${field.key}`}
            className="block text-sm font-semibold text-slate-700 mb-1.5"
          >
            {field.label}
            {field.required && <span className="text-red-400 mr-1">*</span>}
          </label>
          <input
            id={`field-${field.key}`}
            type={field.type || "text"}
            dir={field.dir || "rtl"}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
            value={values[field.key] || ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

export default function AgentReviewSms() {
  const { toast } = useToast();
  const { isLoggedIn, isLikelyLoggedIn, bootstrapped, accessToken } = useAgentSession();
  const isAdmin = useIsAdmin();
  const [selectedTemplateId, setSelectedTemplateId] = useState("google_review");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [fieldValues, setFieldValues] = useState({});
  const [smsConfig, setSmsConfig] = useState(getInitialReviewSmsConfigState);

  const likelyLoggedIn = isLikelyLoggedIn || (!bootstrapped && hasStoredAgentSession());
  const selectedTemplate = SMS_TEMPLATES.find((t) => t.id === selectedTemplateId) || SMS_TEMPLATES[0];

  useEffect(() => {
    if (bootstrapped && !isLoggedIn) return undefined;
    const token = accessToken || getCachedBearerToken();
    if (!demoModeEnabled && !token && !hasStoredAgentSession()) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const config = await fetchReviewSmsConfig({ accessToken: token });
        if (!cancelled) {
          setSmsConfig({ loading: false, refreshing: false, ...config });
        }
      } catch {
        if (!cancelled) {
          setSmsConfig((prev) => ({
            ...prev,
            loading: false,
            refreshing: false,
            ok: false,
            smsUrl: null,
            source: null,
            message: "לא הצלחנו לטעון את הגדרות הקישור",
            dbError: "request_failed",
            dbErrorMessage: null,
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, isLoggedIn, accessToken]);

  const normalizedPhone = useMemo(() => normalizeAgentPhone(phone), [phone]);

  const preview = useMemo(() => {
    if (selectedTemplateId === "google_review") {
      return buildReviewSmsPreview(smsConfig.smsUrl);
    }
    return buildTemplateSmsMessage(selectedTemplateId, fieldValues);
  }, [selectedTemplateId, smsConfig.smsUrl, fieldValues]);

  const lengthCheck = useMemo(() => {
    if (selectedTemplateId === "google_review") {
      return validateReviewSmsLength(preview);
    }
    return validateTemplateSmsLength(preview);
  }, [selectedTemplateId, preview]);

  const previewTooLong = !lengthCheck.ok;
  const maxLength = selectedTemplateId === "google_review" ? REVIEW_SMS_MAX_LENGTH : TEMPLATE_SMS_MAX_LENGTH;

  const configPending = smsConfig.refreshing || smsConfig.loading;
  const hasSmsUrl = Boolean(smsConfig.smsUrl);
  const smsUrlMissing = !configPending && !smsConfig.ok;

  const isReviewTemplate = selectedTemplateId === "google_review";
  const waitingForUrl = isReviewTemplate && configPending && !hasSmsUrl;
  const reviewUrlMissing = isReviewTemplate && smsUrlMissing;

  const fieldsFilled = areTemplateFieldsFilled(selectedTemplate, fieldValues);

  const formDisabled = sending;
  const sendDisabled =
    sending ||
    !likelyLoggedIn ||
    !normalizedPhone ||
    previewTooLong ||
    (isReviewTemplate && (waitingForUrl || reviewUrlMissing)) ||
    (!isReviewTemplate && !fieldsFilled);

  if (bootstrapped && !isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  const handleFieldChange = (key, value) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!normalizedPhone) {
      toast({
        title: "מספר לא תקין",
        description: "הזינו מספר נייד ישראלי (05XXXXXXXX)",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      let result;

      if (selectedTemplateId === "google_review") {
        result = await sendReviewSms({ phone: normalizedPhone });
      } else {
        result = await apiSendTemplateSms({
          templateId: selectedTemplateId,
          phone: normalizedPhone,
          fields: fieldValues,
        });
      }

      if (!result.ok) {
        toast({
          title: "לא נשלח",
          description: result.message || "שליחת SMS נכשלה",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: result.simulated ? "SMS דמו" : "נשלח בהצלחה",
        description: result.simulated
          ? `סימולציה ל-${formatAgentPhoneDisplay(result.phone || normalizedPhone)}`
          : `SMS ${selectedTemplate.label} נשלח ל-${formatAgentPhoneDisplay(result.phone || normalizedPhone)}`,
      });
      setPhone("");
      if (!isReviewTemplate) {
        setFieldValues({});
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <HypPageLayout variant="scheduling" withNav={false} contentClassName="max-w-xl px-4 py-8">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לראשי
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center gap-3 justify-center mb-2">
          <div
            className={hypHeaderIconClass(
              "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25"
            )}
          >
            <MessageSquareText className="w-5 h-5 text-white" />
          </div>
          <h1 className="hyp-scheduling-title text-2xl font-extrabold text-slate-800 tracking-tight">
            SMS ללקוח
          </h1>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
          בחרו תבנית, מלאו פרטים ושלחו SMS ללקוח בלחיצה אחת.
        </p>
      </motion.div>

      {/* Template selector */}
      <div className="space-y-2.5 mb-6">
        <p className="text-xs font-semibold text-slate-500 mb-2">בחרו תבנית SMS</p>
        {SMS_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isActive={template.id === selectedTemplateId}
            onClick={() => handleSelectTemplate(template.id)}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTemplateId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {/* Review template URL config status */}
          {isReviewTemplate && (hasSmsUrl || smsUrlMissing) && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm text-center leading-relaxed ${
                smsUrlMissing
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {smsUrlMissing ? (
                <span>
                  {smsConfig.dbError === "app_settings_missing" && smsConfig.dbErrorMessage
                    ? smsConfig.dbErrorMessage
                    : smsConfig.message || "קישור דירוג לא מוגדר ל-SMS."}
                </span>
              ) : (
                <>
                  הקישור שיישלח ב-SMS:{" "}
                  <code className="text-xs font-mono" dir="ltr">
                    {smsConfig.smsUrl}
                  </code>
                  {configPending && (
                    <Loader2
                      className="inline w-3.5 h-3.5 animate-spin opacity-60 ms-1.5 align-[-2px]"
                      aria-label="מעדכן קישור"
                    />
                  )}
                </>
              )}
              {smsUrlMissing && (
                <p className="mt-2 text-xs opacity-80">
                  {isAdmin ? (
                    <>
                      הגדירו קישור קצר (מומלץ{" "}
                      <code className="text-[11px]" dir="ltr">
                        g.page/r/…/review
                      </code>
                      ) ב{" "}
                      <Link to="/admin" className="underline font-medium hover:text-amber-950">
                        דשבורד מנהל
                      </Link>{" "}
                      → קישור דירוג גוגל ל-SMS.
                      {smsConfig.dbError === "app_settings_missing" ? (
                        <span className="block mt-1">
                          לפני השמירה הראשונה: הריצו{" "}
                          <code className="text-[11px]" dir="ltr">
                            app_settings_review_url.sql
                          </code>{" "}
                          ב-Supabase.
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "פנה למנהל להגדרת קישור דירוג גוגל ל-SMS."
                  )}
                </p>
              )}
            </div>
          )}

          <form
            onSubmit={handleSend}
            className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-5"
          >
            {/* Template-specific fields */}
            {!isReviewTemplate && selectedTemplate.fields.length > 0 && (
              <TemplateFieldsForm
                template={selectedTemplate}
                values={fieldValues}
                onChange={handleFieldChange}
                disabled={formDisabled}
              />
            )}

            {/* Phone number */}
            <div>
              <label htmlFor="sms-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
                מספר טלפון לקוח
              </label>
              <input
                id="sms-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                placeholder="05XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={formDisabled}
              />
              {phone && !normalizedPhone && (
                <p className="mt-1.5 text-xs text-red-500">מספר לא תקין — השתמשו בפורמט ישראלי</p>
              )}
              {normalizedPhone && (
                <p className="mt-1.5 text-xs text-slate-400">
                  יישלח ל: {formatAgentPhoneDisplay(normalizedPhone)}
                </p>
              )}
            </div>

            {/* Preview */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                תצוגה מקדימה
                {isReviewTemplate && configPending && (
                  <span className="inline-flex items-center gap-1 font-normal text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                    מעדכן קישור...
                  </span>
                )}
              </p>
              <div
                className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  previewTooLong
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-slate-50 border-slate-100 text-slate-700"
                }`}
              >
                {preview || (
                  <span className="text-slate-400 italic">מלאו את השדות לתצוגה מקדימה</span>
                )}
              </div>
              <p className={`mt-1.5 text-xs ${previewTooLong ? "text-red-500" : "text-slate-400"}`}>
                {lengthCheck.length}/{maxLength} תווים
                {previewTooLong ? ` — ${lengthCheck.message}` : ""}
              </p>
            </div>

            {/* Send button */}
            <div>
              <button
                type="submit"
                disabled={sendDisabled}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold py-3 text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    שלח SMS — {selectedTemplate.label}
                  </>
                )}
              </button>
              {isReviewTemplate && waitingForUrl && (
                <p className="mt-2 text-xs text-slate-400 text-center">ממתין לטעינת קישור דירוג...</p>
              )}
              {isReviewTemplate && !waitingForUrl && reviewUrlMissing && (
                <p className="mt-2 text-xs text-amber-700 text-center">
                  לא ניתן לשלוח ללא קישור דירוג מוגדר
                </p>
              )}
              {!isReviewTemplate && !fieldsFilled && (
                <p className="mt-2 text-xs text-slate-400 text-center">מלאו את כל השדות הנדרשים</p>
              )}
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </HypPageLayout>
  );
}
