# אבטחת מידע — Phase 16 (סיכום)

מסמך מרכזי להגדרות אבטחה. פירוט לפי תחום: `SIP_SECURITY.md`, `PEERJS_SECURITY.md`, `DEMO_VS_PRODUCTION.md`.

## Supabase Auth — נציגים

| עקרון | פרט |
|--------|-----|
| כניסה | `supabase.auth.signInWithPassword` בקליינט — **לא** סיסמאות בטבלת `agents` |
| API רגיש | `POST /api/agent-auth` עם `Authorization: Bearer <access_token>` |
| מנהל | `agents.is_admin === true` ב-DB; אופציונלי `ADMIN_PIN` בשרת בלבד |
| RLS | נציגים רואים רק שורות משויכות; anon ללא גישה לטבלאות רגישות |
| מיגרציה | `security_phase0a` → `security_phase1_auth.sql` → … → `security_phase16.sql` |

### ADMIN_PIN (אופציונלי, שרת בלבד)

- משתנה: `ADMIN_PIN` ב-Vercel — **ללא** `VITE_`
- כשמוגדר: פעולות מנהל ב-API דורשות `adminPin` בגוף הבקשה **בנוסף** ל-JWT + `is_admin`
- **אל תגדירו PIN חלש** (1234, 0000). אם לא נדרש שכבה שנייה — השאירו ריק.
- הלקוח **לא** שולח PIN מ-build (`VITE_ADMIN_PIN` הוסר)

## API — שכבות הגנה

1. `isSameOrigin` — הגנת CSRF/CORS (defense-in-depth)
2. `verifyBearerAgent` / `verifyKnowledgeAccess` / `verifyAdminAgent` — לפי רגישות
3. Rate limits — SMS, מייל, העלאות, SIP

**בסיס ידע:** `GET /api/knowledge-upload` — מודול knowledge או מנהל; `POST`/`DELETE` (ingest/delete) — **מנהל בלבד**.

### נקודות קצה ציבוריות (ללא JWT)

| Endpoint | סיבה |
|----------|------|
| `GET /api/email-status`, `GET /api/sms-status` | בדיקת הגדרה בלבד, ללא סודות |
| `GET /api/knowledge-chat?health=1` | health לפרוב |
| `GET /go/review` | הפניה לדירוג גוגל |

## אחסון בדפדפן

- **פרודקשן:** JWT וסשני תמיכה ב-`sessionStorage`; ניקוי ב-logout (`clearSensitiveClientStorage`)
- **דמו:** `localStorage` לנתוני דמו בלבד — לא לפרודקשן
- CRM בענן: `isCrmCloudEnabled()` — Supabase + RLS; בדמו/localStorage ראו `crmCloudMode.js`

## העלאות קבצים (ZIP)

- Magic bytes + מגבלות zip-bomb (`supportZipValidation.js`)
- **ברירת מחדל בפרודקשן: ZIP חסום** — אין צורך במשתני סביבה אם לא נדרש AV
- לאפשר ZIP בלי סריקה (לא מומלץ): `SUPPORT_ZIP_ALLOW_WITHOUT_AV=true`
- לאפשר ZIP עם סריקה: `UPLOAD_AV_WEBHOOK_URL`

## דמו מול פרודקשן

- גישת מנהל בדמו: נציג מחובר עם `is_admin` (למשל `agent01@demo.local`) — **אין** PIN 1234 בקוד
- `VITE_DEMO_MODE=true` רק בפרויקט דמו Vercel

## hypsmart — צ'קליסט פרודקשן (חובה)

| משתנה | היכן | הערה |
|--------|------|------|
| `VITE_SUPABASE_URL` | Vercel build | קליינט |
| `VITE_SUPABASE_ANON_KEY` | Vercel build | קליינט |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server | `/api/agent-auth`, RAG, storage |
| `RESEND_API_KEY` + `EMAIL_FROM` | Vercel server | מייל תמיכה / שיתוף מסך |
| `GUEST_LINK_SECRET` | Vercel server | חתימת קישורי אורח |
| `GEMINI_API_KEY` (או `OPENAI_API_KEY`) | Vercel server | בסיס ידע — **לא** `VITE_*` |
| `INFORU_USERNAME` + `INFORU_API_TOKEN` | Vercel server | SMS שיבוץ (אם בשימוש) |
| `VITE_APP_URL` | Vercel build | קישורים במייל/SMS |

**Supabase SQL (בסדר):** `security_phase0a` → … → `security_phase16.sql` + `knowledge_pgvector.sql` לפי הצורך.

**אחרי שינוי env:** Redeploy ב-Vercel. **אל** להגדיר `VITE_DEMO_MODE` בפרודקשן.
