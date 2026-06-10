-- =============================================================================
-- smart-break-shift — הרצה אחת ב-Supabase → SQL Editor
-- =============================================================================
-- סדר מומלץ: הדביקו את כל הקובץ והריצו פעם אחת (בטוח להרצה חוזרת).
--
-- חובה:
--   • טבלאות בסיס (הפסקות, משמרות, חופשות, הגדרות)
--   • טבלת agents + מדיניות RLS (התחברות נציגים)
--   • רק agents בפרויקט ריק: supabase/agents_full_setup.sql
--   • טריגרים למניעת משבצת מלאה וכפילות נציג
--
-- אופציונלי אך מומלץ:
--   • צ'אט (chat_messages, chat_presence) — כבר כלול כאן
--   • Realtime — עדכון מיידי בין מסכים (בסוף הקובץ)
--
-- לא ב-SQL — הגדרה ב-Dashboard:
--   Authentication → Providers → Email (הפעלה)
--   Authentication → SMTP (או Resend/SendGrid) — לאימייל איפוס סיסמה והזמנות
--   Project Settings → API — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY באפליקציה
--   Storage — bucket מצגות הדרכה: supabase/training_docs_storage.sql (או docs/TRAINING_STORAGE_SETUP.md)
-- =============================================================================

-- ── 1. הרחבות ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── 2. טבלאות ליבה ───────────────────────────────────────────────────────────
create table if not exists break_registrations (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  break_type text not null check (break_type in ('lunch', 'short')),
  time_slot text not null,
  date date not null,
  created_at timestamptz default now()
);

create table if not exists break_settings (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  lunch_max_per_slot int default 1,
  short_max_per_slot int default 1,
  show_shortage_notice boolean default false,
  shortage_notice_text text,
  registration_override_open boolean default false,
  created_at timestamptz default now()
);

create table if not exists shift_registrations (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  shift_type text not null check (shift_type in ('morning', 'evening')),
  date date not null,
  created_at timestamptz default now()
);

create table if not exists shift_unavailabilities (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  date date not null,
  shift_type text not null check (shift_type in ('morning', 'evening')),
  reason text not null check (reason in ('unavailable', 'vacation')),
  note text,
  created_at timestamptz default now()
);

