-- =============================================================================
-- שלב 9 — RLS לפי נציג (auth.uid → agents) + is_admin
-- =============================================================================
-- הרץ **אחרי**:
--   1. security_phase0a_immediate.sql
--   2. security_phase1_auth.sql
--   3. security_phase2_authenticated_data.sql
--   4. security_phase3_revoke_anon_write.sql
--   5. security_phase4_guest_signed_tokens.sql (+ deploy)
--   6. security_phase5_storage_hardening.sql (+ deploy)
--   7. security_phase6_file_allowlist.sql (+ deploy)
--
-- מה זה עושה:
--   • מוסיף agents.is_admin לגישת מנהל
--   • פונקציות עזר auth_agent_* (SECURITY DEFINER)
--   • מחליף מדיניות authenticated_all_* (using true) במדיניות לפי נציג/מנהל
--
-- מה זה **לא** עושה:
--   • לא מריץ security_phase0b_lockdown.sql
--   • לא משנה storage policies (שלב 5)
--   • צ'אט אורח ב-support_session_messages — INSERT עם sender_type=guest דרך
--     authenticated בלבד; אורח anon בוטל בשלב 3 — עתיד: API ייעודי
--
-- אחרי הרצה — הגדר מנהלים (דוגמה):
--   update public.agents set is_admin = true
--     where lower(trim(email)) = 'admin@hyp.co.il';
--
-- אימות ידני (מומלץ):
--   • נציג רגיל: קורא לוח צוות, מוחק רק break_registrations שלו
--   • מנהל (is_admin): יכול INSERT/UPDATE shift_registrations
--   • פאנל נציגים: רק is_admin יוצר/מעדכן נציגים אחרים
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

-- ── 1. סכמה: is_admin ───────────────────────────────────────────────────────
alter table public.agents add column if not exists is_admin boolean not null default false;

create index if not exists idx_agents_is_admin on public.agents(is_admin) where is_admin = true;

-- ── 2. פונקציות עזר (קבועות — לא למחוק בסוף) ───────────────────────────────
create or replace function public.auth_agent_display_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.display_name
  from public.agents a
  where a.auth_user_id = auth.uid()
    and a.active = true
    and a.deleted_at is null
  limit 1;
$$;

create or replace function public.auth_agent_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select a.is_admin
      from public.agents a
      where a.auth_user_id = auth.uid()
        and a.active = true
        and a.deleted_at is null
      limit 1
    ),
    false
  );
$$;

