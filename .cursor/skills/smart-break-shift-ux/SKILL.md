---
name: smart-break-shift-ux
description: >-
  Hebrew RTL Material Design 3 UX for smart-break-shift call-center modules
  (breaks, shifts, CRM, chat, telephony, knowledge AI, remote support, admin).
  Use when adding or restyling UI, navigation, toasts, forms, or Hebrew copy
  across this app. Defers RTL/CSS to hebrew-rtl-best-practices, typography to
  israeli-ui-design-system, a11y to israeli-accessibility-compliance, and
  domain rules to call-center-hebrew / smart-break-shift-demo.
---

# Smart Break Shift — UX מוקד (MD3 + RTL)

## מתי להשתמש

- עיצוב/שינוי מסכים, ניווט, כרטיסים, דיאלוגים, טוסטים, מצבי ריק/טעינה
- עקביות M3 בין מודולים (לא רק CSS נקודתי)
- העתק עברית חדשה לממשק נציג/מנהל

**לא** להחליף: לוגיקת קיבולת הפסקות, פרסום משמרות, Supabase/דמו — `call-center-hebrew`, `smart-break-shift-demo`.

## עקרונות כלליים

| נושא | כלל בפרויקט |
|------|-------------|
| כיוון | `dir="rtl"` על דף/דיאלוג; `lang="he"` ב-`index.html` |
| LTR מבודד | טלפון, אימייל, URL, מזהה RustDesk, timestamps בבועות — `dir="ltr"` או `<bdi>` |
| שבוע עבודה | ראשון–חמישי; תאריכים `dd/MM` או `dd/MM/yyyy` (`date-fns`, `he-IL`) |
| רישום | UX נציג: קצר, פעולה (`יש לבחור…`, `רגע קטן`); מנהל: ברור ומפורט יותר |
| דמו | תג/באנר "דמו פעיל" כש-`demoModeEnabled`; אל תסתיר מצב backend |

## Design tokens (M3)

מחלקות ב-`src/index.css` — **העדף אותן** על עיצוב ad-hoc:

| מחלקה | שימוש |
|--------|--------|
| `m3-page` | רקע דף + gradient |
| `m3-card` | כרטיס תוכן (CRM, ידע, תמיכה) |
| `m3-surface-container` | אזור משני |
| `m3-btn-tonal` / `m3-btn-outlined` | פעולות ראשיות/משניות |
| `m3-label-large` / `m3-label-medium` | כותרות משנה, הסברים |
| `m3-headline-small` | כותרת מסך |
| `m3-nav-bar` + `m3-nav-tab-active/inactive` | `AppNav.jsx` |
| `m3-badge` | סטטוס, תגיות |
| `pt-app-nav` | ריווח מתחת לניווט קבוע |

צבעים: משתני Tailwind `--primary`, `--surface-container-*`, `--outline` (לא hardcode slate/indigo במסכים חדשים אלא אם מודול קיים כבר כך — אז התאם לשכנים).

## מודולים — דפוס UX

### הפסקות / משמרות (`/breaks`, `/shifts`, `/admin/shifts`)

- כותרת + שם נציג בולט; כפתור "החלף נציג"
- הפסקות: משבצות, מגבלות מלאות — הודעת שגיאה בעברית מקוד `validateBreakRegistration`
- משמרות: אילוצים לשבוע נוכחי; שיבוץ לשבוע **הבא** שפורסם; מנהל — שני עורכי שבוע ב-`AdminShifts.jsx`

### CRM (`/crm`, `/crm/:id`)

- טפסים RTL; שדות טלפון/אימייל LTR
- רפרלים, הערות — טקסט עברי; מספרים מבודדים

### צ'אט + נוכחות (`InternalChatPanel`, `FloatingChatWidget`)

- בועות: **שלי** `justify-start` + `bg-indigo-500`; **אחר** `justify-end` + מסגרת
- רשימת נוכחות: לעיתים `dir="ltr"` לשמות
- `html[data-top-nav]` / `--app-bottom-chrome` — לא לחפוף softphone/צ'אט

### טלפוניה (`SoftphoneWidget`, `TelephonyContext`)

- דמו: `telephonyDemoAvailable` / סימולציית שיחה
- FAB/דוק: `html[data-softphone-docked-open]` מרים את הצ'אט (`floating-chat-chrome`)
- סטטוס נציג (זמין/בשיחה/הפסקה) — תוויות עברית קצרות

### בסיס ידע (`/knowledge`, `/admin/knowledge`)

- מסך נציג: `m3-page` + `KnowledgeChat` בכרטיס אחד
- מנהל: העלאת מסמכים, לא לשבור זרימת שאל-תשובה

### השתלטות מרחוק (`/remote-support`, screen share)

- שני מצבים: צפייה בדפדפן (WebRTC) vs RustDesk — הסבר בעברית בכרטיס
- אישור לקוח (`RemoteSupportConsentPage`); מייל RustDesk RTL ב-`remoteSupportStore.js`
- קישורי `mailto:` / HTML מייל — `dir="rtl"` בשורש

### מנהל (`AdminGate`, PIN)

- `VITE_ADMIN_PIN` — שער לפני `/admin/*`
- טפסים בעברית; פעולות הרסניות עם אישור

## ניווט

`AppNav.jsx`: ראשי, הפסקות, משמרות, CRM, השתלטות מרחוק, בסיס ידע, מנהל (אם מורשה).

`Home.jsx`: כרטיסי כניסה עם אייקון + `m3-card` / gradient tiles — שמור מבנה אחיד.

## נגישות (IS 5568)

- כפתורים עם `aria-label` בעברית כשאין טקסט גלוי
- ניגודיות על `m3-nav-tab-inactive` וטקסט על `primary-container`
- מקלדת: פוקוס נראה על טאבים ושדות CRM
- פירוט: `israeli-accessibility-compliance`

## בדיקה מהירה אחרי שינוי UI

1. מסך ב-RTL ללא גלילה אופקית מיותרת
2. שדה טלפון לא מתהפך
3. דמו: באנר דמו + נתונים ב-localStorage
4. מובייל: `pt-app-nav`, safe-area, FAB לא חופף softphone

## קבצי עוגן

| מודול | קבצים |
|--------|--------|
| עיצוב גלובלי | `src/index.css`, `tailwind.config.js` |
| ניווט | `src/components/layout/AppNav.jsx` |
| הפסקות | `src/pages/BreakScheduler.jsx`, `src/components/breaks/*` |
| משמרות | `src/pages/ShiftScheduler.jsx`, `src/pages/AdminShifts.jsx` |
| CRM | `src/pages/CrmDashboard.jsx`, `src/pages/CrmCustomerDetail.jsx` |
| צ'אט | `src/components/chat/InternalChatPanel.jsx` |
| טלפוניה | `src/components/telephony/*`, `src/lib/telephonyStore.js` |
| ידע | `src/pages/KnowledgePage.jsx`, `src/components/knowledge/*` |
| תמיכה | `src/pages/RemoteSupportPage.jsx`, `src/lib/remoteSupportStore.js` |
