-- צ'אט בסשן תמיכה (שיתוף מסך) — נציג ↔ לקוח
-- הרצה ב-Supabase → SQL Editor (בטוח להרצה חוזרת).
-- דורש: support_sessions (supabase/support_sessions.sql).

create table if not exists support_session_messages (
  id text primary key,
  session_id text not null references support_sessions(id) on delete cascade,
  sender_type text not null check (sender_type in ('agent', 'guest')),
  sender_label text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_session_messages_session_id
  on support_session_messages(session_id);

create index if not exists idx_support_session_messages_created_at
  on support_session_messages(created_at);

alter table support_session_messages enable row level security;

drop policy if exists "anon_all_support_session_messages" on support_session_messages;

-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)

do $$
begin
  alter publication supabase_realtime add table support_session_messages;
exception
  when duplicate_object then null;
end $$;
