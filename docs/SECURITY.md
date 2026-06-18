# אבטחת מידע — Phase 21 (סיכום)

מסמך מרכזי להגדרות אבטחה. פירוט לפי תחום: `SIP_SECURITY.md`, `PEERJS_SECURITY.md`, `DEMO_VS_PRODUCTION.md`.

## Supabase Auth — נציגים

| עקרון | פרט |
|--------|-----|
| כניסה | `supabase.auth.signInWithPassword` בקליינט — **לא** סיסמאות בטבלת `agents` |
| API רגיש | `POST /api/agent-auth` עם `Authorization: Bearer <access_token>` |
| מנהל | `agents.is_admin === true` ב-DB; אופציונלי `ADMIN_PIN` בשרת בלבד |
| RLS | נציגים רואים רק שורות משויכות; anon ללא גישה לטבלאות רגישות |
| מיגרציה | `security_phase0a` → … → `security_phase21.sql` |

### ADMIN_PIN (אופציונלי, שרת בלבד)

- משתנה: `ADMIN_PIN` ב-Vercel — **ללא** `VITE_`
- כשמוגדר: פעולות מנהל ב-API דורשות `adminPin` בגוף הבקשה **בנוסף** ל-JWT + `is_admin`
- **אל תגדירו PIN חלש** (1234, 0000). אם לא נדרש שכבה שנייה — השאירו ריק.
- הלקוח **לא** שולח PIN מ-build (`VITE_ADMIN_PIN` הוסר; מפתחות legacy נמחקים ב-logout)

## API — שכבות הגנה

1. `isSameOrigin` — הגנת CSRF/CORS (defense-in-depth)
2. `verifyBearerAgent` / `verifyKnowledgeAccess` / `verifyAdminAgent` — לפי רגישות
3. Rate limits — SMS, מייל, העלאות, SIP, איפוס סיסמה, guest resolve, storage, knowledge search/feedback
   - **Phase 21:** כשמוגדר Upstash — מגבלות משותפות בין instances; אחרת in-memory (best-effort)

### Upstash Redis (אופציונלי, מומלץ לפרודקשן)

