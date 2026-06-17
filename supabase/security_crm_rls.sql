-- =============================================================================
-- CRM RLS — מדיניות גישה לטבלאות CRM
-- =============================================================================
-- הרץ **אחרי**:
--   1. crm_professional_schema.sql
--   2. security_phase9_agent_rls.sql (auth_agent_is_admin, agents.is_admin)
--
-- מוסיף:
--   • auth_agent_id() — uuid של הנציג המחובר
--   • auth_agent_in_department(p_dept_id) — חברות במחלקת CRM
--   • מדיניות RLS לכל טבלאות crm_*
--   • מחלקות ברירת מחדל (שירות, חשבוניות, מכירות, תמיכה)
-- =============================================================================

begin;

-- ── 1. פונקציות עזר ─────────────────────────────────────────────────────────
create or replace function public.auth_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
  from public.agents a
  where a.auth_user_id = auth.uid()
    and a.active = true
    and a.deleted_at is null
  limit 1;
$$;

create or replace function public.auth_agent_in_department(p_dept_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crm_department_members m
    where m.department_id = p_dept_id
      and m.agent_id = public.auth_agent_id()
  );
$$;

grant execute on function public.auth_agent_id() to authenticated;
grant execute on function public.auth_agent_in_department(text) to authenticated;

-- ── 2. עזר זמני (אם לא קיים מ-phase9) ───────────────────────────────────────
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

-- ── 3. crm_departments ────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_departments') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_departments');

    perform public._security_drop_policy_if_table_exists('public', 'crm_departments', 'crm_departments_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_departments', 'crm_departments_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_departments', 'crm_departments_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_departments', 'crm_departments_delete');

    create policy crm_departments_select on public.crm_departments
      for select to authenticated using (true);

    create policy crm_departments_insert on public.crm_departments
      for insert to authenticated with check (public.auth_agent_is_admin());

    create policy crm_departments_update on public.crm_departments
      for update to authenticated
      using (public.auth_agent_is_admin())
      with check (public.auth_agent_is_admin());

    create policy crm_departments_delete on public.crm_departments
      for delete to authenticated using (public.auth_agent_is_admin());
  end if;
end;
$$;

-- ── 4. crm_department_members ─────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_department_members') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_department_members');

    perform public._security_drop_policy_if_table_exists('public', 'crm_department_members', 'crm_department_members_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_department_members', 'crm_department_members_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_department_members', 'crm_department_members_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_department_members', 'crm_department_members_delete');

    create policy crm_department_members_select on public.crm_department_members
      for select to authenticated using (true);

    create policy crm_department_members_insert on public.crm_department_members
      for insert to authenticated with check (public.auth_agent_is_admin());

    create policy crm_department_members_update on public.crm_department_members
      for update to authenticated
      using (public.auth_agent_is_admin())
      with check (public.auth_agent_is_admin());

    create policy crm_department_members_delete on public.crm_department_members
      for delete to authenticated using (public.auth_agent_is_admin());
  end if;
end;
$$;

-- ── 5. crm_customers ─────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_customers') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_customers');

    perform public._security_drop_policy_if_table_exists('public', 'crm_customers', 'crm_customers_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customers', 'crm_customers_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customers', 'crm_customers_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_customers', 'crm_customers_delete');

    create policy crm_customers_select on public.crm_customers
      for select to authenticated using (true);

    create policy crm_customers_insert on public.crm_customers
      for insert to authenticated with check (true);

    create policy crm_customers_update on public.crm_customers
      for update to authenticated using (true) with check (true);

    create policy crm_customers_delete on public.crm_customers
      for delete to authenticated using (true);
  end if;
end;
$$;

-- ── 6. crm_referrals ─────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_referrals') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_referrals');

    perform public._security_drop_policy_if_table_exists('public', 'crm_referrals', 'crm_referrals_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_referrals', 'crm_referrals_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_referrals', 'crm_referrals_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_referrals', 'crm_referrals_delete');

    create policy crm_referrals_select on public.crm_referrals
      for select to authenticated using (true);

    create policy crm_referrals_insert on public.crm_referrals
      for insert to authenticated with check (true);

    create policy crm_referrals_update on public.crm_referrals
      for update to authenticated
      using (
        assigned_agent_id = public.auth_agent_id()
        or (
          assigned_to_type = 'department'
          and public.auth_agent_in_department(assigned_department_id)
        )
        or original_agent_id = public.auth_agent_id()
        or created_by_agent_id = public.auth_agent_id()
        or public.auth_agent_is_admin()
      )
      with check (
        assigned_agent_id = public.auth_agent_id()
        or (
          assigned_to_type = 'department'
          and public.auth_agent_in_department(assigned_department_id)
        )
        or original_agent_id = public.auth_agent_id()
        or created_by_agent_id = public.auth_agent_id()
        or public.auth_agent_is_admin()
      );

    create policy crm_referrals_delete on public.crm_referrals
      for delete to authenticated using (public.auth_agent_is_admin());
  end if;
end;
$$;

-- ── 7. crm_call_logs ──────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_call_logs') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_call_logs');

    perform public._security_drop_policy_if_table_exists('public', 'crm_call_logs', 'crm_call_logs_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_call_logs', 'crm_call_logs_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_call_logs', 'crm_call_logs_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_call_logs', 'crm_call_logs_delete');

    create policy crm_call_logs_select on public.crm_call_logs
      for select to authenticated using (true);

    create policy crm_call_logs_insert on public.crm_call_logs
      for insert to authenticated with check (true);

    create policy crm_call_logs_update on public.crm_call_logs
      for update to authenticated using (true) with check (true);

    create policy crm_call_logs_delete on public.crm_call_logs
      for delete to authenticated using (true);
  end if;
end;
$$;

-- ── 8. crm_email_logs ─────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_email_logs') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_email_logs');

    perform public._security_drop_policy_if_table_exists('public', 'crm_email_logs', 'crm_email_logs_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_email_logs', 'crm_email_logs_insert');
    perform public._security_drop_policy_if_table_exists('public', 'crm_email_logs', 'crm_email_logs_update');
    perform public._security_drop_policy_if_table_exists('public', 'crm_email_logs', 'crm_email_logs_delete');

    create policy crm_email_logs_select on public.crm_email_logs
      for select to authenticated using (true);

    create policy crm_email_logs_insert on public.crm_email_logs
      for insert to authenticated with check (true);

    create policy crm_email_logs_update on public.crm_email_logs
      for update to authenticated using (true) with check (true);

    create policy crm_email_logs_delete on public.crm_email_logs
      for delete to authenticated using (true);
  end if;
end;
$$;

-- ── 9. crm_referral_events ────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.crm_referral_events') is not null then
    perform public._security_grant_authenticated_if_table_exists('public', 'crm_referral_events');

    perform public._security_drop_policy_if_table_exists('public', 'crm_referral_events', 'crm_referral_events_select');
    perform public._security_drop_policy_if_table_exists('public', 'crm_referral_events', 'crm_referral_events_insert');

    create policy crm_referral_events_select on public.crm_referral_events
      for select to authenticated using (true);

    create policy crm_referral_events_insert on public.crm_referral_events
      for insert to authenticated with check (true);
  end if;
end;
$$;

-- ── 10. מחלקות ברירת מחדל ────────────────────────────────────────────────────
insert into public.crm_departments (id, name, sort_order) values
  ('service', 'שירות', 1),
  ('billing', 'חשבוניות', 2),
  ('sales', 'מכירות', 3),
  ('support', 'תמיכה', 4)
on conflict (id) do nothing;

commit;
