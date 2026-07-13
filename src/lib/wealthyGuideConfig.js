/** מדריך תשלומים (Wealthy Guide) — נתונים סטטיים מייצוא Base44 */

export const WEALTHY_GUIDE_BASE = "/knowledge/wealthy-guide";

export const MANUAL_CHARGE_SCREENSHOT_URL =
  "https://media.base44.com/images/public/user_68f8bdce12cc454da9888320/74f0ee929_image.png";

export const MANUAL_CHARGE_TRAINING_VIDEO_URL = "/training/wealthy-guide/manual-charge.mp4";

/** Public guest routes for SMS links (no agent auth / knowledge module). */
export const PUBLIC_MANUAL_CHARGE_VIDEO_PATH = "/guide/manual-charge/video";
export const PUBLIC_MANUAL_CHARGE_PDF_PATH = "/guide/manual-charge/pdf";

/** נתיב מצגת אופציונלי — env או ברירת מחדל למדריך */
export const MANUAL_CHARGE_PRESENTATION_PATH =
  import.meta.env.VITE_WEALTHY_GUIDE_MANUAL_CHARGE_PRESENTATION_PATH || null;

export const MANUAL_CHARGE_INTRO =
  "חיוב ידני מאפשר לחייב לקוח באמצעות הזנת פרטי כרטיס אשראי ישירות במערכת. שימוש נפוץ: כאשר הלקוח מוסר את פרטי האשראי בטלפון, או כשנדרש חיוב מיידי שאינו דרך לינק תשלום.";

export const PAYMENT_LINK_SCREENSHOT_URL = "/training/wealthy-guide/payment-link-screenshot.png";

export const PAYMENT_LINK_TRAINING_VIDEO_URL = "/training/wealthy-guide/payment-link.mp4";

/** Public guest routes for SMS links (no agent auth / knowledge module). */
export const PUBLIC_PAYMENT_LINK_VIDEO_PATH = "/guide/payment-link/video";
export const PUBLIC_PAYMENT_LINK_PDF_PATH = "/guide/payment-link/pdf";

export const PAYMENT_LINK_INTRO =
  "לינק לתשלום מאפשר ליצור בקשת תשלום ולשלוח ללקוח קישור מאובטח להשלמת העסקה. שימוש נפוץ: כאשר הלקוח אינו נמצא במערכת, או כשמעדיפים שהלקוח יזין את פרטי האשראי בעצמו בדף תשלום מאובטח.";

export const TRANSACTION_DETAILS_SCREENSHOT_URL =
  "/training/wealthy-guide/transaction-details-screenshot.png";

export const TRANSACTION_DETAILS_TRAINING_VIDEO_URL =
  "/training/wealthy-guide/transaction-details.mp4";

/** Public guest routes for SMS links (no agent auth / knowledge module). */
export const PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH = "/guide/transaction-details/video";
export const PUBLIC_TRANSACTION_DETAILS_PDF_PATH = "/guide/transaction-details/pdf";

export const TRANSACTION_DETAILS_INTRO =
  "פירוט עסקאות מאפשר לצפות בכל העסקאות שבוצעו במערכת, לסנן לפי טווח תאריכים, לייצא דוח לאקסל ולבטל עסקאות אשראי במידת הצורך. שימוש נפוץ: מעקב אחר תשלומים, איתור עסקה ספציפית ובדיקת סטטוס עסקה מול הלקוח.";

export const THREE_DS_SETTINGS_SCREENSHOT_URL =
  "/training/wealthy-guide/3ds-settings-screenshot.png";

/** Public guest route for SMS links (no agent auth / knowledge module). */
export const PUBLIC_THREE_DS_SETTINGS_PDF_PATH = "/guide/3ds-settings/pdf";

export const THREE_DS_SETTINGS_INTRO =
  "שירות 3D Secure (עסקה בטוחה) מאפשר אימות מאובטח של בעל הכרטיס בעסקאות אשראי. המדריך מלווה את הנציג בשלבי ההגדרה בממשק המסוף — מפרטי העסקה ועד בדיקת החיבור עם כרטיסי טסט.";

