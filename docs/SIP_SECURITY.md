# אבטחת SIP / WebRTC (Phase 16 + 21)

## מצב נוכחי

| נושא | מימוש | הערה |
|------|--------|------|
| הנפקת אישורים | `POST /api/agent-auth` — `sip_token_mint` / `sip_token_redeem` | JWT נציג חובה |
| טוקן מוצפן | `SIP_TOKEN_SECRET` (או `GUEST_LINK_SECRET`) | TTL קצר, מימוש חד-פעמי |
| Shim ישן | `/api/sip-token` **הוסר** (Phase 16) | השתמשו רק ב-agent-auth |
| סיסמת SIP בדפדפן | **עדיין נדרשת** ל-WebRTC | sip.js מצפה ל-`authorizationPassword` מקומית |
| ניקוי סיסמה (phase 21) | logout + `visibilitychange` (טאב מוסתר) | `disconnectSip` מאפס סיסמה בזיכרון; חיבור מחדש דורש redeem |

### למה הסיסמה עדיין מגיעה ללקוח?

פרוטוקול WebRTC + sip.js דורשים מהדפדפן לבצע רישום SIP (Digest) ישירות מול ה-PBX.
אין בפרויקט זה **SIP proxy** שמחליף את הלקוח — לכן אחרי `sip_token_redeem` הסיסמה נשמרת בזיכרון התהליך בלבד (לא ב-localStorage) ומשמשת את sip.js.

**אין לשים `VITE_SIP_PASSWORD` בפרודקשן** — רק אישורים מהשרת דרך agent-auth.

## זרימה מומלצת

```text
נציג (JWT) → sip_token_mint → credentialToken (מוצפן, ללא סיסמה)
           → sip_token_redeem → wsUrl, user, password (זיכרון בלבד)
           → sip.js SimpleUser.register()
```

## הגנות קיימות

- אימות נציג (Bearer JWT) לפני mint/redeem
- Rate limit על פעולות SIP (Upstash אופציונלי — phase 21)
- רישום ב-`security_audit_log` (`sip_token_mint`, `sip_token_redeem`)
- אין לוג של סיסמת SIP בשרת
- תגובת mint **אינה** מחזירה סיסמה — רק `credentialToken`
- ניתוק אוטומטי כשהטאב מוסתר — מקצר חלון חשיפת סיסמה בזיכרון

## עתיד (מחוץ לשלב זה)

לבניית **SIP/WebRTC proxy** (BFF או media gateway) שמחזיק את הסיסמה בשרת בלבד:

1. הלקוח מתחבר ל-proxy ב-WSS עם טוקן קצר-טווח
2. ה-proxy נרשם ל-FreePBX/Asterisk עם סיסמה מ-`SIP_PASSWORD_*`
3. הדפדפן לא רואה סיסמת שלוחה

ראו גם: `docs/TELEPHONY_SETUP.md`, `docs/SELF_HOSTED_PBX.md`.

## משתני סביבה (שרת בלבד)

| משתנה | תיאור |
|--------|--------|
| `SIP_WS_URL`, `SIP_DOMAIN` | חיבור WSS |
| `SIP_USER` / `SIP_PASSWORD` או `SIP_USER_101`… | שלוחות |
| `SIP_AGENT_MAP` | מיפוי שם נציג → שלוחה |
| `SIP_TOKEN_SECRET` | חתימת טוקן מוצפן |
| `SIP_CREDENTIAL_TTL_SEC` | ברירת מחדל 120 |
