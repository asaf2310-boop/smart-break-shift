import { Star, Monitor } from "lucide-react";

export const TEMPLATE_SMS_MAX_LENGTH = 500;

/** @type {Array<import('./smsTemplates').SmsTemplate>} */
export const SMS_TEMPLATES = [
  {
    id: "google_review",
    label: "דירוג גוגל",
    description: "שליחת SMS ללקוח עם קישור לדירוג העסק בגוגל",
    icon: Star,
    iconColor: "from-amber-400 to-yellow-500",
    iconShadow: "shadow-amber-500/25",
    fields: [],
    requiresConfig: true,
    sendAction: "send_review_sms",
  },
  {
    id: "terminal_details",
    label: "פרטי מסוף",
    description: "שליחת פרטי מסוף (שם משתמש, סיסמא, מספר מסוף) ללקוח",
    icon: Monitor,
    iconColor: "from-blue-500 to-indigo-600",
    iconShadow: "shadow-blue-500/25",
    fields: [
      { key: "terminal_number", label: "מספר מסוף", type: "text", required: true, dir: "ltr" },
      { key: "username", label: "שם משתמש", type: "text", required: true, dir: "ltr" },
      { key: "password", label: "סיסמא", type: "text", required: true, dir: "ltr" },
    ],
    requiresConfig: false,
    sendAction: "send_template_sms",
  },
];

export function getTemplateById(id) {
  return SMS_TEMPLATES.find((t) => t.id === id) || null;
}

export function buildTerminalDetailsSmsMessage(fields) {
  const terminalNumber = String(fields.terminal_number || "").trim();
  const username = String(fields.username || "").trim();
  const password = String(fields.password || "").trim();

  const lines = ["להלן פרטי המסוף שלך:"];
  if (terminalNumber) lines.push(`מספר מסוף: ${terminalNumber}`);
  if (username) lines.push(`שם משתמש: ${username}`);
  if (password) lines.push(`סיסמא: ${password}`);

  return lines.join("\n");
}

export function buildTemplateSmsMessage(templateId, fields) {
  if (templateId === "terminal_details") {
    return buildTerminalDetailsSmsMessage(fields);
  }
  return "";
}

export function validateTemplateSmsLength(message) {
  const text = String(message || "");
  if (text.length <= TEMPLATE_SMS_MAX_LENGTH) {
    return { ok: true, length: text.length };
  }
  return {
    ok: false,
    error: "message_too_long",
    length: text.length,
    message: `ההודעה ארוכה מדי (${text.length} תווים). מקסימום ${TEMPLATE_SMS_MAX_LENGTH} תווים.`,
  };
}

export function areTemplateFieldsFilled(template, fieldValues) {
  if (!template?.fields?.length) return true;
  return template.fields
    .filter((f) => f.required)
    .every((f) => String(fieldValues[f.key] || "").trim().length > 0);
}
