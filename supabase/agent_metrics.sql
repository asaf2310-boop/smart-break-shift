-- מדדי נציגים — העלאת Excel מממשק מנהל
-- הרצה חד-פעמית ב-Supabase SQL Editor

create table if not exists agent_metrics_uploads (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'phone',
  period_label text not null default '',
  file_name text,
  column_headers jsonb not null default '[]'::jsonb,
  team_summary jsonb,
  uploaded_at timestamptz not null default now()
);

alter table agent_metrics_uploads add column if not exists team_summary jsonb;
alter table agent_metrics_uploads add column if not exists channel text not null default 'phone';

create index if not exists idx_agent_metrics_uploads_channel_uploaded
  on agent_metrics_uploads(channel, uploaded_at desc);

create table if not exists agent_metrics_rows (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references agent_metrics_uploads(id) on delete cascade,
  agent_name text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_metrics_rows_upload_id
  on agent_metrics_rows(upload_id);

create index if not exists idx_agent_metrics_rows_agent_name
  on agent_metrics_rows(agent_name);

create index if not exists idx_agent_metrics_uploads_uploaded_at
  on agent_metrics_uploads(uploaded_at desc);

alter table agent_metrics_uploads enable row level security;
alter table agent_metrics_rows enable row level security;

drop policy if exists anon_all_agent_metrics_uploads on agent_metrics_uploads;
drop policy if exists anon_all_agent_metrics_rows on agent_metrics_rows;

-- הגדרות ניקוד פעולות (בונוסים)
create table if not exists agent_metrics_settings (
  id text primary key default 'default',
  point_values jsonb not null default '{"phoneCall":1,"whatsappCall":0.5,"email":0.75,"ticket":0.75}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table agent_metrics_settings enable row level security;

drop policy if exists anon_all_agent_metrics_settings on agent_metrics_settings;

-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)
