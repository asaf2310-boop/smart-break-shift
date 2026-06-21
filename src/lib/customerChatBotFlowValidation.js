import { FLOW_VALIDATION_TYPES } from "@/lib/customerChatBotFlowConfig";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\-+()]{9,15}$/;

/**
 * @param {string} value
 * @param {{ validationType?: string, validationValue?: string }} step
 * @returns {boolean}
 */
export function validateFlowInput(value, step) {
  const text = String(value || "").trim();
  const type = step?.validationType || "none";

  if (type === "none") return Boolean(text);

  if (!text) return false;

  if (type === "email") return EMAIL_RE.test(text);
  if (type === "phone") {
    const digits = text.replace(/\D/g, "");
    return PHONE_RE.test(text) && digits.length >= 9 && digits.length <= 15;
  }
  if (type === "number") {
    const expected = String(step.validationValue || "").trim();
    if (!expected) return false;
    const num = Number(text.replace(/,/g, ""));
    const expectedNum = Number(expected.replace(/,/g, ""));
    return Number.isFinite(num) && Number.isFinite(expectedNum) && num === expectedNum;
  }
  if (type === "exactText") {
    const expected = String(step.validationValue || "").trim();
    if (!expected) return false;
    return text === expected;
  }
  if (type === "containsText") {
    const needle = String(step.validationValue || "").trim();
    if (!needle) return false;
    return text.includes(needle);
  }

  return Boolean(text);
}

export function validationTypeNeedsValue(type) {
  return Boolean(FLOW_VALIDATION_TYPES[type]?.needsValue);
}

export function inputPlaceholderForStep(step) {
  if (!step) return "כתבו הודעה…";
  const type = step.validationType || "none";
  if (type === "email") return "הזינו כתובת אימייל…";
  if (type === "phone") return "הזינו מספר טלפון…";
  if (type === "number") return "הזינו מספר…";
  if (step.inputMode === "freeText") return "כתבו תשובה חופשית…";
  return "הקלידו תשובה…";
}
