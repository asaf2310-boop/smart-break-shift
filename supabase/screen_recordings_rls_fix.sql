-- =============================================================================
-- תיקון RLS להעלאת הקלטות — הרצה חד-פעמית אם העלאה נכשלת עם "row-level security"
-- =============================================================================
-- סיבה: מזהה הקלטה בקוד הוא ss_rec + 8 תווים (makeId("ss_rec")), לא ss_rec_
-- =============================================================================

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
