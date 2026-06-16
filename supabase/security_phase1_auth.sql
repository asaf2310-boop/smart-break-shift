-- =============================================================================
-- שלב 1 — Supabase Auth לנציגים
-- =============================================================================
-- הרץ **אחרי**:
--   1. security_phase0a_immediate.sql
--   2. Deploy קוד + npm run migrate:agent-auth
--
-- לא להריץ security_phase0b_lockdown.sql בפרודקשן עדיין (שובר את שאר המודולים)
--
-- שלב 2 (אחרי deploy): security_phase2_authenticated_data.sql
--
-- לפני הרצה — Supabase Dashboard:
--   Authentication → Providers → Email: הפעל Email+Password
--   Authentication → URL Configuration → Redirect: .../reset-password
-- =============================================================================

do $phase1$
begin
  if to_regclass('public.agents') is null then
    raise exception 'טבלת public.agents לא קיימת — הרץ קודם supabase/agents_full_setup.sql';
  end if;
end $phase1$;

begin;

-- ── 1. הסרת עמודת סיסמה גלויה ─────────────────────────────────────────────
alter table public.agents drop column if exists password_plain;

-- ── 2. ניקוי מדיניות anon ישנה ──────────────────────────────────────────────
drop policy if exists "anon_read_active_agents" on public.agents;
drop policy if exists "anon_manage_agents" on public.agents;

-- ── 3. הרשאות anon מצומצמות ─────────────────────────────────────────────────
revoke all on table public.agents from anon;

grant select (
  id,
  email,
  display_name,
  auth_user_id,
  active,
  blocked,
  needs_password_setup,
  deleted_at,
  phone,
  modules,
  created_at,
  updated_at
) on table public.agents to anon;

drop policy if exists "anon_read_active_agents_login" on public.agents;
create policy "anon_read_active_agents_login" on public.agents
  for select
  to anon
  using (active = true and deleted_at is null);

-- ── 4. RLS לנציג מחובר (Supabase Auth) ─────────────────────────────────────
drop policy if exists "authenticated_read_own_agent" on public.agents;
drop policy if exists "authenticated_read_active_agents" on public.agents;
drop policy if exists "authenticated_update_own_agent" on public.agents;

create policy "authenticated_read_own_agent" on public.agents
  for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "authenticated_read_active_agents" on public.agents
  for select
  to authenticated
  using (active = true and deleted_at is null);

create policy "authenticated_update_own_agent" on public.agents
  for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

commit;
