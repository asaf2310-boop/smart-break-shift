-- =============================================================================
-- שלב 3 — ביטול כתיבה (וברוב הטבלאות גם קריאה) ל-anon
-- =============================================================================
-- הרץ **אחרי**:
--   1. security_phase0a_immediate.sql
--   2. security_phase1_auth.sql
--   3. Deploy קוד עם dataClient + JWT (שלב 2)
--   4. security_phase2_authenticated_data.sql
--   5. Deploy קוד עם AdminGate שדורש התחברות נציג ל-/admin
--
-- מה זה עושה:
--   • מחליף מדיניות anon_all_* ב-select בלבד או מסיר גישת anon לגמרי
--   • מוסיף מדיניות authenticated על טבלאות ידע (שלא נכללו בשלב 2)
--   • מאפשר לנציג מחובר לנהל טבלת agents (פאנל מנהל — דורש JWT + כניסה ל-/admin)
--
-- anon נשאר עם SELECT בלבד על:
--   • agents — זיהוי בכניסה (שלב 1)
--   • support_sessions — שלב 3 בלבד; שלב 4 מסיר גם זאת (טוקן חתום ב-API)
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

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

create or replace function public._security_revoke_anon_on_table_if_exists(
  p_schema text,
  p_table text
)
returns void
language plpgsql
as $$
declare
  qualified text := format('%I.%I', p_schema, p_table);
begin
  if to_regclass(qualified) is not null then
    execute format('revoke all on table %s from anon', qualified);
  end if;
end;
$$;

create or replace function public._security_remove_anon_access_if_table_exists(
  p_schema text,
  p_table text,
  p_anon_all_policy text
)
returns void
language plpgsql
as $$
begin
  perform public._security_drop_policy_if_table_exists(p_schema, p_table, p_anon_all_policy);
  perform public._security_revoke_anon_on_table_if_exists(p_schema, p_table);
end;
$$;

create or replace function public._security_anon_select_only_if_table_exists(
  p_schema text,
  p_table text,
  p_anon_all_policy text,
  p_anon_read_policy text,
  p_using_sql text default 'true'
)
returns void
language plpgsql
as $$
declare
  qualified text := format('%I.%I', p_schema, p_table);
begin
  if to_regclass(qualified) is null then
    return;
  end if;
  perform public._security_drop_policy_if_table_exists(p_schema, p_table, p_anon_all_policy);
  execute format('revoke insert, update, delete on table %s from anon', qualified);
  execute format('grant select on table %s to anon', qualified);
  perform public._security_drop_policy_if_table_exists(p_schema, p_table, p_anon_read_policy);
  execute format(
    'create policy %I on %s for select to anon using (%s)',
    p_anon_read_policy,
    qualified,
    p_using_sql
  );
end;
$$;

create or replace function public._security_grant_authenticated_if_table_exists(
  p_schema text,
  p_table text
)
returns void
language plpgsql
as $$
declare
  qualified text := format('%I.%I', p_schema, p_table);
begin
  if to_regclass(qualified) is not null then
    execute format(
      'grant select, insert, update, delete on table %s to authenticated',
      qualified
    );
  end if;
end;
$$;

