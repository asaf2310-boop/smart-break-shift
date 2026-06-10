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
create policy "anon_all_constraints_week_settings" on constraints_week_settings for all using (true) with check (true);

-- אופציונלי — עדכון מיידי בין אדמין לנציגים
alter publication supabase_realtime add table constraints_week_settings;
