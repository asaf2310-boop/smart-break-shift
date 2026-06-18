-- =============================================================================
-- שלב 15 — ניקוי guest links, אימות RLS תמיכה מרחוק
-- =============================================================================
-- הרץ **אחרי** security_phase14_remote_takeover.sql (+ deploy קוד phase 15)
--
-- מה זה עושה:
--   • פונקציית ניקוי רשומות guest_link_redemptions שפג תוקפן
--   • אימות שאין מדיניות RLS פתוחה על טבלאות תמיכה מרחוק (הערות)
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

-- ── 1. ניקוי רשומות מימוש קישור אורח שפג תוקפן ─────────────────────────────

create or replace function public.cleanup_expired_guest_link_redemptions()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.guest_link_redemptions
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_guest_link_redemptions() from public;
grant execute on function public.cleanup_expired_guest_link_redemptions() to service_role;

comment on function public.cleanup_expired_guest_link_redemptions() is
  'מוחק רשומות guest_link_redemptions שפג תוקפן. הרצה ידנית או pg_cron יומי.';

-- אופציונלי (pg_cron — דורש הרחבה ב-Supabase):
-- select cron.schedule(
--   'cleanup-guest-link-redemptions',
--   '0 3 * * *',
--   $$ select public.cleanup_expired_guest_link_redemptions(); $$
-- );

-- ── 2. RLS — אימות טבלאות תמיכה מרחוק (phase 4/9/11/14) ───────────────────
-- guest_link_redemptions: RLS מופעל, revoke מלא ל-anon/authenticated (phase 14)
-- support_sessions: anon ללא גישה (phase 4); authenticated לפי auth_agent_owns_name (phase 9)
-- support_session_messages: INSERT רק לבעל סשן/מנהל (phase 11); anon ללא INSERT
-- security_audit_log: SELECT מנהל בלבד; INSERT רק service role (phase 12)
--
-- אין שינוי מדיניות נדרש — הרץ SELECT לאימות אחרי מיגרציה:
--   select tablename, policyname, roles, cmd from pg_policies
--   where schemaname = 'public'
--     and tablename in ('support_sessions', 'support_session_messages', 'guest_link_redemptions');

commit;
