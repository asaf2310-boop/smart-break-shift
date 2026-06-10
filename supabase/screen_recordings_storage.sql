-- =============================================================================
-- הקלטות שיתוף מסך — Storage bucket `screen-recordings` + טבלת מטא-דאטה
-- =============================================================================
-- הרצה ב-Supabase → SQL Editor (בטוח להרצה חוזרת).
-- דורש: support_sessions (supabase/support_sessions.sql) כבר קיים.
--
-- חלופה ב-Dashboard: Storage → New bucket → שם screen-recordings → Private
-- פירוט: docs/REMOTE_SUPPORT.md
-- =============================================================================

-- Bucket פרטי — נגינה דרך signed URL (createSignedUrl מהאפליקציה)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screen-recordings',
  'screen-recordings',
  false,
  209715200, -- 200 MB (הקלטות עד ~30 דקות)
  array['video/webm', 'video/x-matroska']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- מטא-דאטה לכל הקלטה (קובץ הוידאו ב-Storage)
create table if not exists screen_recordings (
  id text primary key,
  session_id text not null references support_sessions(id) on delete cascade,
  storage_path text not null,
  agent_name text not null default '',
  customer_email text default '',
  crm_customer_id text,
  started_at timestamptz,
  stopped_at timestamptz,
  duration_sec int not null default 0,
  file_size_bytes bigint,
  file_name text,
  has_audio boolean,
  mime_type text not null default 'video/webm',
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploading', 'ready', 'failed')),
  upload_error text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_screen_recordings_session_id
  on screen_recordings(session_id);

create index if not exists idx_screen_recordings_created_at
  on screen_recordings(created_at desc);

create index if not exists idx_screen_recordings_upload_status
  on screen_recordings(upload_status);

create index if not exists idx_screen_recordings_agent_name
  on screen_recordings(agent_name);

alter table screen_recordings enable row level security;

-- מטא-דאטה: אותו מודל אבטחה כ-support_sessions (anon key מהאפליקציה).
-- לחיזוק: החליפו ב-policies עם auth.uid() + טבלת agents כשכל הנציגים ב-Supabase Auth.
drop policy if exists "anon_all_screen_recordings" on screen_recordings;
create policy "anon_all_screen_recordings" on screen_recordings
  for all
  using (true)
  with check (true);

-- קריאה מ-Storage (signed URL / הורדה) — anon + authenticated
drop policy if exists "screen_recordings_storage_select" on storage.objects;
create policy "screen_recordings_storage_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'screen-recordings');

-- העלאה — נתיב: {session_id}/{recording_id}.webm
drop policy if exists "screen_recordings_storage_insert" on storage.objects;
create policy "screen_recordings_storage_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'screen-recordings'
  and (storage.foldername(name))[1] is not null
  and name ~ '^[^/]+/ss_rec_[^/]+\.webm$'
);

-- עדכון (upsert) — אותו נתיב
drop policy if exists "screen_recordings_storage_update" on storage.objects;
create policy "screen_recordings_storage_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'screen-recordings')
with check (
  bucket_id = 'screen-recordings'
  and name ~ '^[^/]+/ss_rec_[^/]+\.webm$'
);

-- מחיקה (אופציונלי — מנהל / ניקוי)
drop policy if exists "screen_recordings_storage_delete" on storage.objects;
create policy "screen_recordings_storage_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'screen-recordings');

create or replace function screen_recordings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_screen_recordings_updated_at on screen_recordings;
create trigger trg_screen_recordings_updated_at
before update on screen_recordings
for each row
execute function screen_recordings_set_updated_at();
