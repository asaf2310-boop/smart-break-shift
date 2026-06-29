import React, { useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatAgentPhoneDisplay, normalizeAgentPhone } from "@/lib/agentPhone";
import {
  buildWealthyGuideSmsPreview,
  getWealthyGuideSmsUrls,
  sendWealthyGuideLinksSms,
  validateWealthyGuideSmsLength,
  WEALTHY_GUIDE_SMS_VARIANTS,
} from "@/lib/wealthyGuideSms";
import { REVIEW_SMS_MAX_LENGTH } from "@/lib/reviewSms";

export default function WealthyGuideSmsDialog({
  open,
  onOpenChange,
  initialPhone = "",
  guideType = "manual-charge",
}) {
  const { toast } = useToast();
  const [phone, setPhone] = useState(initialPhone);
  const [variant, setVariant] = useState("both");
  const [sending, setSending] = useState(false);

  const normalizedPhone = useMemo(() => normalizeAgentPhone(phone), [phone]);
  const preview = useMemo(
    () => buildWealthyGuideSmsPreview(variant, guideType),
    [variant, guideType],
  );
  const { guideUrl, presentationUrl } = useMemo(
    () => getWealthyGuideSmsUrls(guideType),
    [guideType],
  );
  const lengthCheck = useMemo(() => validateWealthyGuideSmsLength(preview), [preview]);
  const previewTooLong = !lengthCheck.ok;

  const handleOpenChange = (next) => {
    if (!next) {
      setSending(false);
    } else if (initialPhone && !phone) {
      setPhone(initialPhone);
    }
    onOpenChange(next);
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
    if (previewTooLong) {
      toast({
        title: "הודעה ארוכה מדי",
        description: lengthCheck.message,
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const result = await sendWealthyGuideLinksSms({
        phone: normalizedPhone,
        variant,
        guideType,
      });
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
          ? `סימולציה ל-${formatAgentPhoneDisplay(result.phone)}`
          : `נשלח ל-${formatAgentPhoneDisplay(result.phone)}`,
      });
      setPhone("");
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            שליחת קישורים ב-SMS
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="wg-sms-phone" className="block text-sm font-medium text-on-surface mb-1.5">
              מספר טלפון לקוח
            </label>
            <input
              id="wg-sms-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XXXXXXXX"
              className="w-full rounded-xl border border-outline/25 bg-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={sending}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-on-surface mb-1">מה לשלוח?</legend>
            {WEALTHY_GUIDE_SMS_VARIANTS.map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                  variant === option.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-outline/20 hover:border-outline/35"
                }`}
              >
                <input
                  type="radio"
                  name="wg-sms-variant"
                  value={option.id}
                  checked={variant === option.id}
                  onChange={() => setVariant(option.id)}
                  disabled={sending}
                  className="accent-primary"
                />
                <span className="text-sm text-on-surface">{option.label}</span>
              </label>
            ))}
          </fieldset>

          <div className="rounded-xl border border-outline/15 bg-surface-container-low p-3 space-y-2">
            <p className="text-xs font-medium text-on-surface-variant">תצוגה מקדימה</p>
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{preview}</p>
            <p
              className={`text-xs ${previewTooLong ? "text-error" : "text-on-surface-variant"}`}
              dir="ltr"
            >
              {preview.length} / {REVIEW_SMS_MAX_LENGTH}
            </p>
          </div>

          <div className="text-xs text-on-surface-variant space-y-1">
            <p>
              מדריך (PDF):{" "}
              <code className="text-[11px] break-all" dir="ltr">
                {guideUrl}
              </code>
            </p>
            <p>
              מצגת (סרטון):{" "}
              <code className="text-[11px] break-all" dir="ltr">
                {presentationUrl}
              </code>
            </p>
            <p className="text-[11px] pt-1">
              הקישורים מובילים לדפי אורח ציבוריים — ללא התחברות נציג.
            </p>
          </div>

          <button
            type="submit"
            disabled={sending || !normalizedPhone || previewTooLong}
            className="m3-btn-filled w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                שולח...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                שלח SMS
              </>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
