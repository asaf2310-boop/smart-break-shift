# Cursor Agent Skills — smart-break-shift

סקילס לפרויקט מוקד (הפסקות, משמרות, CRM, צ'אט, טלפוניה, ידע, תמיכה מרחוק). מתקינים ידנית מ-[Skills IL](https://agentskills.co.il) (GitHub `skills-il/*`) או מ-skills.sh (Vercel).

עדכון: `npx skills-il add … -a cursor` (דורש Git ב-PATH) או הורדת `SKILL.md` מ-GitHub.

## מתי הסוכן צריך איזה סקיל

| סקיל | השתמש כש… |
|------|-----------|
| **smart-break-shift-ux** | עיצוב/שינוי UI חוצה-מודולים, M3, ניווט, טוסטים, עברית בממשק |
| **call-center-hebrew** | לוגיקת מוקד: קיבולת הפסקות, פרסום משמרות, בועות צ'אט, שמות נציגים |
| **smart-break-shift-demo** | `VITE_DEMO_MODE`, `preview-shell`/`preview-live`, Supabase SQL, Vercel |
| **hebrew-rtl-best-practices** | RTL, bidi, logical properties, אייקונים ממוררים |
| **hebrew-i18n** | תאריכים `he-IL`, רבים בעברית, פורמט מספרים/שקל |
| **israeli-ui-design-system** | טיפוגרפיה עברית, טוקנים, טפסים RTL, דפוסי ממשק |
| **israeli-accessibility-compliance** | IS 5568, נגישות RTL, קורא מסך |
| **hebrew-content-writer** | ניסוח עברי חדש (UX, מיילים, שיווק) — לא תרגום מכונה |
| **deploy-to-vercel** | פריסה מהירה (`deploy.sh`) |
| **vercel-react-best-practices** | ביצועים React (רינדור, fetch, memo) |
| **web-design-guidelines** | ביקורת UI/UX כללית (לא ספציפית למוקד) |
| **supabase** / **supabase-postgres-best-practices** | סכימה, RLS, שאילתות Postgres |
| **shadcn** / **frontend-design** | רכיבי shadcn או עיצוב כללי |
| **webapp-testing** | Playwright / בדיקות E2E |

## מקורות

- **Skills IL** (מוקד עברית/RTL): `skills-il/localization` — גרסאות ב-`skills-lock.json`
- **skills.sh**: `vercel-labs/agent-skills` — React, Vercel, web guidelines
- **פרויקט**: `call-center-hebrew`, `smart-break-shift-demo`, `smart-break-shift-ux`

## מגבלה

שמור על **3–8 סקילס ממוקדים** לעבודת UX/מוקד בבת אחת; אל תטען סקילס מס לא קשורים (מס, ממשלה, וכו').
