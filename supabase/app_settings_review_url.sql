-- =============================================================================
-- הגדרות אפליקציה — קישור דירוג גוגל ל-SMS
-- =============================================================================
-- הרץ **אחרי** security_phase9_agent_rls.sql (auth_agent_is_admin)
--
-- מה זה עושה:
--   • טבלת app_settings (מפתח-ערך) עם google_review_sms_url
--   • SELECT לכל נציג מחובר; INSERT/UPDATE רק למנהל
--   • השרת כותב גם דרך service role (אחרי בדיקת מנהל ב-API)
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.agents(id) on delete set null
);

comment on table public.app_settings is 'הגדרות מערכת מפתח-ערך (למשל קישור דירוג גוגל ל-SMS)';

alter table public.app_settings enable row level security;

drop policy if exists app_settings_authenticated_select on public.app_settings;
create policy app_settings_authenticated_select on public.app_settings
  for select to authenticated
  using (true);

drop policy if exists app_settings_admin_insert on public.app_settings;
create policy app_settings_admin_insert on public.app_settings
  for insert to authenticated
  with check (public.auth_agent_is_admin());

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings
  for update to authenticated
  using (public.auth_agent_is_admin())
  with check (public.auth_agent_is_admin());

drop policy if exists app_settings_admin_delete on public.app_settings;
create policy app_settings_admin_delete on public.app_settings
  for delete to authenticated
  using (public.auth_agent_is_admin());

commit;
