-- =============================================================================
-- שלב 14 — הקשחת השתלטות מרחוק (קישור אורח, WebRTC join, fingerprint)
-- =============================================================================
-- הרץ **אחרי** security_phase12_audit_log.sql (+ deploy קוד phase 14)
--
-- מה זה עושה:
--   • guest_link_redemptions — שימוש חד-פעמי וקישור fingerprint בין instances
--   • ניקוי אוטומטי של רשומות שפג תוקפן (pg_cron אופציונלי — ראו הערה למטה)
--
-- גיבוי לפני הרצה: Supabase → Database → Backups
-- =============================================================================

begin;

create table if not exists public.guest_link_redemptions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  session_id text not null,
  client_fingerprint text not null,
  redeemed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_guest_link_redemptions_session
  on public.guest_link_redemptions (session_id);

create index if not exists idx_guest_link_redemptions_expires
  on public.guest_link_redemptions (expires_at);

alter table public.guest_link_redemptions enable row level security;

revoke all on table public.guest_link_redemptions from anon, authenticated;

-- אופציונלי (pg_cron): מחיקת רשומות שפג תוקפן — הרץ ידנית או דרך cron:
-- delete from public.guest_link_redemptions where expires_at < now();

commit;
