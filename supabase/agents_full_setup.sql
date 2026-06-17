-- =============================================================================
-- agents — יצירה + שדרוג (idempotent)
-- =============================================================================
-- הרץ ב-Supabase → SQL Editor:
--   • פרויקט ריק / שגיאה "relation agents does not exist" — הדבק והרץ את כל הקובץ
--   • פרויקט עם schema.sql בלבד — בטוח להרצה חוזרת (מוסיף עמודות חסרות)
--
-- אימות: Supabase Auth — security_phase1_auth.sql (לא password_plain)
-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)
--
-- לא כולל טבלאות break/shift — לזה השתמשו ב-RUN_IN_SUPABASE.sql או schema.sql
-- =============================================================================

create extension if not exists "pgcrypto";

-- ── 1. טבלה (אם לא קיימת) ───────────────────────────────────────────────────
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  email text,
  display_name text not null,
  auth_user_id uuid unique,
  active boolean not null default true,
  blocked boolean not null default false,
  needs_password_setup boolean not null default true,
  deleted_at timestamptz,
  is_admin boolean not null default false,
  modules jsonb not null default '["breaks","shifts","training","metrics","remote_support","customer_chat","internal_chat","crm","knowledge"]'::jsonb,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 2. שדרוג טבלה קיימת ─────────────────────────────────────────────────────
alter table agents add column if not exists blocked boolean not null default false;
alter table agents add column if not exists deleted_at timestamptz;
alter table agents add column if not exists needs_password_setup boolean not null default true;
alter table agents add column if not exists auth_user_id uuid;
alter table agents add column if not exists is_admin boolean not null default false;
alter table agents add column if not exists modules jsonb not null default '["breaks","shifts","training","metrics","remote_support","customer_chat","internal_chat","crm","knowledge"]'::jsonb;
alter table agents add column if not exists phone text;
alter table agents add column if not exists created_at timestamptz not null default now();
alter table agents add column if not exists updated_at timestamptz not null default now();

-- אימייל אופציונלי (שם בלבד / placeholder @pending.local)
alter table agents alter column email drop not null;

comment on column agents.phone is
  'מספר טלפון לשליחת SMS בשיבוץ — ניהול מעמוד נציגים';

-- ── 3. אינדקס אימייל ────────────────────────────────────────────────────────
drop index if exists idx_agents_email_lower;
create unique index if not exists idx_agents_email_lower
  on agents (lower(trim(email)))
  where email is not null and trim(email) <> '';

-- ── 4. RLS (מדיניות — בשלבי security_phase*) ─────────────────────────────────
alter table agents enable row level security;

drop policy if exists "anon_read_active_agents" on agents;
drop policy if exists "anon_manage_agents" on agents;

-- ── 5. updated_at ─────────────────────────────────────────────────────────────
create or replace function agents_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agents_updated_at on agents;
create trigger trg_agents_updated_at
before update on agents
for each row
execute function agents_set_updated_at();
