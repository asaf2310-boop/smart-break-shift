-- =============================================================================
-- CRM roles — per-agent CRM permission level
-- =============================================================================
-- Values: none | user | agent | manager
--   none    — no CRM access
--   user    — basic CRM (search / customer view)
--   agent   — full agent CRM dashboard
--   manager — admin CRM pages + reports (system is_admin also grants manager)
-- =============================================================================

begin;

alter table public.agents
  add column if not exists crm_role text not null default 'none';

alter table public.agents
  drop constraint if exists agents_crm_role_check;

alter table public.agents
  add constraint agents_crm_role_check
  check (crm_role in ('none', 'user', 'agent', 'manager'));

create index if not exists idx_agents_crm_role
  on public.agents (crm_role)
  where crm_role <> 'none';

comment on column public.agents.crm_role is
  'CRM permission level: none, user (basic), agent (dashboard), manager (admin CRM + reports).';

commit;