| משתנה | היכן | תיאור |
|--------|------|--------|
| `UPSTASH_REDIS_REST_URL` | Vercel server | REST URL מ-[Upstash Console](https://console.upstash.com/) |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel server | טוקן REST — **ללא** `VITE_` |

**הגדרה:**

1. צרו database ב-Upstash (אזור קרוב ל-Vercel)
2. העתיקו REST URL + Token ל-Vercel → Environment Variables → Production
3. Redeploy

כשלא מוגדר — fallback אוטומטי ל-in-memory (כמו לפני phase 21).

נקודות קצה עם Upstash (כשמוגדר): איפוס סיסמה, guest resolve/session/chat, SIP mint/redeem, שליחת מייל, storage upload, פעולות מנהל.

**בסיס ידע:** `GET /api/knowledge-upload` — מודול knowledge או מנהל; `POST`/`DELETE` (ingest/delete) — **מנהל בלבד**. `GET /api/knowledge-chat?welcome=1` — JWT + מודול knowledge (phase 20).

### נקודות קצה ציבוריות (ללא JWT)

| Endpoint | סיבה |
|----------|------|
| `GET /api/email-status`, `GET /api/sms-status` | בדיקת הגדרה בלבד, ללא סודות |
| `GET /api/knowledge-chat?health=1`, `GET /api/knowledge-embed?health=1` | health לפרוב |
| `GET /go/review` | הפניה לדירוג גוגל |
| `POST /api/agent-auth` — `request_password_reset`, `request_first_login` | איפוס/כניסה ראשונה (rate limit לפי IP + cooldown לפי אימייל) |
| `POST /api/agent-auth` — `resolve`, `guest_session`, `guest_chat_*`, `ice_servers` (אורח) | קישור אורח חתום + fingerprint |

## אחסון בדפדפן

- **פרודקשן:** JWT וסשני תמיכה ב-`sessionStorage`; ניקוי ב-logout (`clearSensitiveClientStorage` + `supabase.auth.signOut` + ניתוק SIP)
- **דמו:** `localStorage` לנתוני דמו בלבד — לא לפרודקשן
- **אורח:** טוקני קישור/WebRTC ב-`sessionStorage`; ניקוי אוטומטי כשהסשן פג / הסתיים (`guestSessionTokenCleanup.js`)
- CRM בענן: `isCrmCloudEnabled()` — Supabase + RLS; בדמו/localStorage ראו `crmCloudMode.js`

## סודות בקליינט (`VITE_*`)

| משתנה | בטוח? | הערה |
|--------|--------|------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | כן | מיועד לקליינט; RLS מגן |
| `VITE_SIP_WS_URL`, `VITE_SIP_USER` | זהירות | ללא סיסמה — SIP דרך `sip_token_*` בשרת בלבד (phase 19) |
| `VITE_TWILIO_*` | זהירות | בקוד: רק בדיקת נוכחות (Boolean), לא ערכים מלאים |
| `VITE_*_API_KEY`, `VITE_ADMIN_PIN`, `VITE_OPENAI_*` | **לא** | אסור בפרודקשן — מפתחות AI/SMS/מייל בשרת בלבד |

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
| `INFORU_USERNAME` + `INFORU_API_TOKEN` | Vercel server | SMS שיבוץ / איפוס סיסמה |
| `VITE_APP_URL` | Vercel build | קישורים במייל/SMS |
| `ADMIN_PIN` | Vercel server (אופציונלי) | שכבה שנייה למנהל — לא בקליינט |

**Supabase SQL (בסדר):** `security_phase0a` → … → `security_phase21.sql` + `knowledge_pgvector.sql` לפי הצורך.

**אופציונלי (מומלץ):** `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate limits מבוזרים.

**אחרי שינוי env:** Redeploy ב-Vercel. **אל** להגדיר `VITE_DEMO_MODE` בפרודקשן.

## סטטוס אחרי Phase 21

### נסגר (Phases 0–21)

| תחום | מצב |
|------|-----|
| אימות API | JWT + `is_admin` לכל נקודות קצה רגישות; ingest ידע — מנהל בלבד |
| סיסמאות | מינימום 12 תווים; איפוס/כניסה ראשונה — rate limit IP + cooldown אימייל (תשובה גנרית, ללא enumeration) |
| אחסון דפדפן | פרודקשן: `sessionStorage`; logout מנקה JWT, SIP, guest/webrtc tokens; דמו localStorage לא נקרא בלי `VITE_DEMO_MODE` |
| תמיכה מרחוק | קישורי אורח חד-פעמיים, join tokens, fingerprint, TTL, ניקוי טוקנים stale בקליינט |
| SIP | mint/redeem דרך `agent-auth` בלבד; ניתוק + מחיקת סיסמה מזיכרון ב-logout **ובטאב מוסתר** (phase 21) |
| העלאות | ZIP חסום בפרודקשן כברירת מחדל; allowlist + magic bytes |
| Rate limits | Upstash אופציונלי; fallback in-memory; כיסוי password reset, guest, SIP, email, storage |
| כותרות | CSP (כולל `object-src 'none'`), COOP, CORP, X-Frame-Options, וכו' ב-`vercel.json` |
| PeerJS | אזהרות build-time אם חסר `VITE_PEERJS_HOST` בפרודקשן |
| יומן ביקורת | UI בעברית; phase 20: `admin_agent_*`, `crm_routing_change` |

### עתידי (דורש תשתית נוספת)

| פריט | למה לא בוצע |
|------|-------------|
| **SIP proxy** | סיסמת SIP עדיין מגיעה לדפדפן ב-`sip_token_redeem` — ראו `SIP_SECURITY.md` |
| **SIP nonce ב-Redis** | `sipRedeemStore` in-memory — דורש Upstash + מפתחות משותפים לחד-פעמיות בין instances |
| **PeerJS self-host** | דורש פריסת PeerServer + `VITE_PEERJS_*` — ראו `PEERJS_SECURITY.md` |
| **CSP מלא** | `unsafe-inline` / `unsafe-eval` עדיין נדרשים ל-Vite build |
| **AV ל-ZIP** | לא נדרש ללקוח; אופציונלי דרך `UPLOAD_AV_WEBHOOK_URL` |
