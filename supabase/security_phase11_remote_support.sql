-- =============================================================================
-- שלב 11 — הקשחת תמיכה מרחוק / השתלטות מרחוק
-- =============================================================================
-- הרץ **אחרי** security_phase9_agent_rls.sql (+ deploy קוד phase 11)
--
-- מה זה עושה:
--   • מסיר פרצת RLS: כל נציג מחובר יכול היה לשלוח הודעות guest לכל סשן פעיל
--   • צ'אט אורח — רק דרך API (/api/agent-auth guest_chat_*) עם טוקן חתום
--   • INSERT ל-support_session_messages — רק נציג בעל הסשן או מנהל
--
-- מה זה **לא** עושה:
--   • לא משנה מדיניות support_sessions (שלב 4+9)
--   • לא משנה storage policies (שלב 5–6)
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

-- ── 1. support_session_messages — INSERT מחמיר ─────────────────────────────

drop policy if exists authenticated_insert_support_session_messages on public.support_session_messages;

create policy authenticated_insert_support_session_messages on public.support_session_messages
  for insert to authenticated
  with check (
    public.auth_owns_support_session(session_id)
    or public.auth_agent_is_admin()
  );

-- ── 2. אין גישת anon לצ'אט סשן (אימות) ─────────────────────────────────────

revoke insert, update, delete on table public.support_session_messages from anon;

commit;
