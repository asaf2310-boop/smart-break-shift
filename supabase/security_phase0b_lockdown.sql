-- =============================================================================
-- שלב 0ב — נעילת RLS מלאה ל-anon (שובר את האפליקציה עד שלב 1!)
-- =============================================================================
-- איפה: רק בפרויקט Supabase **סטייג'ינג** / חדש — לא בפרודקשן hypsmart עדיין
--
-- מה זה עושה: מוחק מדיניות anon_all_* / using(true) — רק על טבלאות שקיימות
-- אחרי הרצה: רק service_role (Vercel API) יכול לכתוב/לקרוא דרך REST
--
-- הרץ אחרי: security_phase0a_immediate.sql (או במקומו בסטייג'ינג)
-- =============================================================================

begin;

-- עוזר: drop policy רק אם הטבלה קיימת (מונע שגיאת relation does not exist)
create or replace function public._security_drop_policy_if_table_exists(
  p_schema text,
  p_table text,
  p_policy text
)
returns void
language plpgsql
as $$
declare
  qualified text := format('%I.%I', p_schema, p_table);
begin
  if to_regclass(qualified) is not null then
    execute format('drop policy if exists %I on %s', p_policy, qualified);
  end if;
end;
$$;

-- ── טבלאות ליבה (משמרות / צ'אט) ─────────────────────────────────────────────
select public._security_drop_policy_if_table_exists('public', 'break_registrations', 'anon_all_break_registrations');
select public._security_drop_policy_if_table_exists('public', 'break_settings', 'anon_all_break_settings');
select public._security_drop_policy_if_table_exists('public', 'shift_registrations', 'anon_all_shift_registrations');
select public._security_drop_policy_if_table_exists('public', 'shift_unavailabilities', 'anon_all_shift_unavailabilities');
select public._security_drop_policy_if_table_exists('public', 'vacation_requests', 'anon_all_vacation_requests');
select public._security_drop_policy_if_table_exists('public', 'constraint_confirmations', 'anon_all_constraint_confirmations');
select public._security_drop_policy_if_table_exists('public', 'constraints_week_settings', 'anon_all_constraints_week_settings');
select public._security_drop_policy_if_table_exists('public', 'chat_messages', 'anon_all_chat_messages');
select public._security_drop_policy_if_table_exists('public', 'chat_presence', 'anon_all_chat_presence');
select public._security_drop_policy_if_table_exists('public', 'chat_settings', 'anon_all_chat_settings');

-- ── נציגים ──────────────────────────────────────────────────────────────────
select public._security_drop_policy_if_table_exists('public', 'agents', 'anon_read_active_agents');
select public._security_drop_policy_if_table_exists('public', 'agents', 'anon_manage_agents');

do $revoke_agents$
begin
  if to_regclass('public.agents') is not null then
    revoke all on table public.agents from anon;
  end if;
end $revoke_agents$;

-- ── תמיכה מרחוק ─────────────────────────────────────────────────────────────
select public._security_drop_policy_if_table_exists('public', 'support_sessions', 'anon_all_support_sessions');
select public._security_drop_policy_if_table_exists('public', 'support_session_messages', 'anon_all_support_session_messages');
select public._security_drop_policy_if_table_exists('public', 'support_session_files', 'anon_all_support_session_files');
select public._security_drop_policy_if_table_exists('public', 'screen_recordings', 'anon_all_screen_recordings');

-- ── בסיס ידע ────────────────────────────────────────────────────────────────
select public._security_drop_policy_if_table_exists('public', 'knowledge_documents', 'anon_all_knowledge_documents');
select public._security_drop_policy_if_table_exists('public', 'knowledge_index', 'anon_all_knowledge_index');
select public._security_drop_policy_if_table_exists('public', 'knowledge_chunks', 'anon_read_knowledge_chunks');
select public._security_drop_policy_if_table_exists('public', 'knowledge_query_logs', 'anon_read_knowledge_query_logs');
select public._security_drop_policy_if_table_exists('public', 'knowledge_images', 'anon_read_knowledge_images');
select public._security_drop_policy_if_table_exists('public', 'knowledge_gaps', 'anon_read_knowledge_gaps');
select public._security_drop_policy_if_table_exists('public', 'knowledge_feedback', 'anon_read_knowledge_feedback');

-- ── מדדים / הדרכה ───────────────────────────────────────────────────────────
select public._security_drop_policy_if_table_exists('public', 'agent_metrics_uploads', 'anon_all_agent_metrics_uploads');
select public._security_drop_policy_if_table_exists('public', 'agent_metrics_rows', 'anon_all_agent_metrics_rows');
select public._security_drop_policy_if_table_exists('public', 'agent_metrics_settings', 'anon_all_agent_metrics_settings');
select public._security_drop_policy_if_table_exists('public', 'training_schedule_settings', 'anon_all_training_schedule_settings');
select public._security_drop_policy_if_table_exists('public', 'training_presentation_meta', 'anon_all_training_presentation_meta');

-- ── Storage (storage.objects תמיד קיים ב-Supabase) ─────────────────────────
drop policy if exists "support_files_storage_select" on storage.objects;
drop policy if exists "support_files_storage_insert" on storage.objects;
drop policy if exists "support_files_storage_update" on storage.objects;
drop policy if exists "support_files_storage_delete" on storage.objects;

drop policy if exists "screen_recordings_storage_select" on storage.objects;
drop policy if exists "screen_recordings_storage_insert" on storage.objects;
drop policy if exists "screen_recordings_storage_update" on storage.objects;
drop policy if exists "screen_recordings_storage_delete" on storage.objects;

drop policy if exists "training_docs_public_read" on storage.objects;
drop policy if exists "training_docs_anon_insert" on storage.objects;
drop policy if exists "training_docs_anon_update" on storage.objects;
drop policy if exists "training_docs_anon_delete" on storage.objects;

drop function if exists public._security_drop_policy_if_table_exists(text, text, text);

commit;