create or replace function public.auth_agent_owns_name(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_agent_display_name() is not null
    and trim(public.auth_agent_display_name()) = trim(p_name);
$$;

create or replace function public.auth_owns_support_session(p_session_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_sessions s
    where s.id = p_session_id
      and public.auth_agent_owns_name(s.agent_name)
  );
$$;

grant execute on function public.auth_agent_display_name() to authenticated;
grant execute on function public.auth_agent_is_admin() to authenticated;
grant execute on function public.auth_agent_owns_name(text) to authenticated;
grant execute on function public.auth_owns_support_session(text) to authenticated;

-- ── 3. עזר זמני ל-RLS (נמחק בסוף) ───────────────────────────────────────────
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

create or replace function public._security_drop_phase2_all_policy(
  p_table text
)
returns void
language plpgsql
as $$
begin
  perform public._security_drop_policy_if_table_exists(
    'public', p_table, 'authenticated_all_' || p_table
  );
end;
$$;

-- Pattern A — לוח צוות: SELECT לכולם, mutate לשורות שלי (DELETE גם מנהל)
create or replace function public._security_agent_rls_pattern_a(
  p_table text,
  p_name_column text default 'agent_name'
)
returns void
language plpgsql
as $$
declare
  qualified text := format('public.%I', p_table);
  own_expr text := format('public.auth_agent_owns_name(%I)', p_name_column);
begin
  if to_regclass(qualified) is null then
    return;
  end if;

  perform public._security_drop_phase2_all_policy(p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_select_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_insert_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_update_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_delete_' || p_table);

  execute format(
    'create policy authenticated_select_%I on %s for select to authenticated using (true)',
    p_table, qualified
  );
  execute format(
    'create policy authenticated_insert_%I on %s for insert to authenticated with check (%s)',
    p_table, qualified, own_expr
  );
  execute format(
    'create policy authenticated_update_%I on %s for update to authenticated using (%s) with check (%s)',
    p_table, qualified, own_expr, own_expr
  );
  execute format(
    'create policy authenticated_delete_%I on %s for delete to authenticated using (%s or public.auth_agent_is_admin())',
    p_table, qualified, own_expr
  );
end;
$$;

-- Pattern B — לוח מפורסם: SELECT לכולם, mutate מנהל בלבד
create or replace function public._security_agent_rls_pattern_b(p_table text)
returns void
language plpgsql
as $$
declare
  qualified text := format('public.%I', p_table);
begin
  if to_regclass(qualified) is null then
    return;
  end if;

  perform public._security_drop_phase2_all_policy(p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_select_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_insert_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_update_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_delete_' || p_table);

  execute format(
    'create policy authenticated_select_%I on %s for select to authenticated using (true)',
    p_table, qualified
  );
  execute format(
    'create policy authenticated_insert_%I on %s for insert to authenticated with check (public.auth_agent_is_admin())',
    p_table, qualified
  );
  execute format(
    'create policy authenticated_update_%I on %s for update to authenticated using (public.auth_agent_is_admin()) with check (public.auth_agent_is_admin())',
    p_table, qualified
  );
  execute format(
    'create policy authenticated_delete_%I on %s for delete to authenticated using (public.auth_agent_is_admin())',
    p_table, qualified
  );
end;
$$;

-- Pattern E/F — קריאה משותפת, כתיבה מנהל
create or replace function public._security_agent_rls_pattern_admin_write(p_table text)
returns void
language plpgsql
as $$
begin
  perform public._security_agent_rls_pattern_b(p_table);
end;
$$;

-- Pattern C — צ'אט צוות
create or replace function public._security_agent_rls_chat_messages()
returns void
language plpgsql
as $$
declare
  qualified text := 'public.chat_messages';
begin
  if to_regclass(qualified) is null then
    return;
  end if;

  perform public._security_drop_phase2_all_policy('chat_messages');
  perform public._security_drop_policy_if_table_exists('public', 'chat_messages', 'authenticated_select_chat_messages');
  perform public._security_drop_policy_if_table_exists('public', 'chat_messages', 'authenticated_insert_chat_messages');
  perform public._security_drop_policy_if_table_exists('public', 'chat_messages', 'authenticated_update_chat_messages');
  perform public._security_drop_policy_if_table_exists('public', 'chat_messages', 'authenticated_delete_chat_messages');

  execute $sql$
    create policy authenticated_select_chat_messages on public.chat_messages
      for select to authenticated using (true)
  $sql$;
  execute $sql$
    create policy authenticated_insert_chat_messages on public.chat_messages
      for insert to authenticated
      with check (public.auth_agent_owns_name(sender_name))
  $sql$;
  execute $sql$
    create policy authenticated_update_chat_messages on public.chat_messages
      for update to authenticated
      using (public.auth_agent_owns_name(sender_name) or public.auth_agent_is_admin())
      with check (public.auth_agent_owns_name(sender_name) or public.auth_agent_is_admin())
  $sql$;
  execute $sql$
    create policy authenticated_delete_chat_messages on public.chat_messages
      for delete to authenticated
      using (public.auth_agent_owns_name(sender_name) or public.auth_agent_is_admin())
  $sql$;
end;
$$;

create or replace function public._security_agent_rls_chat_presence()
returns void
language plpgsql
as $$
begin
  if to_regclass('public.chat_presence') is null then
    return;
  end if;

  perform public._security_agent_rls_pattern_a('chat_presence', 'agent_name');
end;
$$;

create or replace function public._security_agent_rls_chat_settings()
returns void
language plpgsql
as $$
begin
  perform public._security_agent_rls_pattern_b('chat_settings');
end;
$$;

-- Pattern D — תמיכה מרחוק
create or replace function public._security_agent_rls_support_sessions()
returns void
language plpgsql
as $$
declare
  qualified text := 'public.support_sessions';
  access_expr text := 'public.auth_agent_owns_name(agent_name) or public.auth_agent_is_admin()';
begin
  if to_regclass(qualified) is null then
    return;
  end if;

  perform public._security_drop_phase2_all_policy('support_sessions');
  perform public._security_drop_policy_if_table_exists('public', 'support_sessions', 'authenticated_select_support_sessions');
  perform public._security_drop_policy_if_table_exists('public', 'support_sessions', 'authenticated_insert_support_sessions');
  perform public._security_drop_policy_if_table_exists('public', 'support_sessions', 'authenticated_update_support_sessions');
  perform public._security_drop_policy_if_table_exists('public', 'support_sessions', 'authenticated_delete_support_sessions');

  execute format(
    'create policy authenticated_select_support_sessions on %s for select to authenticated using (%s)',
    qualified, access_expr
  );
  execute format(
    'create policy authenticated_insert_support_sessions on %s for insert to authenticated with check (public.auth_agent_owns_name(agent_name))',
    qualified
  );
  execute format(
    'create policy authenticated_update_support_sessions on %s for update to authenticated using (%s) with check (%s)',
    qualified, access_expr, access_expr
  );
  execute format(
    'create policy authenticated_delete_support_sessions on %s for delete to authenticated using (%s)',
    qualified, access_expr
  );
end;
$$;

create or replace function public._security_agent_rls_support_child(p_table text)
returns void
language plpgsql
as $$
declare
  qualified text := format('public.%I', p_table);
  access_expr text := 'public.auth_owns_support_session(session_id) or public.auth_agent_is_admin()';
begin
  if to_regclass(qualified) is null then
    return;
  end if;

  perform public._security_drop_phase2_all_policy(p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_select_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_insert_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_update_' || p_table);
  perform public._security_drop_policy_if_table_exists('public', p_table, 'authenticated_delete_' || p_table);

  execute format(
    'create policy authenticated_select_%I on %s for select to authenticated using (%s)',
    p_table, qualified, access_expr
  );
  execute format(
    'create policy authenticated_update_%I on %s for update to authenticated using (%s) with check (%s)',
    p_table, qualified, access_expr, access_expr
  );
  execute format(
    'create policy authenticated_delete_%I on %s for delete to authenticated using (%s)',
    p_table, qualified, access_expr
  );
end;
$$;

create or replace function public._security_agent_rls_support_session_messages()
returns void
language plpgsql
as $$
declare
  qualified text := 'public.support_session_messages';
  access_expr text := 'public.auth_owns_support_session(session_id) or public.auth_agent_is_admin()';
  insert_expr text := $ins$
    public.auth_owns_support_session(session_id)
    or public.auth_agent_is_admin()
    or (
      sender_type = 'guest'
      and exists (
        select 1
        from public.support_sessions s
        where s.id = session_id
          and s.status = 'active'
      )
    )
  $ins$;
begin
  if to_regclass(qualified) is null then
    return;
  end if;

  perform public._security_drop_phase2_all_policy('support_session_messages');
  perform public._security_drop_policy_if_table_exists('public', 'support_session_messages', 'authenticated_select_support_session_messages');
  perform public._security_drop_policy_if_table_exists('public', 'support_session_messages', 'authenticated_insert_support_session_messages');
  perform public._security_drop_policy_if_table_exists('public', 'support_session_messages', 'authenticated_update_support_session_messages');
  perform public._security_drop_policy_if_table_exists('public', 'support_session_messages', 'authenticated_delete_support_session_messages');

  execute format(
    'create policy authenticated_select_support_session_messages on %s for select to authenticated using (%s)',
    qualified, access_expr
  );
  execute format(
    'create policy authenticated_insert_support_session_messages on %s for insert to authenticated with check (%s)',
    qualified, insert_expr
  );
  execute format(
    'create policy authenticated_update_support_session_messages on %s for update to authenticated using (%s) with check (%s)',
    qualified, access_expr, access_expr
  );
  execute format(
    'create policy authenticated_delete_support_session_messages on %s for delete to authenticated using (%s)',
    qualified, access_expr
  );
end;
$$;

-- Pattern G — agents (שומר SELECT משלב 1)
create or replace function public._security_agent_rls_agents()
returns void
language plpgsql
as $$
begin
  if to_regclass('public.agents') is null then
    return;
  end if;

  grant insert, update on table public.agents to authenticated;

  perform public._security_drop_policy_if_table_exists('public', 'agents', 'authenticated_insert_agents');
  perform public._security_drop_policy_if_table_exists('public', 'agents', 'authenticated_update_agents_admin');
  perform public._security_drop_policy_if_table_exists('public', 'agents', 'authenticated_update_own_agent');
  perform public._security_drop_policy_if_table_exists('public', 'agents', 'authenticated_update_agents');

  execute $sql$
    create policy authenticated_insert_agents on public.agents
      for insert to authenticated
      with check (public.auth_agent_is_admin())
  $sql$;

  execute $sql$
    create policy authenticated_update_agents on public.agents
      for update to authenticated
      using (auth_user_id = auth.uid() or public.auth_agent_is_admin())
      with check (
        public.auth_agent_is_admin()
        or auth_user_id = auth.uid()
      )
  $sql$;
end;
$$;

-- ── 4. החלת מדיניות ─────────────────────────────────────────────────────────

-- Pattern A — לוח צוות
select public._security_agent_rls_pattern_a('break_registrations');
select public._security_agent_rls_pattern_a('shift_unavailabilities');
select public._security_agent_rls_pattern_a('vacation_requests');
select public._security_agent_rls_pattern_a('constraint_confirmations');

-- Pattern B — לוח מפורסם
select public._security_agent_rls_pattern_b('shift_registrations');
select public._security_agent_rls_pattern_b('break_settings');
select public._security_agent_rls_pattern_b('constraints_week_settings');

-- Pattern C — צ'אט
select public._security_agent_rls_chat_messages();
select public._security_agent_rls_chat_presence();
select public._security_agent_rls_chat_settings();

-- Pattern D — תמיכה מרחוק
select public._security_agent_rls_support_sessions();
select public._security_agent_rls_support_session_messages();
select public._security_agent_rls_support_child('support_session_files');
select public._security_agent_rls_support_child('screen_recordings');

-- Pattern E — בסיס ידע
select public._security_agent_rls_pattern_admin_write('knowledge_documents');
select public._security_agent_rls_pattern_admin_write('knowledge_index');
select public._security_agent_rls_pattern_admin_write('knowledge_chunks');
select public._security_agent_rls_pattern_admin_write('knowledge_query_logs');
select public._security_agent_rls_pattern_admin_write('knowledge_images');
select public._security_agent_rls_pattern_admin_write('knowledge_gaps');
select public._security_agent_rls_pattern_admin_write('knowledge_feedback');

-- Pattern F — מדדים / הדרכה
select public._security_agent_rls_pattern_admin_write('agent_metrics_uploads');
select public._security_agent_rls_pattern_admin_write('agent_metrics_rows');
select public._security_agent_rls_pattern_admin_write('agent_metrics_settings');
select public._security_agent_rls_pattern_admin_write('training_schedule_settings');
select public._security_agent_rls_pattern_admin_write('training_presentation_meta');

-- Pattern G — agents
select public._security_agent_rls_agents();

-- ── 5. ניקוי פונקציות זמניות ────────────────────────────────────────────────
drop function if exists public._security_agent_rls_agents();
drop function if exists public._security_agent_rls_pattern_admin_write(text);
drop function if exists public._security_agent_rls_support_session_messages();
drop function if exists public._security_agent_rls_support_child(text);
drop function if exists public._security_agent_rls_support_sessions();
drop function if exists public._security_agent_rls_chat_settings();
drop function if exists public._security_agent_rls_chat_presence();
drop function if exists public._security_agent_rls_chat_messages();
drop function if exists public._security_agent_rls_pattern_b(text);
drop function if exists public._security_agent_rls_pattern_a(text, text);
drop function if exists public._security_drop_phase2_all_policy(text);
drop function if exists public._security_drop_policy_if_table_exists(text, text, text);

commit;
