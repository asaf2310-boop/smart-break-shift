/** נרמול מספר ישראלי לשליחת SMS (05XXXXXXXX) */
export function normalizeAgentPhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    digits = `0${digits}`;
  }
  if (!/^0\d{8,9}$/.test(digits)) return "";
  return digits;
}

export function formatAgentPhoneDisplay(phone) {
  const normalized = normalizeAgentPhone(phone);
  return normalized || "";
}
