-- =============================================================================
-- קבצים משותפים בסשן תמיכה — Storage bucket `support-files` + מטא-דאטה
-- =============================================================================
-- הרצה ב-Supabase → SQL Editor (בטוח להרצה חוזרת).
-- דורש: support_sessions (supabase/support_sessions.sql) כבר קיים.
--
-- נתיב ב-Storage: {session_id}/ss_file_{id}.{ext}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-files',
  'support-files',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists support_session_files (
  id text primary key,
  session_id text not null references support_sessions(id) on delete cascade,
  storage_path text not null,
  original_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint,
  uploaded_by text not null check (uploaded_by in ('agent', 'guest')),
  uploader_label text not null default '',
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'ready', 'failed')),
  upload_error text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_session_files_session_id
  on support_session_files(session_id);

create index if not exists idx_support_session_files_created_at
  on support_session_files(created_at desc);

alter table support_session_files enable row level security;

drop policy if exists "anon_all_support_session_files" on support_session_files;

-- מדיניות RLS: security_phase0a → … → security_phase9 (ראה RUN_IN_SUPABASE.sql)
-- מדיניות Storage: security_phase5_storage_hardening.sql (לא anon policies ב-bootstrap)

drop policy if exists "support_files_storage_select" on storage.objects;
drop policy if exists "support_files_storage_insert" on storage.objects;
drop policy if exists "support_files_storage_update" on storage.objects;
drop policy if exists "support_files_storage_delete" on storage.objects;

create or replace function support_session_files_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_session_files_updated_at on support_session_files;
create trigger trg_support_session_files_updated_at
before update on support_session_files
for each row
execute function support_session_files_set_updated_at();