create table if not exists vacation_requests (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create table if not exists constraint_confirmations (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  week_start date not null,
  confirmed_at timestamptz not null,
  created_at timestamptz default now(),
  unique (agent_name, week_start)
);

create table if not exists constraints_week_settings (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  submission_override_open boolean default false,
  deadline_extended_until timestamptz,
  created_at timestamptz default now()
);

-- צ'אט פנימי (אופציונלי — אם לא משתמשים בצ'אט, אין נזק)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null,
  recipient_name text,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists chat_presence (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null unique,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- מיתוג צ'אט (שורה יחידה — שם ותמונה לכל הנציגים)
create table if not exists chat_settings (
  id text primary key default 'default',
  display_name text,
  image_url text,
  updated_at timestamptz default now()
);

insert into chat_settings (id)
values ('default')
on conflict (id) do nothing;

-- נציגים + קישור ל-Supabase Auth
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
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

-- שדרוג טבלת agents קיימת
alter table agents add column if not exists blocked boolean not null default false;
alter table agents add column if not exists deleted_at timestamptz;
alter table agents add column if not exists needs_password_setup boolean not null default true;
alter table agents add column if not exists password_plain text;
alter table agents alter column email drop not null;

-- ── 3. אינדקסים ──────────────────────────────────────────────────────────────
create index if not exists idx_break_reg_date on break_registrations(date);
create index if not exists idx_shift_reg_date on shift_registrations(date);
create index if not exists idx_shift_unavail_date on shift_unavailabilities(date);
create index if not exists idx_vacation_date on vacation_requests(date);
create index if not exists idx_chat_messages_created_at on chat_messages(created_at);
create index if not exists idx_chat_messages_recipient on chat_messages(recipient_name);
create index if not exists idx_chat_presence_last_seen on chat_presence(last_seen_at);
drop index if exists idx_agents_email_lower;
create unique index if not exists idx_agents_email_lower
  on agents (lower(trim(email)))
  where email is not null and trim(email) <> '';

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
alter table break_registrations enable row level security;
alter table break_settings enable row level security;
alter table shift_registrations enable row level security;
alter table shift_unavailabilities enable row level security;
alter table vacation_requests enable row level security;
alter table constraint_confirmations enable row level security;
alter table constraints_week_settings enable row level security;
alter table chat_messages enable row level security;
alter table chat_presence enable row level security;
alter table chat_settings enable row level security;
alter table agents enable row level security;

-- מדיניות פתוחה לצוות פנימי (אפשר להחמיר later עם Supabase Auth)
drop policy if exists "anon_all_break_registrations" on break_registrations;
drop policy if exists "anon_all_break_settings" on break_settings;
drop policy if exists "anon_all_shift_registrations" on shift_registrations;
drop policy if exists "anon_all_shift_unavailabilities" on shift_unavailabilities;
drop policy if exists "anon_all_vacation_requests" on vacation_requests;
drop policy if exists "anon_all_constraint_confirmations" on constraint_confirmations;
drop policy if exists "anon_all_constraints_week_settings" on constraints_week_settings;
drop policy if exists "anon_all_chat_messages" on chat_messages;
drop policy if exists "anon_all_chat_presence" on chat_presence;
drop policy if exists "anon_all_chat_settings" on chat_settings;
drop policy if exists "anon_read_active_agents" on agents;
drop policy if exists "anon_manage_agents" on agents;

create policy "anon_all_break_registrations" on break_registrations for all using (true) with check (true);
create policy "anon_all_break_settings" on break_settings for all using (true) with check (true);
create policy "anon_all_shift_registrations" on shift_registrations for all using (true) with check (true);
create policy "anon_all_shift_unavailabilities" on shift_unavailabilities for all using (true) with check (true);
create policy "anon_all_vacation_requests" on vacation_requests for all using (true) with check (true);
create policy "anon_all_constraint_confirmations" on constraint_confirmations for all using (true) with check (true);
create policy "anon_all_constraints_week_settings" on constraints_week_settings for all using (true) with check (true);
create policy "anon_all_chat_messages" on chat_messages for all using (true) with check (true);
create policy "anon_all_chat_presence" on chat_presence for all using (true) with check (true);
create policy "anon_all_chat_settings" on chat_settings for all using (true) with check (true);

create policy "anon_read_active_agents" on agents
  for select
  using (active = true and deleted_at is null);

create policy "anon_manage_agents" on agents
  for all
  using (true)
  with check (true);

-- ── 5. טריגרים — agents.updated_at ───────────────────────────────────────────
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

-- ── 6. טריגרים — מניעת משבצת הפסקה מלאה ─────────────────────────────────────
create or replace function check_break_slot_capacity()
returns trigger
language plpgsql
as $$
declare
  max_slots int;
  current_count int;
begin
  select case new.break_type
    when 'lunch' then coalesce(bs.lunch_max_per_slot, 1)
    when 'short' then coalesce(bs.short_max_per_slot, 1)
    else 1
  end
  into max_slots
  from break_settings bs
  where bs.date = new.date;

  if max_slots is null then
    max_slots := 1;
  end if;

  select count(*)::int
  into current_count
  from break_registrations
  where date = new.date
    and time_slot = new.time_slot
    and break_type = new.break_type;

  if current_count >= max_slots then
    raise exception 'break_slot_full';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_break_registration_capacity on break_registrations;
create trigger trg_break_registration_capacity
before insert on break_registrations
for each row
execute function check_break_slot_capacity();

-- ── 7. טריגרים — מניעת הרשמת הפסקה כפולה לאותו נציג ─────────────────────────
-- מנקה כפילויות קיימות (שומר את הרשומה הראשונה לכל נציג/יום/סוג)
delete from break_registrations
where id in (
  select id
  from (
    select id,
           row_number() over (
             partition by agent_name, date, break_type
             order by created_at nulls last, id
           ) as rn
    from break_registrations
  ) ranked
  where rn > 1
);

create or replace function check_break_agent_not_duplicate()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from break_registrations
    where date = new.date
      and break_type = new.break_type
      and lower(trim(regexp_replace(agent_name, '\s+', ' ', 'g')))
        = lower(trim(regexp_replace(new.agent_name, '\s+', ' ', 'g')))
  ) then
    raise exception 'break_agent_already_registered';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_break_registration_unique_agent on break_registrations;
create trigger trg_break_registration_unique_agent
before insert on break_registrations
for each row
execute function check_break_agent_not_duplicate();

create unique index if not exists idx_break_reg_unique_agent_day_type
  on break_registrations (
    lower(trim(regexp_replace(agent_name, '\s+', ' ', 'g'))),
    date,
    break_type
  );

-- ── 8. Realtime (אופציונלי — בטוח להרצה חוזרת) ───────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'break_registrations',
    'break_settings',
    'shift_registrations',
    'shift_unavailabilities',
    'vacation_requests',
    'constraint_confirmations',
    'constraints_week_settings',
    'chat_messages',
    'chat_presence',
    'chat_settings'
  ];
begin
  foreach t in array tables
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception
      when duplicate_object then null;
      when others then
        if sqlerrm ilike '%already%' or sqlerrm ilike '%member of publication%' then
          null;
        else
          raise;
        end if;
    end;
  end loop;
end $$;
