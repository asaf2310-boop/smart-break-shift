-- הרץ ב-Supabase → SQL Editor (פרויקטים קיימים)
create table if not exists constraints_week_settings (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  submission_override_open boolean default false,
  deadline_extended_until timestamptz,
  created_at timestamptz default now()
);

alter table constraints_week_settings enable row level security;

drop policy if exists "anon_all_constraints_week_settings" on constraints_week_settings;

-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)

-- אופציונלי — עדכון מיידי בין אדמין לנציגים (דלג אם כבר ב-publication)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'constraints_week_settings'
  ) then
    alter publication supabase_realtime add table constraints_week_settings;
  end if;
end $$;
