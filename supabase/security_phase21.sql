-- =============================================================================
-- שלב 21 — InfoSec (Upstash rate limits, SIP/PeerJS hardening)
-- =============================================================================
-- הרץ **אחרי** security_phase20.sql (+ deploy קוד phase 21)
--
-- Phase 21 ממוקד בקוד (Upstash Redis אופציונלי, ניקוי SIP בטאב מוסתר,
-- הגנת localStorage דמו, כותרות COOP/CORP) — אין מדיניות RLS חדשה.
-- =============================================================================

begin;

comment on table public.security_audit_log is
  'יומן ביקורת — פעולות מנהל ורגישות (phase 12+). phase 21: Upstash rate limits, SIP tab-hide cleanup.';

commit;
