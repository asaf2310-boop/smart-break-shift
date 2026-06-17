-- =============================================================================
-- שלב 12 — יומן ביקורת (admin + פעולות רגישות)
-- =============================================================================
-- הרץ **אחרי** security_phase11_remote_support.sql (+ deploy קוד phase 12)
--
-- מה זה עושה:
--   • טבלת security_audit_log לפעולות מנהל ורגישות
--   • SELECT רק ל-is_admin; INSERT דרך service role מהשרת בלבד
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_agent_id uuid references public.agents(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_audit_log_created_at
  on public.security_audit_log (created_at desc);

create index if not exists idx_security_audit_log_actor
  on public.security_audit_log (actor_agent_id, created_at desc);

create index if not exists idx_security_audit_log_action
  on public.security_audit_log (action, created_at desc);

alter table public.security_audit_log enable row level security;

drop policy if exists security_audit_log_admin_select on public.security_audit_log;
create policy security_audit_log_admin_select on public.security_audit_log
  for select to authenticated
  using (public.auth_agent_is_admin());

revoke insert, update, delete on table public.security_audit_log from anon, authenticated;

commit;
