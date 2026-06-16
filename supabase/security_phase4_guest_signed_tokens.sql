-- =============================================================================
-- שלב 4 — קישורי אורח חתומים (בלי גישת anon ל-support_sessions)
-- =============================================================================
-- הרץ **אחרי**:
--   1. security_phase3_revoke_anon_write.sql
--   2. Deploy קוד עם /api/guest-link + finalizeCloudGuestLink
--   3. הגדר GUEST_LINK_SECRET ב-Vercel (32+ תווים אקראיים, ללא VITE_)
--
-- מה זה עושה:
--   • מסיר ל-anon כל גישה ל-support_sessions
--   • אורח פותח קישור רק דרך /api/guest-link (resolve) עם טוקן חתום
--
-- הערה: קישורים ישנים (/j/ABC123 ללא חתימה) יפסיקו לעבוד — שלחו קישור חדש.
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

drop policy if exists "anon_read_support_sessions_guest" on public.support_sessions;
drop policy if exists "anon_all_support_sessions" on public.support_sessions;

revoke all on table public.support_sessions from anon;

commit;
