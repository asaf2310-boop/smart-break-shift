/** מדריך תשלומים (Wealthy Guide) — נתונים סטטיים מייצוא Base44 */

export const WEALTHY_GUIDE_BASE = "/knowledge/wealthy-guide";

export const MANUAL_CHARGE_SCREENSHOT_URL =
  "https://media.base44.com/images/public/user_68f8bdce12cc454da9888320/74f0ee929_image.png";

export const MANUAL_CHARGE_TRAINING_VIDEO_URL = "/training/wealthy-guide/manual-charge.mp4";

/** נתיב מצגת אופציונלי — env או ברירת מחדל למדריך */
export const MANUAL_CHARGE_PRESENTATION_PATH =
  import.meta.env.VITE_WEALTHY_GUIDE_MANUAL_CHARGE_PRESENTATION_PATH || null;

export const MANUAL_CHARGE_INTRO =
  "חיוב ידני מאפשר לחייב לקוח באמצעות הזנת פרטי כרטיס אשראי ישירות במערכת. שימוש נפוץ: כאשר הלקוח מוסר את פרטי האשראי בטלפון, או כשנדרש חיוב מיידי שאינו דרך לינק תשלום.";

export const wealthyGuideFeatures = [
  {
    title: "חיוב ידני",
    description: "חיוב לקוח באמצעות הקלדת פרטי אשראי",
    slug: "manual-charge",
    ready: true,
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    title: "לינק לתשלום",
    description: "שליחת קישור תשלום ללקוח",
    slug: "payment-link",
    ready: false,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "הוראת קבע",
    description: "הגדרת חיובים חוזרים אוטומטיים",
    slug: "standing-order",
    ready: false,
    color: "bg-emerald-100 text-emerald-600",
  },
  {
    title: "פירוט עסקאות",
    description: "צפייה בכל העסקאות שבוצעו",
    slug: "transactions",
    ready: false,
    color: "bg-orange-100 text-orange-600",
  },
  {
    title: "חשבוניות דיגיטליות",
    description: "ניהול וחיבור מערכת חשבוניות",
    slug: "invoice-connect",
    ready: false,
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "דוחות",
    description: "דוחות לקוחות ומקדמות",
    slug: "customer-list",
    ready: false,
    color: "bg-pink-100 text-pink-600",
  },
  {
    title: "הגדרות",
    description: "הגדרות מתקדמות וחיבורים",
    slug: "payment-page-api",
    ready: false,
    color: "bg-gray-100 text-gray-600",
  },
  {
    title: "ניהול התראות",
    description: "הגדרת התראות ורכישת SMS",
    slug: "alerts",
    ready: false,
    color: "bg-amber-100 text-amber-600",
  },
];

export const wealthyGuideMenuItems = [
  { label: "ראשי", slug: "", isRoot: true },
  {
    label: "ביצוע פעולות",
    children: [
      { label: "חיוב ידני", slug: "manual-charge", ready: true },
      { label: "לינק לתשלום", slug: "payment-link", ready: false },
      { label: "הוראת קבע", slug: "standing-order", ready: false },
    ],
  },
  { label: "פירוט עסקאות", slug: "transactions", ready: false },
  {
    label: "חשבוניות דיגיטליות",
    children: [{ label: "התחברות למערכת החשבוניות", slug: "invoice-connect", ready: false }],
  },
  {
    label: "דוחות",
    children: [
      { label: "רשימת לקוחות", slug: "customer-list", ready: false },
      { label: "פירוט המקדמות", slug: "advances", ready: false },
    ],
  },
  {
    label: "הגדרות",
    children: [
      { label: "דף תשלום ו-API", slug: "payment-page-api", ready: false },
      { label: "מניעת עסקאות כפולות", slug: "duplicate-prevention", ready: false },
      { label: "עסקה בגובה 3DS", slug: "3ds", ready: false },
      { label: "Bit", slug: "bit", ready: false },
      { label: "Apple Pay", slug: "apple-pay", ready: false },
      { label: "Google Pay", slug: "google-pay", ready: false },
      { label: "PayPal", slug: "paypal", ready: false },
      { label: "Shopify", slug: "shopify", ready: false },
    ],
  },
  {
    label: "ניהול התראות",
    children: [
      { label: "מערכת התראות", slug: "alerts", ready: false },
      { label: "רכישת חבילת SMS", slug: "sms-package", ready: false },
    ],
  },
];

