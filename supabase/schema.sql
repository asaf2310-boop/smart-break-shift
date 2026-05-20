-- הרץ ב-Supabase → SQL Editor (פעם אחת)

create extension if not exists "pgcrypto";

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

create index if not exists idx_break_reg_date on break_registrations(date);
create index if not exists idx_shift_reg_date on shift_registrations(date);
create index if not exists idx_shift_unavail_date on shift_unavailabilities(date);
create index if not exists idx_vacation_date on vacation_requests(date);
create index if not exists idx_chat_messages_created_at on chat_messages(created_at);
create index if not exists idx_chat_messages_recipient on chat_messages(recipient_name);
create index if not exists idx_chat_presence_last_seen on chat_presence(last_seen_at);

alter table break_registrations enable row level security;
alter table break_settings enable row level security;
alter table shift_registrations enable row level security;
alter table shift_unavailabilities enable row level security;
alter table vacation_requests enable row level security;
alter table constraint_confirmations enable row level security;
alter table chat_messages enable row level security;
alter table chat_presence enable row level security;

-- מדיניות פתוחה לצוות פנימי (אפשר להחמיר later עם Supabase Auth)
drop policy if exists "anon_all_break_registrations" on break_registrations;
drop policy if exists "anon_all_break_settings" on break_settings;
drop policy if exists "anon_all_shift_registrations" on shift_registrations;
drop policy if exists "anon_all_shift_unavailabilities" on shift_unavailabilities;
drop policy if exists "anon_all_vacation_requests" on vacation_requests;
drop policy if exists "anon_all_constraint_confirmations" on constraint_confirmations;
drop policy if exists "anon_all_chat_messages" on chat_messages;
drop policy if exists "anon_all_chat_presence" on chat_presence;

create policy "anon_all_break_registrations" on break_registrations for all using (true) with check (true);
create policy "anon_all_break_settings" on break_settings for all using (true) with check (true);
create policy "anon_all_shift_registrations" on shift_registrations for all using (true) with check (true);
create policy "anon_all_shift_unavailabilities" on shift_unavailabilities for all using (true) with check (true);
create policy "anon_all_vacation_requests" on vacation_requests for all using (true) with check (true);
create policy "anon_all_constraint_confirmations" on constraint_confirmations for all using (true) with check (true);
create policy "anon_all_chat_messages" on chat_messages for all using (true) with check (true);
create policy "anon_all_chat_presence" on chat_presence for all using (true) with check (true);

-- מניעת הרשמה למשבצת מלאה (גם כששני נציגים לוחצים בו-זמנית)
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
