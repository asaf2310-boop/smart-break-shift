---
name: call-center-hebrew
description: >-
  Hebrew RTL UI, agent names, break slot capacity, shift week publish, and
  internal chat bubble layout for smart-break-shift. Use when editing scheduling,
  breaks, shifts, chat, CRM labels, or Hebrew copy in this call-center app.
---

# מוקד — עברית, RTL, ודומיין

## RTL

- עוטפי דף: `dir="rtl"` על `min-h-screen` / דיאלוגים
- טקסט עברי: RTL; **טלפון, אימייל, URL, timestamps בבועות** — לעיתים `dir="ltr"` על שדה/אזור
- צ'אט: מעטפת `dir="rtl"`; רשימת נוכחות לעיתים `dir="ltr"` ליישור שמות
- Tailwind: `text-right`, `justify-start` = "שלי" בצ'אט (ראו למטה)

קבצי עוגן: `AppNav.jsx`, `BreakScheduler.jsx`, `ShiftScheduler.jsx`, `InternalChatPanel.jsx`, `CrmDashboard.jsx`.

## שמות נציגים

`src/constants/scheduling.js`:

- **לייב:** `REAL_AGENT_NAMES` (שמות אמיתיים בעברית)
- **דמו:** `DEMO_AGENT_NAMES` (`נציג 01`…`10`) או רשימה מ-`listDemoAppUsers()` אם הוגדרו במנהל

`getAgentNamesList()` / `getStoredAgentName()` — session + `localStorage` `agent_name`; שם לא ברשימה נמחק.

נרמול: `normalizeAgentName()` ב-`src/lib/breakCapacity.js` (רווחים כפולים).

## קיבולת הפסקות

`src/lib/breakCapacity.js` + `BreakSettings`:

- `lunch_max_per_slot`, `short_max_per_slot` (ברירת מחדל 1)
- `validateBreakRegistration` — קודים: `ALREADY_REGISTERED`, `SLOT_FULL`, `MAX_BREAKS`
- יצירה: `createBreakRegistration` (דמו: גם ב-`demoClient`)

ממשק: `BreakScheduler.jsx`, `BreakSection.jsx`, `AgentNameDialog.jsx`.

## משמרות — פרסום שבוע

- שבוע עבודה: ראשון–חמישי (`date-fns`, `getWeekStart`)
- **פרסום:** `PublishedScheduleEditor` — עורך מנהל; שומר `ShiftRegistration` לטווח תאריכים; SMS אופציונלי (`sendScheduleSmsNotifications`)
- נציג רואה בשיבוץ את **שבוע הבא** שפורסם (`preview-live.ps1` מזכיר: משמרות → שיבוץ)
- אילוצים: `ConstraintConfirmation` עם `week_start`
- `AdminShifts.jsx` — שני עורכים (שבוע נוכחי / הבא)

## צ'אט פנימי — בועות

`InternalChatPanel.jsx`:

- הודעה **שלי** (`sender_name === agentName`): `justify-start`, רקע `bg-indigo-500 text-white`
- הודעה **אחר**: `justify-end`, רקע לבן + מסגרת
- כותרת: `שם · שעה` (`formatTime`)
- Enter לשליחה; Shift+Enter שורה חדשה
- חדר כללי / DM (`dmPeer`); בדמו: "דמו פעיל" / "צ'אט מקומי (טסט)"
- Supabase: `ChatSettings` / branding רק כשלא דמו (`useChatBranding.js`)

## CRM (דמו)

עברית בטפסים/טוסטים; שדות LTR לטלפון ואימייל. נתוני seed בעברית ב-`crmStore.js`.

## עקרונות עריכה

- שמור ניסוח UI קיים; הוסף מחרוזות בעברית תקנית
- אל תהפוך LTR על שדות מספריים/טלפון
- שינוי לוגיקת קיבולת/פרסום — בדוק גם דמו (`demoClient` seed) וגם Supabase (טריגרים ב-`RUN_IN_SUPABASE.sql`)