export const manualChargeFields = [
  {
    name: "סכום לחיוב",
    description: "הזנת הסכום שיש לחייב את הלקוח. ניתן לבחור את סוג המטבע (ש\"ח, דולר וכו').",
    tip: "יש לוודא שהסכום תואם למה שסוכם עם הלקוח לפני ביצוע העסקה.",
    required: true,
  },
  {
    name: "תיאור עסקה / בחירת פריט",
    description: "שדה חופשי לתיאור העסקה או בחירת פריט מרשימת הפריטים המוגדרים במערכת.",
    tip: "תיאור ברור יעזור לזהות את העסקה בדוחות ובמעקב.",
    required: false,
  },
  {
    name: "איך מתאים ללקוח לשלם?",
    description: "בחירת אופן התשלום — אשראי בהקלדה ידנית, לינק לתשלום, או אמצעי תשלום נוסף.",
    tip: "אשראי בהקלדה ידנית מתאים כשהלקוח מוסר את פרטי הכרטיס בטלפון.",
    required: true,
  },
  {
    name: "סוג העסקה",
    description: "בחירה בין עסקה רגילה לבין תשלומים. בעסקת תשלומים ניתן לפרוס את הסכום למספר תשלומים.",
    required: true,
  },
  {
    name: "מספר כרטיס",
    description: "הזנת מספר כרטיס האשראי של הלקוח (16 ספרות בדרך כלל).",
    tip: "יש להקליד את המספר בזהירות ולוודא שאין טעויות.",
    required: true,
  },
  {
    name: "תוקף",
    description: "חודש ושנת תפוגה של כרטיס האשראי.",
    required: true,
  },
  {
    name: "CVV",
    description: "3 הספרות בגב כרטיס האשראי (קוד אבטחה).",
    tip: "ב-American Express מדובר ב-4 ספרות בחזית הכרטיס.",
    required: true,
  },
  {
    name: "תעודת זהות",
    description: "מספר תעודת הזהות של בעל הכרטיס.",
    tip: "שדה זה נדרש לצורך אימות העסקה מול חברת האשראי.",
    required: true,
  },
  {
    name: "שם פרטי ושם משפחה",
    description: "שם בעל כרטיס האשראי כפי שמופיע בכרטיס.",
    required: false,
  },
  {
    name: 'דוא"ל',
    description: "כתובת המייל של הלקוח. משמשת לשליחת אישור תשלום ללקוח.",
    tip: 'אם מופעלת האפשרות "שלח ללקוח אישור תשלום", האישור יישלח לכתובת זו.',
    required: false,
  },
  {
    name: "שלח ללקוח אישור תשלום",
    description: "מתג להפעלה/כיבוי — כאשר מופעל, נשלח ללקוח מייל עם אישור על ביצוע התשלום.",
    required: false,
  },
  {
    name: "שמור פרטי אשראי",
    description: "מתג לשמירת פרטי האשראי של הלקוח לשימוש עתידי (טוקן).",
    tip: "שמירת הפרטים מאפשרת חיוב חוזר מבלי להזין שוב את פרטי הכרטיס.",
    required: false,
  },
  {
    name: "הגדלת אישור ידני",
    description: "אפשרות להגדלת סכום האישור (אם קיבלת כזה מחברת האשראי).",
    tip: "רלוונטי למקרים שבהם חברת האשראי הגבילה את סכום העסקה.",
    required: false,
  },
  {
    name: "פרטים נוספים",
    description: "אפשרות להוספת שדות מידע נוספים לעסקה — לדוגמה, מספר הזמנה, הערות פנימיות ועוד.",
    required: false,
  },
  {
    name: "ביצוע עסקה",
    description: "לחצן סופי לביצוע החיוב. לאחר לחיצה, העסקה נשלחת לאישור מול חברת האשראי.",
    tip: "לפני לחיצה — חובה לוודא שכל הפרטים נכונים! לא ניתן לבטל עסקה בקלות.",
    required: true,
  },
];

export function wealthyGuidePath(slug) {
  if (!slug) return WEALTHY_GUIDE_BASE;
  return `${WEALTHY_GUIDE_BASE}/${slug}`;
}

function getPublicAppOrigin() {
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_URL
      ? String(import.meta.env.VITE_APP_URL).trim().replace(/\/$/, "")
      : "";
  if (typeof window === "undefined") return fromEnv;
  const origin = window.location.origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin);
  if (isLocal && fromEnv) return fromEnv;
  return fromEnv || origin;
}

export function getManualChargeGuideUrl() {
  return `${getPublicAppOrigin()}${wealthyGuidePath("manual-charge")}`;
}

export function getManualChargePresentationUrl() {
  const custom = MANUAL_CHARGE_PRESENTATION_PATH
    ? String(MANUAL_CHARGE_PRESENTATION_PATH).trim()
    : "";
  if (custom) {
    if (/^https?:\/\//i.test(custom)) return custom;
    const path = custom.startsWith("/") ? custom : `/${custom}`;
    return `${getPublicAppOrigin()}${path}`;
  }
  return getManualChargeGuideUrl();
}