export const threeDsSettingsWorkflowSteps = [
  {
    title: "כניסה למערכת",
    description: "היכנסו לממשק הניהול עם פרטי הגישה ממייל פתיחת המסוף, ונווטו להגדרות → עסקה בטוחה.",
  },
  {
    title: "פרטי עסקה בטוחה",
    description: "הגדירו שם בית עסק באנגלית, דומיין, קוד מדינה 376 וגודל חלון אימות (מסך מלא).",
  },
  {
    title: "הגדרת מותגי אשראי",
    description: "לכל מותג שהלקוח סולק — בחרו סולק, הזינו MID ו-MCC, והפעילו ישראלי + תייר.",
  },
  {
    title: "הגדרות מתקדמות",
    description: "סמנו את תיבות הסימון (Fallback, חסימת ישראכרט מקומי, אילוץ OTP) לפי ההנחיות.",
  },
  {
    title: "שמירה ובדיקה",
    description: "שמרו את ההגדרות, בצעו עסקת טסט ואמתו בפרטי העסקה שמופיע Suspected fraud.",
  },
  {
    title: "סיום והפעלה",
    description: "עדכנו סכום מינימלי לעסקה בטוחה (אם נדרש) — השירות פעיל.",
  },
];

export const paymentLinkWorkflowSteps = [
  {
    title: "צרו בקשה לתשלום",
    description: "מלאו את סכום התשלום, תיאור העסקה ופרטי הלקוח בטופס.",
  },
  {
    title: "שלחו אותה ללקוח",
    description: "שלחו את הבקשה במייל, ב-SMS, או שניהם. אם לא מוזנים פרטי שליחה — נוצר קישור להעתקה ידנית.",
  },
  {
    title: "קבלו אישור על התשלום",
    description: "הלקוח משלים את התשלום בדף המאובטח, והסטטוס מתעדכן בטבלת הבקשות שנשלחו.",
  },
];

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
    ready: true,
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
    slug: "transaction-details",
    ready: true,
    color: "bg-orange-100 text-orange-600",
  },
  {
    title: "עסקה בטוחה 3DS",
    description: "הגדרת שירות 3D Secure (עסקה בטוחה)",
    slug: "3ds-settings",
    ready: true,
    color: "bg-sky-100 text-sky-600",
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
      { label: "לינק לתשלום", slug: "payment-link", ready: true },
      { label: "הוראת קבע", slug: "standing-order", ready: false },
    ],
  },
  { label: "פירוט עסקאות", slug: "transaction-details", ready: true },
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
      { label: "עסקה בטוחה 3DS", slug: "3ds-settings", ready: true },
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
    name: "CVV (לא חובה)",
    description: "3 הספרות בגב כרטיס האשראי (קוד אבטחה). שדה אופציונלי — ניתן לבצע חיוב גם ללא הזנת CVV.",
    tip: "ב-American Express מדובר ב-4 ספרות בחזית הכרטיס.",
    required: false,
  },
  {
    name: "ת.ז. (לא חובה)",
    description: "מספר תעודת הזהות של בעל הכרטיס. שדה אופציונלי — ניתן לבצע חיוב גם ללא הזנת ת.ז.",
    required: false,
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

export const paymentLinkFields = [
  {
    name: "סכום לתשלום",
    description: "הזנת הסכום שהלקוח צריך לשלם. ניתן לבחור את סוג המטבע (ש\"ח, דולר וכו').",
    tip: "יש לוודא שהסכום תואם למה שסוכם עם הלקוח לפני שליחת הבקשה.",
    required: true,
  },
  {
    name: "תיאור עסקה / בחירת פריט",
    description: "שדה חופשי לתיאור העסקה או בחירת פריט מרשימת הפריטים המוגדרים במערכת.",
    tip: "תיאור ברור יעזור ללקוח לזהות את הבקשה ולמצוא אותה בדוחות.",
    required: false,
  },
  {
    name: "הגדרות מתקדמות",
    description: "אזור מתקפל עם אפשרויות נוספות לבקשת התשלום — לדוגמה הגדרות תשלומים, שפה, מטבע ועוד.",
    required: false,
  },
  {
    name: "ת.ז. (לא חובה)",
    description: "מספר תעודת הזהות של הלקוח. שדה אופציונלי לזיהוי הלקוח במערכת.",
    required: false,
  },
  {
    name: "שם פרטי",
    description: "שם פרטי של הלקוח שאליו מיועדת בקשת התשלום.",
    required: true,
  },
  {
    name: "שם משפחה",
    description: "שם משפחה של הלקוח שאליו מיועדת בקשת התשלום.",
    required: true,
  },
  {
    name: "כתובת מייל",
    description: "כתובת המייל של הלקוח. אם מוזנת — הבקשה תישלח ללקוח בדוא\"ל עם קישור לתשלום.",
    tip: "ניתן לשלוח גם במייל וגם ב-SMS — אם מוזנים שני הערוצים, הבקשה תישלח בשניהם.",
    required: false,
  },
  {
    name: "מספר טלפון נייד",
    description: "מספר הטלפון הנייד של הלקוח. אם מוזן — הבקשה תישלח ב-SMS עם קישור לתשלום.",
    tip: "אם שני השדות (מייל וטלפון) ריקים — המערכת תיצור קישור בלבד, לשיתוף ידני עם הלקוח.",
    required: false,
  },
  {
    name: "שלח בקשה",
    description: "לחצן ליצירת בקשת התשלום ושליחתה ללקוח (או ליצירת קישור להעתקה). לאחר לחיצה, הבקשה תופיע בטבלת הבקשות שנשלחו.",
    tip: "לפני שליחה — וודאו שהסכום ופרטי הלקוח נכונים.",
    required: true,
  },
];

export const transactionDetailsFilterFields = [
  {
    name: "מתאריך",
    description: "תאריך התחלה לסינון העסקאות. יוצגו רק עסקאות מתאריך זה ואילך.",
    tip: "ניתן לבחור טווח תאריכים קצר (למשל יום אחד) או רחב (חודש שלם) לפי הצורך.",
    required: false,
  },
  {
    name: "עד תאריך",
    description: "תאריך סיום לסינון העסקאות. יוצגו עסקאות עד תאריך זה כולל.",
    required: false,
  },
  {
    name: "הצגה",
    description: "לחצן להצגת רשימת העסקאות לפי טווח התאריכים שנבחר. לאחר לחיצה, הטבלה מתעדכנת בהתאם.",
    required: true,
  },
  {
    name: "ייצוא לאקסל",
    description: "ייצוא רשימת העסקאות המוצגת לקובץ Excel להורדה. שימושי לדוחות, הנהלת חשבונות ומעקב.",
    tip: "מומלץ לסנן קודם לטווח התאריכים הרצוי ואז לייצא — כך הקובץ יכלול רק את העסקאות הרלוונטיות.",
    required: false,
  },
  {
    name: "ביטול עסקאות אשראי",
    description: "אפשרות לביטול עסקאות אשראי שבוצעו. רלוונטי לעסקאות מאושרות שנדרש לבטל.",
    tip: "ביטול עסקה אפשרי רק בתנאים מסוימים ובמסגרת זמן מוגבלת — לפי מדיניות חברת האשראי.",
    required: false,
  },
];

export const transactionDetailsTableFields = [
  {
    name: "מס. עסקה",
    description: "מספר מזהה ייחודי של העסקה במערכת. משמש לאיתור ומעקב.",
    required: false,
  },
  {
    name: "סטטוס",
    description: "מצב העסקה — למשל: אושרה (עסקה שעברה בהצלחה) או נכשלה (עסקה שנדחתה, מסומנת ב-X אדום).",
    tip: "עסקה שנכשלה לא חויבה בפועל — ניתן לנסות שוב או לפנות לתמיכה.",
    required: false,
  },
  {
    name: "תאריך",
    description: "תאריך ביצוע העסקה.",
    required: false,
  },
  {
    name: "שעה",
    description: "שעת ביצוע העסקה.",
    required: false,
  },
  {
    name: "שם לקוח",
    description: "שם הלקוח שביצע את העסקה, כפי שהוזן בעת החיוב.",
    required: false,
  },
  {
    name: "פרטי העסקה",
    description: "תיאור או פרטים נוספים על העסקה — למשל תיאור המוצר/שירות או הערות.",
    required: false,
  },
  {
    name: "סכום",
    description: "סכום העסקה במטבע שבו בוצעה.",
    required: false,
  },
];

export const threeDsSettingsFields = [
  {
    name: "כניסה לממשק הניהול",
    description:
      "יש להיכנס לממשק הניהול של המסוף עם פרטי הגישה שנשלחו ללקוח במייל פתיחת המסוף (מספר מסוף, שם משתמש, סיסמה ראשונית וסיסמת זיכוי).",
    required: true,
  },
  {
    name: "ניווט להגדרות",
    description: 'לאחר הכניסה, יש ללחוץ בסרגל הימני על "הגדרות" ← "עסקה בטוחה".',
    required: true,
  },
  {
    name: "שם בית העסק (Merchant Name)",
    description:
      "יש להקליד את שם בית העסק באנגלית כפי שמופיע בחברת האשראי של הלקוח. ללא רווחים, עד 10 תווים.",
    tip: "שם בית העסק חייב להיות באנגלית, ללא רווחים, עד 10 תווים בלבד.",
    required: true,
  },
  {
    name: "כתובת אתר (דומיין בלבד)",
    description:
      "יש להזין את הדומיין של בית העסק בלבד. אם הלקוח עובד עם לינק לתשלום דרך פורטל / אפליקציית HYP — יש להזין hyp.co.il.",
    tip: "אם הלקוח עובד עם לינק לתשלום — יש להזין hyp.co.il ככתובת האתר.",
    required: true,
  },
  {
    name: "קוד מדינה",
    description: "יש להקליד את קוד מדינה ישראל: 376.",
    required: true,
  },
  {
    name: "גודל חלון אימות",
    description:
      "יש לבחור מסך מלא — זהו החלון שבו הלקוח הסופי מקליד את קוד ה-OTP.",
    required: true,
  },
];

export const threeDsSettingsBrandFields = [
  {
    name: "בחירת סולק",
    description: "לכל מותג — יש לבחור את חברת האשראי הסולקת: Max / Cal / Visa / Isracard.",
    required: true,
  },
  {
    name: "הזנת MID",
    description: 'מספר הספק מופיע במערכת ניהול יעד תחת "פרטי מסוף שב"א".',
    required: true,
  },
  {
    name: "MID עבור American Express בלבד",
    description:
      "מספר ייעודי בן 10 ספרות שמתחיל ב-972 — מגיע מחברת האשראי. רלוונטי רק למותג Amex.",
    tip: "עבור American Express בלבד — ה-MID הוא מספר ייעודי בן 10 ספרות שמתחיל ב-972.",
    required: false,
  },
  {
    name: "הזנת MCC",
    description:
      'קוד ה-MCC מופיע במערכת ניהול יעד תחת "הערות בכרטיס לקוח". במידה ולא מופיע — יש לשלוח לתפעול לבדיקה.',
    tip: "ה-MCC מייצג את תחום העיסוק — יש לוודא שהוא תואם למה שהלקוח קיבל מחברת האשראי.",
    required: true,
  },
  {
    name: "ישראלי + תייר",
    description:
      "יש להפעיל למצב פעיל לכל המותגים — גם אם הלקוח לא סולק כרטיס תייר, חובה להגדיר תייר!",
    required: true,
  },
];

export const threeDsSettingsAdvancedFields = [
  {
    name: "Fallback — ביצוע עסקאות ללא עסקה בטוחה",
    description:
      "מאפשר לעסקה לעבור ללא אימות במקרה של כשל טכני זמני. המלצה: לא לסמן — לשמור על רמת אבטחה גבוהה.",
    required: false,
  },
  {
    name: "חסימת עסקאות ישראכרט מקומי",
    description:
      'מותג ישראכרט מקומי אינו נתמך בשירות עסקה בטוחה. מסומן — הלקוח יקבל שגיאה "כרטיס לא נתמך". לא מסומן — העסקה תעבור, אך ללא עסקה בטוחה.',
    required: false,
  },
  {
    name: "אילוץ אימות OTP",
    description:
      "כופה הזנת סיסמה חד-פעמית בכל עסקה — ללא קשר להחלטת מנפיק הכרטיס. המלצה: לא לסמן — מאפשר אימות חלק וחוסך דף אימות נוסף.",
    required: false,
  },
];

export const threeDsSettingsTestFields = [
  {
    name: 'שמור הגדרות',
    description: 'יש לוודא שכל ההגדרות תקינות וללחוץ על "שמור הגדרות".',
    required: true,
  },
  {
    name: "בדיקה עם כרטיסי טסט",
    description:
      "יש להעביר עסקה בכרטיסי טסט (MasterCard: 5326 1053 0098 5614, Amex: 3755 1039 0552 649 — תוקף 02/99). העסקה לא תעבור — אך תיתן אינדיקציה האם השירות מחובר.",
    tip: "העסקה עם כרטיס טסט לא תעבור — זה תקין! מטרת הבדיקה היא לוודא שהשירות מחובר.",
    required: true,
  },
  {
    name: "אימות החיבור",
    description:
      'יש לגשת ל"ביצוע פעולות ← פירוט עסקאות", ללחוץ על מספר העסקה, ולחפש את המלל Suspected fraud — סימן שהשירות מחובר תקין.',
    tip: 'אם מופיע "Suspected fraud" בפרטי העסקה — השירות מחובר בהצלחה!',
    required: true,
  },
  {
    name: "עדכון סכום מינימלי",
    description:
      'יש לחזור למסך ההגדרות ולהגדיר מחדש את סכום העסקה המינימלי הנדרש. אם הלקוח מעוניין לצאת לאימות החל מ-0 ש"ח — אין צורך להגדיר כלום.',
    required: false,
  },
];

export const paymentLinkTableFields = [
  {
    name: "סינון: הכל / שולמו / לא שולמו",
    description: "לשוניות לסינון הבקשות לפי סטטוס תשלום — כל הבקשות, רק ששולמו, או רק שטרם שולמו.",
    required: false,
  },
  {
    name: "חיפוש בבקשות שנשלחו",
    description: "שדה חיפוש לאיתור בקשה ספציפית לפי שם, סכום, תיאור או פרטים אחרים.",
    required: false,
  },
  {
    name: "תאריך",
    description: "תאריך יצירת או שליחת בקשת התשלום.",
    required: false,
  },
  {
    name: "סטטוס",
    description: "מצב הבקשה — למשל: חדשה, נשלחה, שולמה או לא שולמה.",
    required: false,
  },
  {
    name: "נשלח לנייד/מייל",
    description: "הערוץ שבו נשלחה הבקשה ללקוח — מספר טלפון, כתובת מייל, או שניהם.",
    required: false,
  },
  {
    name: "סכום",
    description: "סכום התשלום שביקשתם מהלקוח.",
    required: false,
  },
  {
    name: "תיאור עסקה",
    description: "התיאור שהוזן בעת יצירת הבקשה.",
    required: false,
  },
  {
    name: "שם",
    description: "שם הלקוח שאליו נשלחה הבקשה.",
    required: false,
  },
  {
    name: "אסמכתה",
    description: "מספר אסמכתה או מזהה פנימי של הבקשה לצורך מעקב.",
    required: false,
  },
  {
    name: "מסמכים/קישור",
    description: "גישה לקישור התשלום, חשבונית או מסמכים נלווים לבקשה.",
    required: false,
  },
  {
    name: "מחיקה",
    description: "אפשרות למחיקת בקשת תשלום שטרם שולמה. בקשה שכבר שולמה לא ניתנת למחיקה.",
    tip: "מחיקה רלוונטית רק לבקשות שלא שולמו עדיין.",
    required: false,
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
  return `${getPublicAppOrigin()}${PUBLIC_MANUAL_CHARGE_PDF_PATH}`;
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
  return `${getPublicAppOrigin()}${PUBLIC_MANUAL_CHARGE_VIDEO_PATH}`;
}

export function getPaymentLinkGuideUrl() {
  return `${getPublicAppOrigin()}${PUBLIC_PAYMENT_LINK_PDF_PATH}`;
}

export function getPaymentLinkPresentationUrl() {
  return `${getPublicAppOrigin()}${PUBLIC_PAYMENT_LINK_VIDEO_PATH}`;
}

export function getTransactionDetailsGuideUrl() {
  return `${getPublicAppOrigin()}${PUBLIC_TRANSACTION_DETAILS_PDF_PATH}`;
}

export function getTransactionDetailsPresentationUrl() {
  return `${getPublicAppOrigin()}${PUBLIC_TRANSACTION_DETAILS_VIDEO_PATH}`;
}

export function getThreeDsSettingsGuideUrl() {
  return `${getPublicAppOrigin()}${PUBLIC_THREE_DS_SETTINGS_PDF_PATH}`;
}
