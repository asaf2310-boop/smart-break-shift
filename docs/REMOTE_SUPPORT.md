# תמיכה מרחוק — smart-break-shift

מסמך זה מתאר **שני מצבי תמיכה מרחוק** בדמו, **רק לאחר אישור מפורש** מהלקוח:

| מצב | שימוש | טכנולוגיה |
|-----|--------|-----------|
| **שלב א — צפייה במסך** | הסבר, הדרכה, אבחון ויזואלי | דפדפן + WebRTC ([PeerJS](https://peerjs.com/)) |
| **שליטה מלאה** | שליטה בעכבר ומקלדת | [RustDesk](https://rustdesk.com/) |

> **אזהרת דמו:** סיסמאות RustDesk וסשנים עשויים להישמר ב-`localStorage`. שיתוף מסך משתמש ב-**PeerServer הציבורי** של PeerJS. **לפרודקשן:** PeerServer עצמי (או Supabase Realtime), שרת RustDesk עצמי (hbbs/hbbr), מדיניות אבטחה, ואחסון מוצפן/זמני.

---

## שלב א — צפייה במסך (דפדפן)

### מה זה נותן?

- הלקוח **אינו מתקין** תוכנה — רק פותח קישור במייל.
- הנציג **רואה** את המסך — **אין** שליטה בעכבר או במקלדת.
- מומלץ **Chrome** או **Edge** אצל הלקוח.

### זרימת PeerJS (חשוב)

1. **נציג** יוצר סשן ומשאיר פתוח את מסך הצפייה (`new Peer(sessionId)` — ממתין לשיחה נכנסת).
2. **לקוח** פותח `/support/screen/:sessionId`, מאשר, לוחץ «אני מאשר ומשתף מסך».
3. **לקוח** `getDisplayMedia` → `new Peer()` → `peer.call(sessionId, stream)`.
4. **נציג** מקבל `call`, עונה ב-`answer()`, מציג ב-`<video>`.

אם הנציג לא פתח את מסך הצפייה לפני הלקוח — החיבור עלול להיכשל (מזהה לא זמין / timeout).

### מה הלקוח עושה

1. לפתוח את הקישור מהמייל: `{origin}/support/screen/{sessionId}`
2. לקרוא את ההסבר, לסמן אישור.
3. ללחוץ «אני מאשר ומשתף מסך».
4. לבחור מסך / חלון / לשונית בשיתוף הדפדפן.

### מה הנציג עושה

1. «תמיכה מרחוק» → לשונית **שלב א — צפייה (דפדפן)**.
2. הזנת מייל → **התחל סשן צפייה** (חייב להישאר פתוח).
3. שליחת מייל (Resend) / העתקת קישור — הלקוח מאשר בדף `/support/screen/:sessionId`.
4. סטטוס «ממתין לאישור הלקוח בקישור» עד `consentAt`; צפייה בווידאו לאחר שיתוף מסך → **סיים סשן**.

### Signaling לפרודקשן

בדמו: שרת PeerJS הציבורי (`0.peerjs.com`). לפרודקשן:

- [הרצת PeerServer עצמי](https://github.com/peers/peerjs-server)
- או חלופה: Supabase Realtime / Socket.io לסיגנלינג מותאם

---

## שליטה מלאה — RustDesk

### למה RustDesk?

| יתרון | פירוט |
|--------|--------|
| **חינם וקוד פתוח** | ללא רישיון יקר |
| **שליטה מלאה** | שולחן עבודה אמיתי |
| **אבטחה** | E2E; אירוח עצמי hbbs/hbbr |

האפליקציה **אינה** מחליפה את RustDesk: הנציג פותח **אפליקציית RustDesk** (או `rustdesk://`).

### מה הלקוח עושה

1. להוריד RustDesk: https://rustdesk.com/
2. לשתף מזהה (9 ספרות) וסיסמה.
3. לאשר גישה בדף `/support/consent/:token` (קישור במייל).

### מה הנציג עושה

1. «תמיכה מרחוק» → לשונית **שליטה מלאה — RustDesk**.
2. אשף: מייל הורדה (Resend) + קישור אישור → מזהה וסיסמה → פתיחת RustDesk (אישור לקוח ב-`/support/consent/:token`).

---

## שליחת מייל אמיתית (Resend + Vercel)

הדמו שולח מייל ללקוח עם קישור שיתוף מסך (ושלב ב' — קישור הורדת RustDesk) דרך **Resend**, עם מפתח API **רק בשרת** (לא `VITE_*`).

### משתני סביבה (Vercel)

| משתנה | דוגמה | הערות |
|--------|--------|--------|
| `RESEND_API_KEY` | `re_...` | מ-[resend.com](https://resend.com) |
| `EMAIL_FROM` | `onboarding@resend.dev` | לבדיקות; בפרודקשן — כתובת מדומיין מאומת |

לאחר הוספה: **Redeploy** לפרויקט.

### API

- `GET /api/email-status` — `{ "configured": boolean, "apiPresent": true }` (בודק `RESEND_API_KEY` + `EMAIL_FROM` בלי לחשוף ערכים)
- `POST /api/send-email` — גוף JSON: `{ "to", "subject", "html", "text?" }`
- CORS: same origin בלבד
- אם המפתח לא מוגדר: `503` + `code: email_not_configured` — האפליקציה נופלת לסימולציה מקומית + הודעה
- אם `/api/*` לא נפרס (404 מ-SPA): בדקו ש-`api/` קיים ב-GitHub ו-Redeploy

### `vercel.json` ונתיבי API

ה-rewrite `{ "source": "/((?!api/).*)", "destination": "/index.html" }` **אינו** מנתב בקשות ל-`/api/*` ל-SPA — רק נתיבים שלא מתחילים ב-`api/` נשלחים ל-`index.html`. אין צורך ב-rewrite נוסף לפונקציות Serverless.

### פתרון בעיות (Vercel)

1. **ודאו שה-API נפרס:** פתחו `https://<your-app>.vercel.app/api/email-status` בדפדפן.
   - תשובה תקינה: `{ "configured": true, "apiPresent": true }` — המייל מוכן.
   - `{ "configured": false, "apiPresent": true }` — ה-API קיים אך חסרים `RESEND_API_KEY` או `EMAIL_FROM` ב-Vercel → Settings → Environment Variables → **Redeploy**.
   - **404 / דף SPA:** תיקיית `api/` חסרה ב-GitHub — הריצו `upload-to-github.ps1` (או `git push`) וודאו:
     - `api/send-email.js`
     - `api/email-status.js`
     ואז Redeploy.
2. **בדיקה מהאפליקציה:** בדף «השתלטות מרחוק» — באנר ירוק «מייל: פעיל» או כתום עם הוראות.
3. **אחרי שינוי env:** תמיד Redeploy (לא רק Save) — משתני סביבה נטענים בזמן build/deploy.

### פיתוח מקומי

| פקודה | שליחה אמיתית |
|--------|----------------|
| `npm run dev` | לא (אלא אם מריצים גם `npx vercel dev` — Vite מפנה `/api` לפורט 3000) |
| `npx vercel dev` | כן — עם `.env.local` שמכיל `RESEND_API_KEY` ו-`EMAIL_FROM` |
| פריסה ל-Vercel | כן |

**חשוב:** אל תשימו `RESEND_API_KEY` ב-`VITE_*`. ראו `.env.example`.

### קבצים

| קובץ | תפקיד |
|------|--------|
| `api/send-email.js` | Handler ל-Vercel + Resend |
| `api/email-status.js` | בדיקת הגדרת מייל (GET, ללא סודות) |
| `src/lib/emailApi.js` | `fetch` מהדפדפן ל-API |
| `src/lib/screenShareStore.js` | תבנית HTML RTL + `sendScreenShareEmail` |
| `src/lib/remoteSupportStore.js` | מייל RustDesk (אופציונלי) |

---

## אישור משפטי ותיעוד

- **איסור גישה ללא הסכמה מפורשת** — בדף הלקוח (קישור שיתוף מסך או אישור RustDesk), לא דרך תיבת סימון אצל הנציג.
- **תיעוד:** זמן, נציג, סוג סשן (צפייה / RustDesk), לקוח CRM.
- צפייה בדפדפן ≠ שליטה מלאה — יש להבהיר ללקוח.

---

## קבצים רלוונטיים

| קובץ | תפקיד |
|------|--------|
| `src/lib/screenShareStore.js` | סשני צפייה, מייל (Resend), קישור אורח |
| `src/lib/remoteSupportStore.js` | סשני RustDesk, אישור, מייל (Resend) |
| `api/send-email.js` | שליחת מייל בשרת |
| `api/email-status.js` | בדיקת סטטוס מייל ב-Vercel |
| `src/components/remote/ScreenSharePanel.jsx` | אשף נציג — שלב א |
| `src/components/remote/ScreenShareAgentView.jsx` | וידאו נציג (PeerJS host) |
| `src/pages/ScreenShareGuestPage.jsx` | דף לקוח `/support/screen/:sessionId` |
| `src/components/remote/RemoteSupportPanel.jsx` | לשוניות: דפדפן + RustDesk |
| `src/pages/RemoteSupportPage.jsx` | סקירה ורשימות סשנים |
| `docs/REMOTE_SUPPORT.md` | מסמך זה |

---

## בדיקה ידנית (דמו)

### צפייה בדפדפן — שני חלונות

1. `npm install` (כולל `peerjs`) → `npm run dev`
2. **חלון א' (נציג):** התחברות → תמיכה מרחוק → שלב א → **התחל סשן צפייה** — השאירו את הדיאלוג/ווידאו פתוח.
3. **חלון ב' (לקוח):** העתיקו קישור אורח → פתיחה ב-Chrome/Edge → «אני מאשר שיתוף מסך» → שיתוף מסך.
4. ודאו שהווידאו מופיע אצל הנציג; סיימו סשן.

### RustDesk — ללא שינוי

1. לשונית RustDesk → אשף קיים → מזהה 9 ספרות וכו'.

### שני מכשירים

אותה זרימה; ודאו ששני המכשירים באותו `origin` (אותו `npm run dev` / דומיין) כדי ש-`localStorage` של הסשן יהיה זמין לדף האורח בדמו.
