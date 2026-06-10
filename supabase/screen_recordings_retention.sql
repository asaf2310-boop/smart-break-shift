-- =============================================================================
-- הקלטות שיתוף מסך — הגדרה + שמירה 7 ימים + מחיקה אוטומטית
-- =============================================================================
-- הרצה ב-Supabase → SQL Editor (בטוח להרצה חוזרת).
-- דורש: support_sessions (supabase/support_sessions.sql) — אם חסר, הריצו אותו קודם.
--
-- Extensions (Dashboard → Database → Extensions):
--   pg_cron, pg_net, supabase_vault (מומלץ)
--
-- ── הגדרת מפתחות (הריצו פעם אחת, החליפו בערכים שלכם) ─────────────────────
-- Project Settings → API:
--   Project URL  → purge_supabase_url
--   service_role → purge_service_role_key  (לא anon!)
--
-- select vault.create_secret('https://YOUR_REF.supabase.co', 'purge_supabase_url');
-- select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'purge_service_role_key');
--
-- חלופה (פחות מומלץ):
-- alter database postgres set app.settings.supabase_url = 'https://YOUR_REF.supabase.co';
-- alter database postgres set app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
-- =============================================================================

-- ── 0. תשתית (bucket + טבלה) ───────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'support_sessions'
  ) then
    raise exception 'טבלת support_sessions חסרה — הריצו קודם supabase/support_sessions.sql';
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'screen-recordings',
  'screen-recordings',
  false,
  209715200,
  array['video/webm', 'video/x-matroska']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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

alter table screen_recordings enable row level security;

drop policy if exists "anon_all_screen_recordings" on screen_recordings;
create policy "anon_all_screen_recordings" on screen_recordings
  for all
  using (true)
  with check (true);

drop policy if exists "screen_recordings_storage_select" on storage.objects;
create policy "screen_recordings_storage_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'screen-recordings');

drop policy if exists "screen_recordings_storage_insert" on storage.objects;
create policy "screen_recordings_storage_insert"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'screen-recordings'
  and (storage.foldername(name))[1] is not null
  and name ~ '^[^/]+/ss_rec[^/]+\.webm$'
);

drop policy if exists "screen_recordings_storage_update" on storage.objects;
create policy "screen_recordings_storage_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'screen-recordings')
with check (
  bucket_id = 'screen-recordings'
  and name ~ '^[^/]+/ss_rec[^/]+\.webm$'
);

drop policy if exists "screen_recordings_storage_delete" on storage.objects;
create policy "screen_recordings_storage_delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'screen-recordings');

-- ── 1. מדיניות שמירה 7 ימים ─────────────────────────────────────────────────

create extension if not exists pg_net with schema extensions;

create or replace function screen_recordings_retention_days()
returns int
language sql
immutable
as $$
  select 7;
$$;

create or replace function purge_screen_recordings_resolve_secrets()
returns table(project_url text, service_key text)
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_url text;
  v_key text;
begin
  if exists (
    select 1 from information_schema.schemata where schema_name = 'vault'
  ) then
    select decrypted_secret into v_url
    from vault.decrypted_secrets
    where name = 'purge_supabase_url'
    limit 1;

    select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'purge_service_role_key'
    limit 1;
  end if;

  if v_url is null or v_url = '' then
    v_url := nullif(current_setting('app.settings.supabase_url', true), '');
  end if;
  if v_key is null or v_key = '' then
    v_key := nullif(current_setting('app.settings.service_role_key', true), '');
  end if;

  if v_url is null or v_key is null then
    raise exception
      'חסרים URL ו-service_role — הגדירו vault.create_secret (purge_supabase_url, purge_service_role_key) או ALTER DATABASE';
  end if;

  project_url := v_url;
  service_key := v_key;
  return next;
end;
$$;

-- מחיקת קבצים דרך Storage API (לא DELETE ישיר מ-storage.objects)
create or replace function purge_screen_recordings_storage_batch(
  p_paths text[],
  p_project_url text,
  p_service_key text
)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  remove_url text;
  request_id bigint;
  response_row record;
  path_count int;
