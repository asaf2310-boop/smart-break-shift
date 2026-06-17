-- =============================================================================
-- שלב 6 — Allowlist לסוגי קבצים (support-files)
-- =============================================================================
-- הרץ **אחרי**:
--   1. security_phase5_storage_hardening.sql
--   2. Deploy קוד עם validateSupportFileType (קליינט + שרת)
--
-- מה זה עושה:
--   • מגביל את bucket support-files ל-MIME types מותרים ב-Supabase Storage
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

update storage.buckets
set allowed_mime_types = array[
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
where id = 'support-files';

commit;
