-- מדדי נציגים — העלאת Excel מממשק מנהל
-- הרצה חד-פעמית ב-Supabase SQL Editor

create table if not exists agent_metrics_uploads (
  id uuid primary key default gen_random_uuid(),
  period_label text not null default '',
  file_name text,
  column_headers jsonb not null default '[]'::jsonb,
  uploaded_at timestamptz not null default now()
);

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
create policy anon_all_agent_metrics_uploads on agent_metrics_uploads
  for all using (true) with check (true);

drop policy if exists anon_all_agent_metrics_rows on agent_metrics_rows;
create policy anon_all_agent_metrics_rows on agent_metrics_rows
  for all using (true) with check (true);
