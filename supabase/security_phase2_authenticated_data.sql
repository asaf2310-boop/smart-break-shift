-- =============================================================================
-- שלב 2 — גישת נתונים דרך Supabase Auth (authenticated)
-- =============================================================================
-- הרץ **אחרי**:
--   1. security_phase0a_immediate.sql
--   2. security_phase1_auth.sql
--   3. Deploy קוד עם dataClient שמשתמש ב-JWT של הנציג
--
-- מה זה עושה:
--   • מוסיף מדיניות RLS ל-role authenticated על טבלאות ליבה (כמו anon היום)
--   • מאפשר לנציג מחובר לעבוד עם JWT במקום מפתח anon גולמי
--
-- מה זה **לא** עושה (שלב 3 — security_phase3_revoke_anon_write.sql):
--   • לא מסיר עדיין כתיבה ל-anon (שלב 3 עושה זאת)
--   • לא מגביל לפי agent_name בשורה (דורש API או claims)
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

-- ── ליבה: הפסקות / משמרות / צ'אט ───────────────────────────────────────────
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'break_registrations', 'authenticated_all_break_registrations'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'break_settings', 'authenticated_all_break_settings'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'shift_registrations', 'authenticated_all_shift_registrations'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'shift_unavailabilities', 'authenticated_all_shift_unavailabilities'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'vacation_requests', 'authenticated_all_vacation_requests'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'constraint_confirmations', 'authenticated_all_constraint_confirmations'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'constraints_week_settings', 'authenticated_all_constraints_week_settings'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'chat_messages', 'authenticated_all_chat_messages'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'chat_presence', 'authenticated_all_chat_presence'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'chat_settings', 'authenticated_all_chat_settings'
);

-- ── תמיכה מרחוק ─────────────────────────────────────────────────────────────
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'support_sessions', 'authenticated_all_support_sessions'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'support_session_messages', 'authenticated_all_support_session_messages'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'support_session_files', 'authenticated_all_support_session_files'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'screen_recordings', 'authenticated_all_screen_recordings'
);

-- ── מדדים / הדרכה ───────────────────────────────────────────────────────────
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'agent_metrics_uploads', 'authenticated_all_agent_metrics_uploads'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'agent_metrics_rows', 'authenticated_all_agent_metrics_rows'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'agent_metrics_settings', 'authenticated_all_agent_metrics_settings'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'training_schedule_settings', 'authenticated_all_training_schedule_settings'
);
select public._security_policy_authenticated_all_if_table_exists(
  'public', 'training_presentation_meta', 'authenticated_all_training_presentation_meta'
);

drop function if exists public._security_policy_authenticated_all_if_table_exists(text, text, text);
drop function if exists public._security_grant_authenticated_if_table_exists(text, text);
drop function if exists public._security_drop_policy_if_table_exists(text, text, text);

commit;
