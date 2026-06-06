-- שדרוג agents: סיסמה גלויה למנהל (idempotent — כולל יצירת טבלה אם חסרה)
-- זהה ל-agents_full_setup.sql (שם קובץ ישן לתאימות לאחור)
-- Supabase SQL Editor: הדבק והרץ את כל הקובץ

create extension if not exists "pgcrypto";

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  email text,
  display_name text not null,
  auth_user_id uuid unique,
  active boolean not null default true,
  blocked boolean not null default false,
  needs_password_setup boolean not null default true,
  deleted_at timestamptz,
  password_plain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agents add column if not exists blocked boolean not null default false;
alter table agents add column if not exists deleted_at timestamptz;
alter table agents add column if not exists needs_password_setup boolean not null default true;
alter table agents add column if not exists password_plain text;
alter table agents add column if not exists auth_user_id uuid;
alter table agents add column if not exists created_at timestamptz not null default now();
alter table agents add column if not exists updated_at timestamptz not null default now();

alter table agents alter column email drop not null;

comment on column agents.password_plain is
  'סיסמה בטקסט גלוי לתצוגת מנהל בלבד — החלף ב-hash + Auth לפני פרודקשן רגיש';

drop index if exists idx_agents_email_lower;
create unique index if not exists idx_agents_email_lower
  on agents (lower(trim(email)))
  where email is not null and trim(email) <> '';

alter table agents enable row level security;

drop policy if exists "anon_read_active_agents" on agents;
drop policy if exists "anon_manage_agents" on agents;

create policy "anon_read_active_agents" on agents
  for select
  using (active = true and deleted_at is null);

create policy "anon_manage_agents" on agents
  for all
  using (true)
  with check (true);

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
