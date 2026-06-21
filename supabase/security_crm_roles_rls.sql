-- =============================================================================
-- CRM roles — helper functions for RLS (optional enforcement layer)
-- =============================================================================
-- Run after: crm_roles_schema.sql, security_phase9_agent_rls.sql
-- =============================================================================

begin;

create or replace function public.auth_agent_crm_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(a.crm_role, 'none')
  from public.agents a
  where a.auth_user_id = auth.uid()
    and a.active = true
    and a.deleted_at is null
  limit 1;
$$;

create or replace function public.auth_agent_crm_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_agent_is_admin()
    or public.auth_agent_crm_role() = 'manager';
$$;

grant execute on function public.auth_agent_crm_role() to authenticated;
grant execute on function public.auth_agent_crm_is_manager() to authenticated;

commit;
