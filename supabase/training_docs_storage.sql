-- =============================================================================
-- מצגות הדרכה (PDF) — Storage bucket `training-docs`
-- =============================================================================
-- הרצה ב-Supabase → SQL Editor (בטוח להרצה חוזרת).
-- האפליקציה משתמשת ב-bucket זה כש-VITE_SUPABASE_URL מוגדר (ראו trainingPresentations.js).
--
-- חלופה ב-Dashboard: Storage → New bucket → שם training-docs → Public bucket ✓
-- פירוט מלא: docs/TRAINING_STORAGE_SETUP.md
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'training-docs',
  'training-docs',
  true,
  52428800, -- 50 MB
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- קריאה ציבורית (נציגים פותחים PDF דרך getPublicUrl)
drop policy if exists "training_docs_public_read" on storage.objects;
create policy "training_docs_public_read"
on storage.objects
for select
to public
using (bucket_id = 'training-docs');

-- העלאה / עדכון / מחיקה — anon (מפתח האפליקציה ב-build)
drop policy if exists "training_docs_anon_insert" on storage.objects;
create policy "training_docs_anon_insert"
on storage.objects
for insert
to anon
with check (bucket_id = 'training-docs');

drop policy if exists "training_docs_anon_update" on storage.objects;
create policy "training_docs_anon_update"
on storage.objects
for update
to anon
using (bucket_id = 'training-docs')
with check (bucket_id = 'training-docs');

drop policy if exists "training_docs_anon_delete" on storage.objects;
create policy "training_docs_anon_delete"
on storage.objects
for delete
to anon
using (bucket_id = 'training-docs');
