-- הרץ ב-Supabase SQL Editor כדי להוסיף יכולת צ'אט פנימי

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

create index if not exists idx_chat_messages_created_at on chat_messages(created_at);
create index if not exists idx_chat_messages_recipient on chat_messages(recipient_name);
create index if not exists idx_chat_presence_last_seen on chat_presence(last_seen_at);

alter table chat_messages enable row level security;
alter table chat_presence enable row level security;

drop policy if exists "anon_all_chat_messages" on chat_messages;
drop policy if exists "anon_all_chat_presence" on chat_presence;

-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)

-- Realtime
alter publication supabase_realtime add table chat_messages;
alter publication supabase_realtime add table chat_presence;
