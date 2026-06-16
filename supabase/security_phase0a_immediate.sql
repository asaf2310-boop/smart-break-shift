-- =============================================================================
-- שלב 0א — הקשחה מיידית (בטוח יחסית לפרודקשן)
-- =============================================================================
-- איפה: Supabase Dashboard → SQL Editor → New query → הדבק והרץ
--
-- דורש: טבלת public.agents (הרץ agents_full_setup.sql אם חסרה)
--
-- מה זה עושה:
--   1. חוסם קריאה/כתיבה של סיסמאות גלויות (password_plain) מ-anon
--   2. מבטל מדיניות anon_manage_agents (כתיבה חופשית לטבלת נציגים)
--   3. מסיר ל-anon הרשאות update/delete ב-Storage (קבצים + הקלטות)
--
-- תופעות לוואי:
--   • כניסת נציג באימייל+סיסמה — דרך Supabase Auth (שלב 1), לא password_plain
--   • כניסה לפי שם בלבד (legacy) — ממשיכה לעבוד
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

do $phase0a$
begin
  if to_regclass('public.agents') is null then
    raise exception 'טבלת public.agents לא קיימת — הרץ קודם supabase/agents_full_setup.sql';
  end if;
end $phase0a$;

begin;

-- ── 1. נציגים: בלי סיסמה גלויה ל-anon ─────────────────────────────────────
drop policy if exists "anon_manage_agents" on public.agents;

revoke all on table public.agents from anon;

grant select (
  id,
  email,
  display_name,
  auth_user_id,
  active,
  blocked,
  needs_password_setup,
  deleted_at,
  phone,
  modules,
  created_at,
  updated_at
) on table public.agents to anon;

-- ── 2. Storage: בלי update/delete ל-anon (support-files) ────────────────────
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

-- ── 3. Storage: בלי update/delete ל-anon (screen-recordings) ───────────────
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

-- ── 4. Storage: בלי update/delete ל-anon (training-docs) ───────────────────
drop policy if exists "training_docs_anon_update" on storage.objects;
drop policy if exists "training_docs_anon_delete" on storage.objects;

commit;
