-- =============================================================================
-- שלב 16 — InfoSec (ללא שינוי מדיניות RLS חדשה)
-- =============================================================================
-- הרץ **אחרי** security_phase15_hardening.sql (+ deploy קוד phase 16)
--
-- Phase 16 ממוקד בקוד (API JWT, SIP, localStorage, ZIP AV) — אין מדיניות DB חדשה.
-- קובץ זה לאימות ותיעוד בלבד.
--
-- אימות Auth / RLS (ידני):
--   select tablename, policyname, roles, cmd from pg_policies
--   where schemaname = 'public'
--     and tablename in ('agents', 'support_sessions', 'security_audit_log');
--
-- ודאו: agents — אין עמודת password_plain; is_admin לניהול בלבד.
-- =============================================================================

begin;

comment on table public.agents is
  'נציגים — אימות דרך Supabase Auth (auth_user_id). is_admin לממשק מנהל. ללא סיסמאות בטבלה.';

commit;