create or replace function public._security_policy_authenticated_all_if_table_exists(
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
  if to_regclass(qualified) is null then
    return;
  end if;
  perform public._security_grant_authenticated_if_table_exists(p_schema, p_table);
  perform public._security_drop_policy_if_table_exists(p_schema, p_table, p_policy);
  execute format(
    'create policy %I on %s for all to authenticated using (true) with check (true)',
    p_policy,
    qualified
  );
end;
$$;

-- ── ליבה: הסרת anon לגמרי (נציג מחובר דרך authenticated משלב 2) ───────────────
select public._security_remove_anon_access_if_table_exists(
  'public', 'break_registrations', 'anon_all_break_registrations'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'break_settings', 'anon_all_break_settings'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'shift_registrations', 'anon_all_shift_registrations'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'shift_unavailabilities', 'anon_all_shift_unavailabilities'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'vacation_requests', 'anon_all_vacation_requests'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'constraint_confirmations', 'anon_all_constraint_confirmations'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'constraints_week_settings', 'anon_all_constraints_week_settings'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'chat_messages', 'anon_all_chat_messages'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'chat_presence', 'anon_all_chat_presence'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'chat_settings', 'anon_all_chat_settings'
);

-- ── תמיכה מרחוק ─────────────────────────────────────────────────────────────
select public._security_anon_select_only_if_table_exists(
  'public',
  'support_sessions',
  'anon_all_support_sessions',
  'anon_read_support_sessions_guest'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'support_session_messages', 'anon_all_support_session_messages'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'support_session_files', 'anon_all_support_session_files'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'screen_recordings', 'anon_all_screen_recordings'
);

-- ── מדדים / הדרכה ───────────────────────────────────────────────────────────
select public._security_remove_anon_access_if_table_exists(
  'public', 'agent_metrics_uploads', 'anon_all_agent_metrics_uploads'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'agent_metrics_rows', 'anon_all_agent_metrics_rows'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'agent_metrics_settings', 'anon_all_agent_metrics_settings'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'training_schedule_settings', 'anon_all_training_schedule_settings'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'training_presentation_meta', 'anon_all_training_presentation_meta'
);

-- ── בסיס ידע (authenticated — שלא נכלל בשלב 2) ─────────────────────────────
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'knowledge_documents', 'authenticated_all_knowledge_documents'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'knowledge_index', 'authenticated_all_knowledge_index'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'knowledge_chunks', 'authenticated_all_knowledge_chunks'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'knowledge_query_logs', 'authenticated_all_knowledge_query_logs'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'knowledge_images', 'authenticated_all_knowledge_images'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'knowledge_gaps', 'authenticated_all_knowledge_gaps'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'knowledge_feedback', 'authenticated_all_knowledge_feedback'
);

select public._security_remove_anon_access_if_table_exists(
  'public', 'knowledge_documents', 'anon_all_knowledge_documents'
);
select public._security_remove_anon_access_if_table_exists(
  'public', 'knowledge_index', 'anon_all_knowledge_index'
);
select public._security_drop_policy_if_table_exists(
  'public', 'knowledge_chunks', 'anon_read_knowledge_chunks'
);
select public._security_revoke_anon_on_table_if_exists('public', 'knowledge_chunks');
select public._security_drop_policy_if_table_exists(
  'public', 'knowledge_query_logs', 'anon_read_knowledge_query_logs'
);
select public._security_revoke_anon_on_table_if_exists('public', 'knowledge_query_logs');
select public._security_drop_policy_if_table_exists(
  'public', 'knowledge_images', 'anon_read_knowledge_images'
);
select public._security_revoke_anon_on_table_if_exists('public', 'knowledge_images');
select public._security_drop_policy_if_table_exists(
  'public', 'knowledge_gaps', 'anon_read_knowledge_gaps'
);
select public._security_revoke_anon_on_table_if_exists('public', 'knowledge_gaps');
select public._security_drop_policy_if_table_exists(
  'public', 'knowledge_feedback', 'anon_read_knowledge_feedback'
);
select public._security_revoke_anon_on_table_if_exists('public', 'knowledge_feedback');

-- ── ניהול נציגים מפאנל מנהל (נציג מחובר + /admin) ─────────────────────────
-- הערה: כל נציג מחובר יכול לערוך agents — שלב עתידי: admin claim / API ייעודי
do $agents_admin$
begin
  if to_regclass('public.agents') is not null then
    grant insert, update on table public.agents to authenticated;
  end if;
end $agents_admin$;

select public._security_drop_policy_if_table_exists(
  'public', 'agents', 'authenticated_insert_agents'
);
select public._security_drop_policy_if_table_exists(
  'public', 'agents', 'authenticated_update_agents_admin'
);

do $agents_policies$
begin
  if to_regclass('public.agents') is not null then
    execute $sql$
      create policy authenticated_insert_agents on public.agents
        for insert
        to authenticated
        with check (true)
    $sql$;
    execute $sql$
      create policy authenticated_update_agents_admin on public.agents
        for update
        to authenticated
        using (true)
        with check (true)
    $sql$;
  end if;
end $agents_policies$;

drop function if exists public._security_policy_authenticated_all_if_table_exists(text, text, text);
drop function if exists public._security_grant_authenticated_if_table_exists(text, text);
drop function if exists public._security_anon_select_only_if_table_exists(text, text, text, text, text);
drop function if exists public._security_remove_anon_access_if_table_exists(text, text, text);
drop function if exists public._security_revoke_anon_on_table_if_exists(text, text);
drop function if exists public._security_drop_policy_if_table_exists(text, text, text);

commit;