begin
  path_count := coalesce(array_length(p_paths, 1), 0);
  if path_count = 0 then
    return 0;
  end if;

  remove_url := rtrim(p_project_url, '/') || '/storage/v1/object/screen-recordings/remove';

  select net.http_post(
    url := remove_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', p_service_key,
      'Authorization', 'Bearer ' || p_service_key
    ),
    body := jsonb_build_object('prefixes', to_jsonb(p_paths))
  )
  into request_id;

  select *
  into response_row
  from net.http_collect_response(request_id, async := false);

  if coalesce(response_row.status_code, 0) < 200
     or coalesce(response_row.status_code, 0) >= 300 then
    raise exception
      'Storage API remove נכשל (status %): %',
      coalesce(response_row.status_code, 0),
      coalesce(response_row.error_msg, left(coalesce(response_row.body, ''), 500));
  end if;

  return path_count;
end;
$$;

create or replace function purge_expired_screen_recordings()
returns jsonb
language plpgsql
security definer
set search_path = public, storage, extensions
as $$
declare
  retention interval;
  storage_deleted int := 0;
  meta_deleted int := 0;
  project_url text;
  service_key text;
  batch_paths text[] := '{}';
  batch_ids text[] := '{}';
  rec record;
  batch_limit int := 100;
begin
  retention := (screen_recordings_retention_days() || ' days')::interval;

  select s.project_url, s.service_key
  into project_url, service_key
  from purge_screen_recordings_resolve_secrets() s;

  for rec in
    select id, storage_path
    from screen_recordings
    where coalesce(uploaded_at, created_at) < now() - retention
    order by coalesce(uploaded_at, created_at)
  loop
    batch_paths := array_append(batch_paths, rec.storage_path);
    batch_ids := array_append(batch_ids, rec.id);

    if array_length(batch_paths, 1) >= batch_limit then
      storage_deleted := storage_deleted + purge_screen_recordings_storage_batch(
        batch_paths, project_url, service_key
      );

      delete from screen_recordings
      where id = any(batch_ids);
      meta_deleted := meta_deleted + array_length(batch_ids, 1);

      batch_paths := '{}';
      batch_ids := '{}';
    end if;
  end loop;

  if coalesce(array_length(batch_paths, 1), 0) > 0 then
    storage_deleted := storage_deleted + purge_screen_recordings_storage_batch(
      batch_paths, project_url, service_key
    );

    delete from screen_recordings
    where id = any(batch_ids);
    meta_deleted := meta_deleted + array_length(batch_ids, 1);
  end if;

  return jsonb_build_object(
    'retention_days', screen_recordings_retention_days(),
    'storage_objects_deleted', storage_deleted,
    'metadata_rows_deleted', meta_deleted,
    'purged_at', now()
  );
end;
$$;

revoke all on function purge_screen_recordings_resolve_secrets() from public;
revoke all on function purge_screen_recordings_resolve_secrets() from anon, authenticated;
revoke all on function purge_screen_recordings_storage_batch(text[], text, text) from public;
revoke all on function purge_screen_recordings_storage_batch(text[], text, text) from anon, authenticated;
revoke all on function purge_expired_screen_recordings() from public;
revoke all on function purge_expired_screen_recordings() from anon, authenticated;

comment on function purge_expired_screen_recordings() is
  'מוחק הקלטות ישנות מ-7 ימים דרך Storage API + screen_recordings. מיועד ל-pg_cron.';

create index if not exists idx_screen_recordings_retention_purge
  on screen_recordings (coalesce(uploaded_at, created_at));

-- ── 2. pg_cron — ניקוי יומי ב-03:15 UTC ────────────────────────────────────
create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  if exists (
    select 1 from information_schema.schemata where schema_name = 'cron'
  ) then
    select jobid
    into existing_job_id
    from cron.job
    where jobname = 'purge-screen-recordings-daily'
    limit 1;

    if existing_job_id is not null then
      perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
      'purge-screen-recordings-daily',
      '15 3 * * *',
      'select public.purge_expired_screen_recordings()'
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron לא פעיל — הפעילו את ההרחבה ב-Dashboard והריצו שוב את החלק האחרון';
end $$;

-- בדיקה ידנית (אחרי הגדרת המפתחות):
-- select public.purge_expired_screen_recordings();
