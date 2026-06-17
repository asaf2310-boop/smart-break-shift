-- =============================================================================
-- שלב 5 — הקשחת Storage (העלאות דרך API + service role)
-- =============================================================================
-- הרץ **אחרי**:
--   1. security_phase4_guest_signed_tokens.sql
--   2. Deploy קוד עם פעולות storage ב-/api/agent-auth
--      (support_file_upload, support_file_signed_url, recording_upload)
--
-- מה זה עושה:
--   • מסיר ל-anon insert/select/update/delete על support-files, screen-recordings
--   • משאיר authenticated בלבד לעדכון/מחיקה (שלב 0א) — העלאה/קריאה דרך שרת
--   • training-docs: בלי insert ל-anon (העלאת PDF — נציג מחובר / עתידי API)
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

-- ── support-files: בלי anon ─────────────────────────────────────────────────
drop policy if exists "support_files_storage_select" on storage.objects;
drop policy if exists "support_files_storage_insert" on storage.objects;
drop policy if exists "support_files_storage_update" on storage.objects;
drop policy if exists "support_files_storage_delete" on storage.objects;

create policy "support_files_storage_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'support-files')
with check (bucket_id = 'support-files');

create policy "support_files_storage_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'support-files');

-- ── screen-recordings: בלי anon ───────────────────────────────────────────
drop policy if exists "screen_recordings_storage_select" on storage.objects;
drop policy if exists "screen_recordings_storage_insert" on storage.objects;
drop policy if exists "screen_recordings_storage_update" on storage.objects;
drop policy if exists "screen_recordings_storage_delete" on storage.objects;

create policy "screen_recordings_storage_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'screen-recordings')
with check (bucket_id = 'screen-recordings');

create policy "screen_recordings_storage_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'screen-recordings');

-- ── training-docs: קריאה ציבורית, בלי כתיבה ל-anon ────────────────────────
drop policy if exists "training_docs_anon_insert" on storage.objects;
drop policy if exists "training_docs_anon_update" on storage.objects;
drop policy if exists "training_docs_anon_delete" on storage.objects;

drop policy if exists "training_docs_public_read" on storage.objects;
create policy "training_docs_public_read"
on storage.objects
for select
to public
using (bucket_id = 'training-docs');

drop policy if exists "training_docs_authenticated_write" on storage.objects;
create policy "training_docs_authenticated_write"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'training-docs');

drop policy if exists "training_docs_authenticated_update" on storage.objects;
create policy "training_docs_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'training-docs')
with check (bucket_id = 'training-docs');

drop policy if exists "training_docs_authenticated_delete" on storage.objects;
create policy "training_docs_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'training-docs');

commit;
