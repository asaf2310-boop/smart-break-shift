-- ניהול נציגים + Supabase Auth
-- מומלץ: supabase/agents_full_setup.sql (יצירה + שדרוג — idempotent)
-- אחרת: הרץ ב-Supabase → SQL Editor אחרי schema.sql / RUN_IN_SUPABASE.sql
-- אימות: security_phase1_auth.sql — מדיניות RLS: security_phase0a → … → security_phase9

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  auth_user_id uuid unique,
  active boolean not null default true,
  blocked boolean not null default false,
  needs_password_setup boolean not null default true,
  deleted_at timestamptz,
  is_admin boolean not null default false,
  modules jsonb not null default '["breaks","shifts","training","metrics","remote_support","customer_chat","internal_chat","crm","knowledge","google_review"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- שדרוג טבלה קיימת
alter table agents add column if not exists blocked boolean not null default false;
alter table agents add column if not exists deleted_at timestamptz;
alter table agents add column if not exists is_admin boolean not null default false;
alter table agents add column if not exists modules jsonb not null default '["breaks","shifts","training","metrics","remote_support","customer_chat","internal_chat","crm","knowledge","google_review"]'::jsonb;
alter table agents add column if not exists phone text;
alter table agents alter column email drop not null;

comment on column agents.phone is 'מספר טלפון לשליחת SMS בשיבוץ — ניהול מעמוד נציגים';

drop index if exists idx_agents_email_lower;
create unique index if not exists idx_agents_email_lower
  on agents (lower(trim(email)))
  where email is not null and trim(email) <> '';

alter table agents enable row level security;

drop policy if exists "anon_read_active_agents" on agents;
drop policy if exists "anon_manage_agents" on agents;

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
