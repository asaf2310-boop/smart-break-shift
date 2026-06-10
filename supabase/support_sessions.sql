-- יומן סשני תמיכה (שיתוף מסך + RustDesk) — מטא-דאטה בלבד.
-- הרץ ב-Supabase → SQL Editor (פעם אחת).
-- מטא-דאטה סשן בלבד; קבצי וידאו ב-Supabase Storage — ראו screen_recordings_storage.sql.

create table if not exists support_sessions (
  id text primary key,
  session_type text not null check (session_type in ('screen_share', 'rustdesk')),
  agent_name text not null default '',
  customer_email text default '',
  crm_customer_id text,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null,
  ended_at timestamptz,
  consent_at timestamptz,
  recording_consent_at timestamptz,
  recording_active_at timestamptz,
  recording_count int not null default 0,
  rust_desk_id text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_sessions_created_at on support_sessions(created_at desc);
create index if not exists idx_support_sessions_agent_name on support_sessions(agent_name);
create index if not exists idx_support_sessions_customer_email on support_sessions(lower(customer_email));

alter table support_sessions enable row level security;

drop policy if exists "anon_all_support_sessions" on support_sessions;
create policy "anon_all_support_sessions" on support_sessions
  for all using (true) with check (true);
